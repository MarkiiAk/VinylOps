'use server'

// Server actions de pedidos (Order + QuoteLineItem + InventoryConsumption).
//
// Reemplaza lib/actions/quotes.ts: cada Order pertenece a un Lead (catálogo
// de clientes) y representa una tarjeta de Kanban independiente — un mismo
// lead puede acumular varios Order en el tiempo (historial). El status del
// Order es el pipeline de producción (Disenando..Entregado), independiente
// del status del Lead (relación comercial).
//
// Modelo tipo carrito (idéntico al de quotes.ts, solo renombrado): un pedido
// tiene líneas de catálogo (precio fijo, snapshot de nombre/precio congelado
// al agregar) y/o líneas "Otro" (100% manuales, descripción + precio a mano,
// sin motor de pricing). Las líneas "Otro" pueden declarar opcionalmente un
// material y área consumida, para poder descontar inventario cuando no hay
// receta automática como en catálogo.
//
// La UI arma el carrito completo en estado local del cliente y lo manda de
// una sola vez a createOrder — no hay edición de líneas sueltas contra el
// server, evita la complejidad de addLineItem/removeLineItem/updateLineItem
// que no aporta nada aquí (el pedido solo se arma una vez, al crearlo).

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import type { Prisma } from '@/lib/generated/prisma/client'
import { computeLineSnapshot, deriveKitCosts } from '@/lib/costing'
import { decideOrderDateUpdate, toDateKey } from '@/lib/business-days'

export interface QuoteLineItemInput {
  catalogItemId?: string
  description: string
  quantity: number
  unitPrice: number
  otherMaterialId?: string
  otherMaterialAreaCm2?: number
  // FASE 2 (V1): costos granulares para líneas "Otro" (manuales). Para
  // líneas de catálogo estos valores se ignoran — se toman del CatalogItem
  // vigente al momento de congelar el snapshot (ver resolvedLines abajo).
  // Todos son POR UNIDAD, default 0 si no se especifican (la UI debe
  // advertir al usuario cuando deja una línea manual en costo implícito 0).
  unitInkCost?: number
  unitElectricityCost?: number
  unitWearCost?: number
  unitWasteCost?: number
  unitBagCost?: number
  unitLabelCost?: number
  estimatedUnitLabor?: number
}

export interface CreateOrderInput {
  leadId: string
  interest: string
  notes?: string
  status?: 'Disenando' | 'DisenoAprobado' | 'Maquilando' | 'Completado' | 'Entregado'
  deliveryDate?: Date
  lineItems: QuoteLineItemInput[]
}

function validateLineItems(lineItems: QuoteLineItemInput[]) {
  if (!lineItems || lineItems.length === 0) {
    throw new Error('El pedido debe incluir al menos una línea')
  }

  for (const line of lineItems) {
    if (!line.description?.trim()) {
      throw new Error('Cada línea debe tener una descripción')
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error('La cantidad de cada línea debe ser mayor a cero')
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      throw new Error('El precio unitario no puede ser negativo')
    }
    if (line.otherMaterialAreaCm2 !== undefined && line.otherMaterialAreaCm2 <= 0) {
      throw new Error('El área de material declarada debe ser mayor a cero')
    }
    const costFields = [
      line.unitInkCost,
      line.unitElectricityCost,
      line.unitWearCost,
      line.unitWasteCost,
      line.unitBagCost,
      line.unitLabelCost,
      line.estimatedUnitLabor,
    ]
    if (costFields.some((v) => v !== undefined && v < 0)) {
      throw new Error('Los costos declarados en una línea no pueden ser negativos')
    }
  }
}

export async function createOrder(input: CreateOrderInput) {
  if (!input.leadId) {
    throw new Error('El pedido debe estar ligado a un lead')
  }
  if (!input.interest?.trim()) {
    throw new Error('El pedido debe describir qué se está vendiendo/trabajando')
  }
  validateLineItems(input.lineItems)

  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } })
  if (!lead) {
    throw new Error('No se encontró el lead al que se quiere ligar este pedido')
  }

  // Snapshot de las líneas de catálogo: si trae catalogItemId, se congela el
  // nombre/precio vigente del CatalogItem en description/unitPrice (mismo
  // criterio que unitPriceSnapshot en CatalogSale), salvo que el caller ya
  // haya mandado esos valores explícitos (ej. precio negociado a la baja).
  const catalogItemIds = input.lineItems
    .map((line) => line.catalogItemId)
    .filter((id): id is string => Boolean(id))

  const catalogItems = catalogItemIds.length
    ? await prisma.catalogItem.findMany({
        where: { id: { in: catalogItemIds } },
        include: { kitComponents: { include: { componentItem: true } } },
      })
    : []
  const catalogItemMap = new Map(catalogItems.map((item) => [item.id, item]))

  const otherMaterialIds = input.lineItems
    .filter((line) => !line.catalogItemId && line.otherMaterialId)
    .map((line) => line.otherMaterialId as string)

  const otherMaterials = otherMaterialIds.length
    ? await prisma.material.findMany({ where: { id: { in: otherMaterialIds } } })
    : []
  const otherMaterialMap = new Map(otherMaterials.map((m) => [m.id, m]))

  // FASE 2 (V1): cada línea congela AQUÍ, al crear el pedido, su snapshot
  // financiero completo (ver lib/costing.ts) — nunca se vuelve a recalcular
  // después, aunque cambie el catálogo, el costo de un material o el precio.
  const resolvedLines = input.lineItems.map((line) => {
    const catalogItem = line.catalogItemId ? catalogItemMap.get(line.catalogItemId) : undefined
    if (line.catalogItemId && !catalogItem) {
      throw new Error('Una de las líneas hace referencia a un item de catálogo que no existe')
    }

    const description = line.description.trim()
    const unitPrice = line.unitPrice
    const lineTotal = unitPrice * line.quantity

    let unitCosts: {
      unitMaterialCost: number
      unitInkCost: number
      unitElectricityCost: number
      unitWearCost: number
      unitWasteCost: number
      unitBagCost: number
      unitLabelCost: number
      estimatedUnitLabor: number
    }

    if (catalogItem) {
      // Regla de negocio: material/tinta/luz/desgaste/merma/mano de obra se
      // capturan directo en el catálogo (NO se derivan del costo de
      // inventario) — salvo que sea un kit, donde se derivan sumando esos
      // mismos campos de cada componente * su cantidad (ver deriveKitCosts).
      // bolsa/etiquetita siempre son propias del item (compartidas en kits).
      const derived = catalogItem.isKit ? deriveKitCosts(catalogItem.kitComponents) : null
      unitCosts = {
        unitMaterialCost: derived ? derived.materialCostPerUnit : catalogItem.materialCostPerUnit,
        unitInkCost: derived ? derived.inkCostPerUnit : catalogItem.inkCostPerUnit,
        unitElectricityCost: derived ? derived.electricityCostPerUnit : catalogItem.electricityCostPerUnit,
        unitWearCost: derived ? derived.wearCostPerUnit : catalogItem.wearCostPerUnit,
        unitWasteCost: derived ? derived.wasteCostPerUnit : catalogItem.wasteCostPerUnit,
        unitBagCost: catalogItem.bagCostPerUnit,
        unitLabelCost: catalogItem.labelCostPerUnit,
        estimatedUnitLabor: derived ? derived.laborCostPerUnit : catalogItem.laborCostPerUnit,
      }
    } else {
      const otherMaterial = line.otherMaterialId ? otherMaterialMap.get(line.otherMaterialId) : undefined
      // otherMaterialAreaCm2 es el área TOTAL de la línea (ya multiplicada
      // por quantity, ver cart-types.ts) — se divide entre quantity para
      // obtener el costo de material POR UNIDAD que espera el snapshot.
      const unitMaterialCost =
        otherMaterial && line.otherMaterialAreaCm2
          ? (line.otherMaterialAreaCm2 * otherMaterial.weightedAverageCostPerCm2) / line.quantity
          : 0
      unitCosts = {
        unitMaterialCost,
        unitInkCost: line.unitInkCost ?? 0,
        unitElectricityCost: line.unitElectricityCost ?? 0,
        unitWearCost: line.unitWearCost ?? 0,
        unitWasteCost: line.unitWasteCost ?? 0,
        unitBagCost: line.unitBagCost ?? 0,
        unitLabelCost: line.unitLabelCost ?? 0,
        estimatedUnitLabor: line.estimatedUnitLabor ?? 0,
      }
    }

    const snapshot = computeLineSnapshot({ ...unitCosts, quantity: line.quantity, lineTotal })

    return {
      catalogItemId: line.catalogItemId,
      description,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
      otherMaterialId: line.catalogItemId ? undefined : line.otherMaterialId,
      otherMaterialAreaCm2: line.catalogItemId ? undefined : line.otherMaterialAreaCm2,
      snapshot,
    }
  })

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        leadId: input.leadId,
        interest: input.interest.trim(),
        notes: input.notes?.trim() || undefined,
        status: input.status ?? 'Disenando',
        deliveryDate: input.deliveryDate,
        // Si se captura a mano al crear el pedido, cuenta como MANUAL — no
        // se recalcula sola cuando el diseño se apruebe después (ver
        // decideOrderDateUpdate en lib/business-days.ts).
        deliveryDateIsManual: Boolean(input.deliveryDate),
      },
    })

    for (const line of resolvedLines) {
      await tx.orderLineItem.create({
        data: {
          orderId: created.id,
          catalogItemId: line.catalogItemId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          otherMaterialId: line.otherMaterialId,
          otherMaterialAreaCm2: line.otherMaterialAreaCm2,
          ...line.snapshot,
          frozenAt: new Date(),
        },
      })
    }

    return created
  })

  revalidatePath('/pedidos')
  revalidatePath(`/leads/${input.leadId}`)
  revalidatePath('/')

  return order
}

const ORDER_STATUSES = ['Disenando', 'DisenoAprobado', 'Maquilando', 'Completado', 'Entregado']
const CONSUMABLE_STATUSES = ['Completado', 'Entregado']

export interface UpdateOrderStatusOptions {
  consumeInventory?: boolean
  /** true = la UI ya confirmó explícitamente recalcular la fecha compromiso sobre una que ya existía (manual o de una aprobación anterior). */
  confirmRecalculateDeliveryDate?: boolean
}

export interface UpdateOrderStatusResult {
  order: Awaited<ReturnType<typeof updateOrderStatusInternal>>['order']
  /** true = había una fecha compromiso previa y NO se recalculó porque no hubo confirmación — la UI debe preguntar y reintentar con confirmRecalculateDeliveryDate: true. */
  needsDeliveryDateConfirmation: boolean
}

async function updateOrderStatusInternal(
  tx: Prisma.TransactionClient,
  id: string,
  status: string,
  opts: UpdateOrderStatusOptions
) {
  const existing = await tx.order.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('No se encontró el pedido a actualizar')
  }

  const nonWorkingDays = await tx.nonWorkingDay.findMany()
  const nonWorkingDates = new Set(nonWorkingDays.map((d) => toDateKey(d.date)))

  const dateDecision = decideOrderDateUpdate({
    newStatus: status,
    order: {
      designApprovedAt: existing.designApprovedAt,
      deliveryDate: existing.deliveryDate,
      deliveredAt: existing.deliveredAt,
    },
    now: new Date(),
    nonWorkingDates,
    confirmRecalculateDeliveryDate: opts.confirmRecalculateDeliveryDate,
  })

  const order = await tx.order.update({
    where: { id },
    data: {
      status,
      ...(dateDecision.designApprovedAt ? { designApprovedAt: dateDecision.designApprovedAt } : {}),
      ...(dateDecision.deliveryDate ? { deliveryDate: dateDecision.deliveryDate } : {}),
      ...(dateDecision.deliveryDateIsManual !== undefined ? { deliveryDateIsManual: dateDecision.deliveryDateIsManual } : {}),
      ...(dateDecision.deliveredAt ? { deliveredAt: dateDecision.deliveredAt } : {}),
    },
    include: {
      lineItems: { include: { catalogItem: { include: { materials: true } } } },
    },
  })

  return { order, needsDeliveryDateConfirmation: dateDecision.needsConfirmation }
}

export async function updateOrderStatus(
  id: string,
  status: string,
  opts: UpdateOrderStatusOptions = {}
): Promise<UpdateOrderStatusResult> {
  if (!ORDER_STATUSES.includes(status)) {
    throw new Error(`Status de pedido inválido: ${status}`)
  }

  const result = await prisma.$transaction(async (tx) => {
    const { order, needsDeliveryDateConfirmation } = await updateOrderStatusInternal(tx, id, status, opts)

    const shouldConsume = opts.consumeInventory === true && CONSUMABLE_STATUSES.includes(status)

    if (shouldConsume) {
      const existingConsumption = await tx.inventoryConsumption.findFirst({ where: { orderId: id } })

      if (!existingConsumption) {
        for (const line of order.lineItems) {
          if (line.catalogItemId && line.catalogItem) {
            // Línea de catálogo: la receta (CatalogItemMaterial) se multiplica
            // por la cantidad de la línea, mismo patrón de clamping que
            // sellCatalogItem en lib/actions/catalog.ts.
            for (const recipeLine of line.catalogItem.materials) {
              await consumeMaterial(tx, {
                orderId: id,
                materialId: recipeLine.materialId,
                areaRequested: recipeLine.areaCm2PerUnit * line.quantity,
              })
            }
          } else if (line.otherMaterialId && line.otherMaterialAreaCm2) {
            // Línea "Otro": un solo consumo, con el área declarada a mano.
            await consumeMaterial(tx, {
              orderId: id,
              materialId: line.otherMaterialId,
              areaRequested: line.otherMaterialAreaCm2,
            })
          }
        }
      }
    }

    return { order, needsDeliveryDateConfirmation }
  })

  revalidatePath('/pedidos')
  revalidatePath(`/leads/${result.order.leadId}`)
  revalidatePath('/materiales')
  revalidatePath('/')

  return result
}

/**
 * Descuenta inventario de un material, clampeado al stock disponible (mismo
 * mecanismo que sellCatalogItem en lib/actions/catalog.ts): si no hay
 * suficiente stock, consume lo disponible y deja nota explicando el faltante.
 */
async function consumeMaterial(
  tx: Prisma.TransactionClient,
  params: { orderId: string; materialId: string; areaRequested: number }
) {
  const material = await tx.material.findUnique({ where: { id: params.materialId } })
  if (!material) return

  const areaToConsume = Math.min(params.areaRequested, material.totalAreaCm2)
  const wasClamped = areaToConsume < params.areaRequested
  const costToConsume = areaToConsume * material.weightedAverageCostPerCm2

  await tx.inventoryConsumption.create({
    data: {
      orderId: params.orderId,
      materialId: params.materialId,
      areaConsumedCm2: areaToConsume,
      costConsumed: costToConsume,
      costPerCm2Snapshot: material.weightedAverageCostPerCm2,
      notes: wasClamped
        ? `Stock insuficiente: se solicitaban ${params.areaRequested.toFixed(2)} cm² y sólo había ${material.totalAreaCm2.toFixed(2)} cm² disponibles. Se consumió el stock disponible.`
        : undefined,
    },
  })

  const newTotalArea = Math.max(0, material.totalAreaCm2 - areaToConsume)
  const newTotalValue = Math.max(0, material.totalValue - costToConsume)

  await tx.material.update({
    where: { id: params.materialId },
    data: {
      totalAreaCm2: newTotalArea,
      totalValue: newTotalValue,
      // FASE 1 (V1, 2026-07): el costo promedio ponderado por cm2 YA NO se
      // resetea a 0 cuando el área llega a 0 (ver misma nota en
      // lib/actions/catalog.ts: esa regla causó un incidente real de
      // costo/margen en $0). Se conserva como "último costo conocido" hasta
      // la siguiente compra, que sí lo recalcula.
    },
  })
}

export interface ListOrdersOptions {
  status?: string
}

/** Todas las órdenes con su lead, para el tablero Kanban de /pedidos. */
export async function listOrders(opts: ListOrdersOptions = {}) {
  const { status } = opts

  return prisma.order.findMany({
    where: {
      ...(status ? { status } : {}),
    },
    include: {
      lead: true,
      lineItems: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Órdenes con deliveryDate no nula, para el calendario de entregas
 * (/calendario). Trae lead para mostrar nombre en cada tarjeta del día;
 * no filtra por rango de mes aquí (son pocas filas en este negocio) — el
 * agrupamiento por día/mes se hace en la página que arma la grilla.
 */
export async function listOrdersWithDeliveryDate() {
  return prisma.order.findMany({
    where: { deliveryDate: { not: null } },
    include: { lead: true },
    orderBy: { deliveryDate: 'asc' },
  })
}

export async function getOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      lead: true,
      lineItems: { include: { catalogItem: true, otherMaterial: true }, orderBy: { createdAt: 'asc' } },
      consumptions: { include: { material: true }, orderBy: { consumedAt: 'desc' } },
      payments: { orderBy: { paidAt: 'desc' } },
    },
  })

  if (!order) {
    throw new Error('No se encontró el pedido solicitado')
  }

  return order
}

export async function setOrderNotes(id: string, notes: string) {
  const order = await prisma.order.update({
    where: { id },
    data: { notes: notes.trim() || null },
  })

  revalidatePath('/pedidos')
  revalidatePath(`/leads/${order.leadId}`)

  return order
}

/**
 * Edición MANUAL de la fecha compromiso de entrega — siempre marca
 * deliveryDateIsManual: true (ver decideOrderDateUpdate en
 * lib/business-days.ts), para que una futura aprobación/re-aprobación de
 * diseño nunca la recalcule sin preguntar primero.
 */
export async function setOrderDeliveryDate(id: string, deliveryDate: Date | null) {
  const order = await prisma.order.update({
    where: { id },
    data: { deliveryDate, deliveryDateIsManual: deliveryDate !== null },
  })

  revalidatePath('/pedidos')
  revalidatePath(`/leads/${order.leadId}`)

  return order
}
