'use server'

// Server actions del catálogo de precio fijo (CatalogItem + CatalogItemMaterial
// + CatalogSale) de VinylOps Pricing Studio.
//
// Este catálogo es una línea de venta separada del flujo de pedidos custom
// (Order): precio fijo por producto/kit, en vez de pricing calculado por
// área+complejidad. Reusa InventoryConsumption (vía catalogSaleId) para
// descontar inventario con el mismo mecanismo que ya usa updateOrderStatus en
// lib/actions/orders.ts, sin duplicar esa tabla.
//
// Igual que weightedAverageCostSnapshot en QuoteMaterialUsage, el
// unitPriceSnapshot de cada CatalogSale se congela al momento de vender y
// nunca se recalcula después aunque el CatalogItem cambie de precio.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

export interface SellCatalogItemInput {
  catalogItemId: string
  quantity: number
  customerName?: string
  notes?: string
}

export interface CatalogRecipeLineInput {
  materialId: string
  areaCm2PerUnit: number
}

export interface CreateCatalogItemInput {
  name: string
  isKit?: boolean
  unitPrice: number
  otherCostPerUnit?: number
  description?: string
  recipe: CatalogRecipeLineInput[]
}

export interface UpdateCatalogItemInput {
  name?: string
  isKit?: boolean
  unitPrice?: number
  otherCostPerUnit?: number
  description?: string
  isActive?: boolean
  recipe?: CatalogRecipeLineInput[]
}

/** Reglas comunes a create/update: nombre no vacío, precio y otros costos no negativos. */
function validateCatalogItemInput(data: { name?: string; unitPrice?: number; otherCostPerUnit?: number }) {
  if (data.name !== undefined && !data.name.trim()) {
    throw new Error('El nombre del item de catálogo es obligatorio')
  }
  if (data.unitPrice !== undefined && data.unitPrice < 0) {
    throw new Error('El precio de venta no puede ser negativo')
  }
  if (data.otherCostPerUnit !== undefined && data.otherCostPerUnit < 0) {
    throw new Error('Los otros costos por unidad no pueden ser negativos')
  }
}

/** Costo de producción de una unidad = suma de areaCm2PerUnit * costo vigente de cada material de la receta. */
function computeUnitCost(materials: { areaCm2PerUnit: number; material: { weightedAverageCostPerCm2: number } }[]) {
  return materials.reduce((sum, line) => sum + line.areaCm2PerUnit * line.material.weightedAverageCostPerCm2, 0)
}

/**
 * Catálogo con receta incluida y costo/margen calculados al vuelo (no
 * persistidos) a partir del costo vigente de cada material. Por defecto solo
 * activos; `includeArchived` trae también los archivados (isActive: false)
 * para el toggle "Ver archivados" de la UI, mismo criterio que
 * listMaterials.
 */
export async function listCatalogItems(opts: { includeArchived?: boolean } = {}) {
  const items = await prisma.catalogItem.findMany({
    where: opts.includeArchived ? {} : { isActive: true },
    include: { materials: { include: { material: true } } },
    orderBy: { name: 'asc' },
  })

  return items.map((item) => {
    const productionCost = computeUnitCost(item.materials) + item.otherCostPerUnit
    return {
      ...item,
      productionCost,
      margin: item.unitPrice - productionCost,
    }
  })
}

export async function getCatalogItem(id: string) {
  const item = await prisma.catalogItem.findUnique({
    where: { id },
    include: { materials: { include: { material: true } } },
  })

  if (!item) {
    throw new Error('No se encontró el item de catálogo solicitado')
  }

  const materials = item.materials.map((line) => ({
    ...line,
    costPerUnit: line.areaCm2PerUnit * line.material.weightedAverageCostPerCm2,
  }))

  const productionCost = materials.reduce((sum, line) => sum + line.costPerUnit, 0) + item.otherCostPerUnit

  return {
    ...item,
    materials,
    productionCost,
    margin: item.unitPrice - productionCost,
  }
}

export async function sellCatalogItem(input: SellCatalogItemInput) {
  if (input.quantity <= 0) {
    throw new Error('La cantidad vendida debe ser mayor a cero')
  }

  const catalogItem = await prisma.catalogItem.findUnique({
    where: { id: input.catalogItemId },
    include: { materials: { include: { material: true } } },
  })

  if (!catalogItem) {
    throw new Error('No se encontró el item de catálogo a vender')
  }

  const unitPriceSnapshot = catalogItem.unitPrice
  const totalPrice = unitPriceSnapshot * input.quantity

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.catalogSale.create({
      data: {
        catalogItemId: catalogItem.id,
        quantity: input.quantity,
        unitPriceSnapshot,
        totalPrice,
        customerName: input.customerName?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
      },
    })

    for (const line of catalogItem.materials) {
      const material = await tx.material.findUnique({ where: { id: line.materialId } })
      if (!material) continue

      const areaRequested = line.areaCm2PerUnit * input.quantity
      const areaToConsume = Math.min(areaRequested, material.totalAreaCm2)
      const wasClamped = areaToConsume < areaRequested
      const costToConsume = areaToConsume * material.weightedAverageCostPerCm2

      await tx.inventoryConsumption.create({
        data: {
          catalogSaleId: created.id,
          materialId: line.materialId,
          areaConsumedCm2: areaToConsume,
          costConsumed: costToConsume,
          costPerCm2Snapshot: material.weightedAverageCostPerCm2,
          notes: wasClamped
            ? `Stock insuficiente: se solicitaban ${areaRequested.toFixed(2)} cm² y sólo había ${material.totalAreaCm2.toFixed(2)} cm² disponibles. Se consumió el stock disponible.`
            : undefined,
        },
      })

      const newTotalArea = Math.max(0, material.totalAreaCm2 - areaToConsume)
      const newTotalValue = Math.max(0, material.totalValue - costToConsume)

      await tx.material.update({
        where: { id: line.materialId },
        data: {
          totalAreaCm2: newTotalArea,
          totalValue: newTotalValue,
          // FASE 1 (V1, 2026-07): el costo promedio ponderado YA NO se
          // resetea a 0 cuando el área llega a 0. Esa regla causó un
          // incidente real (un producto de catálogo mostró costo/margen en
          // $0 después de que una prueba consumiera todo el stock de un
          // material). El costo vigente ahora se conserva como "último
          // costo promedio conocido" hasta la siguiente compra, que sí lo
          // recalcula (ver lib/actions/purchases.ts). El catálogo debe
          // poder seguir mostrando un costo válido aunque el inventario
          // esté temporalmente en 0.
        },
      })
    }

    return created
  })

  revalidatePath('/catalogo')
  revalidatePath('/materiales')
  revalidatePath('/')

  return sale
}

export async function listCatalogSales() {
  return prisma.catalogSale.findMany({
    include: { catalogItem: true },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Crea un CatalogItem + su receta (CatalogItemMaterial) en una transacción.
 * Receta vacía es válida a propósito: hay productos de puro margen de
 * servicio sin materiales asociados (ej. maquila 100% a cargo de un
 * proveedor externo sin costo de material que trackear aquí).
 */
export async function createCatalogItem(data: CreateCatalogItemInput) {
  validateCatalogItemInput(data)

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.catalogItem.create({
      data: {
        name: data.name.trim(),
        isKit: data.isKit ?? false,
        unitPrice: data.unitPrice,
        otherCostPerUnit: data.otherCostPerUnit ?? 0,
        description: data.description?.trim() || undefined,
      },
    })

    for (const line of data.recipe) {
      await tx.catalogItemMaterial.create({
        data: {
          catalogItemId: created.id,
          materialId: line.materialId,
          areaCm2PerUnit: line.areaCm2PerUnit,
        },
      })
    }

    return created
  })

  revalidatePath('/catalogo')

  return item
}

/**
 * Actualiza un CatalogItem. Si viene `recipe`, reemplaza TODAS las líneas
 * existentes de CatalogItemMaterial (borra + crea de nuevo) en vez de hacer
 * diff línea por línea — más simple y suficiente porque la receta siempre se
 * edita completa desde el dialog, no línea por línea.
 */
export async function updateCatalogItem(id: string, data: UpdateCatalogItemInput) {
  validateCatalogItemInput(data)

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.catalogItem.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.isKit !== undefined ? { isKit: data.isKit } : {}),
        ...(data.unitPrice !== undefined ? { unitPrice: data.unitPrice } : {}),
        ...(data.otherCostPerUnit !== undefined ? { otherCostPerUnit: data.otherCostPerUnit } : {}),
        ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    })

    if (data.recipe !== undefined) {
      await tx.catalogItemMaterial.deleteMany({ where: { catalogItemId: id } })
      for (const line of data.recipe) {
        await tx.catalogItemMaterial.create({
          data: {
            catalogItemId: id,
            materialId: line.materialId,
            areaCm2PerUnit: line.areaCm2PerUnit,
          },
        })
      }
    }

    return updated
  })

  revalidatePath('/catalogo')

  return item
}

/**
 * Archivar/reactivar togglea isActive en vez de borrar físicamente: ventas
 * (CatalogSale) y líneas de pedido (QuoteLineItem) históricos referencian el
 * CatalogItem por FK y deben seguir resolviendo su nombre/precio pasado.
 */
export async function archiveCatalogItem(id: string) {
  const item = await prisma.catalogItem.update({
    where: { id },
    data: { isActive: false },
  })

  revalidatePath('/catalogo')

  return item
}

export async function unarchiveCatalogItem(id: string) {
  const item = await prisma.catalogItem.update({
    where: { id },
    data: { isActive: true },
  })

  revalidatePath('/catalogo')

  return item
}
