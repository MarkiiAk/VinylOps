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

export interface QuoteLineItemInput {
  catalogItemId?: string
  description: string
  quantity: number
  unitPrice: number
  otherMaterialId?: string
  otherMaterialAreaCm2?: number
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
    ? await prisma.catalogItem.findMany({ where: { id: { in: catalogItemIds } } })
    : []
  const catalogItemMap = new Map(catalogItems.map((item) => [item.id, item]))

  const resolvedLines = input.lineItems.map((line) => {
    const catalogItem = line.catalogItemId ? catalogItemMap.get(line.catalogItemId) : undefined
    if (line.catalogItemId && !catalogItem) {
      throw new Error('Una de las líneas hace referencia a un item de catálogo que no existe')
    }

    const description = line.description.trim()
    const unitPrice = line.unitPrice
    const lineTotal = unitPrice * line.quantity

    return {
      catalogItemId: line.catalogItemId,
      description,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
      otherMaterialId: line.catalogItemId ? undefined : line.otherMaterialId,
      otherMaterialAreaCm2: line.catalogItemId ? undefined : line.otherMaterialAreaCm2,
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
      },
    })

    for (const line of resolvedLines) {
      await tx.quoteLineItem.create({
        data: {
          orderId: created.id,
          catalogItemId: line.catalogItemId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          otherMaterialId: line.otherMaterialId,
          otherMaterialAreaCm2: line.otherMaterialAreaCm2,
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
}

export async function updateOrderStatus(id: string, status: string, opts: UpdateOrderStatusOptions = {}) {
  if (!ORDER_STATUSES.includes(status)) {
    throw new Error(`Status de pedido inválido: ${status}`)
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id },
      data: { status },
      include: {
        lineItems: { include: { catalogItem: { include: { materials: true } } } },
      },
    })

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

    return order
  })

  revalidatePath('/pedidos')
  revalidatePath(`/leads/${result.leadId}`)
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

export async function setOrderDeliveryDate(id: string, deliveryDate: Date | null) {
  const order = await prisma.order.update({
    where: { id },
    data: { deliveryDate },
  })

  revalidatePath('/pedidos')
  revalidatePath(`/leads/${order.leadId}`)

  return order
}
