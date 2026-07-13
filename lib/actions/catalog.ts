'use server'

// Server actions del catálogo de precio fijo (CatalogItem + CatalogItemMaterial)
// de VinylOps Pricing Studio.
//
// FASE 3 (V1, flujo único de ventas): el único mecanismo de venta real es
// Lead → Order → OrderLineItem → Payment (ver lib/actions/orders.ts). Este
// catálogo define productos/kits y su costeo, pero YA NO tiene su propio
// camino de venta (CatalogSale/sellCatalogItem) — ver nota más abajo.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import {
  computeKitSavings,
  computeUnitDirectCost,
  deriveKitCosts,
  deriveKitMaterialRecipe,
  roundForStorage,
} from '@/lib/costing'

export interface CatalogRecipeLineInput {
  materialId: string
  areaCm2PerUnit: number
}

// FASE 2 (V1): costos granulares por unidad. otherCostPerUnit se sigue
// aceptando (compatibilidad hacia atrás) pero es LEGADO — ver nota en
// schema.prisma. Los 8 campos de abajo son la fuente de verdad de V1.
// materialCostPerUnit se captura DIRECTO (no se deriva de la receta de
// inventario) — regla de negocio explícita del dueño, ver schema.prisma.
export interface GranularCostInput {
  materialCostPerUnit?: number
  inkCostPerUnit?: number
  electricityCostPerUnit?: number
  wearCostPerUnit?: number
  wasteCostPerUnit?: number
  bagCostPerUnit?: number
  labelCostPerUnit?: number
  laborCostPerUnit?: number
}

export interface CreateCatalogItemInput extends GranularCostInput {
  name: string
  isKit?: boolean
  unitPrice: number
  otherCostPerUnit?: number
  description?: string
  recipe: CatalogRecipeLineInput[]
}

export interface UpdateCatalogItemInput extends GranularCostInput {
  name?: string
  isKit?: boolean
  unitPrice?: number
  otherCostPerUnit?: number
  description?: string
  isActive?: boolean
  recipe?: CatalogRecipeLineInput[]
}

const GRANULAR_COST_FIELDS = [
  'materialCostPerUnit',
  'inkCostPerUnit',
  'electricityCostPerUnit',
  'wearCostPerUnit',
  'wasteCostPerUnit',
  'bagCostPerUnit',
  'labelCostPerUnit',
  'laborCostPerUnit',
] as const

/** Reglas comunes a create/update: nombre no vacío, precio y costos no negativos. */
function validateCatalogItemInput(data: { name?: string; unitPrice?: number; otherCostPerUnit?: number } & GranularCostInput) {
  if (data.name !== undefined && !data.name.trim()) {
    throw new Error('El nombre del item de catálogo es obligatorio')
  }
  if (data.unitPrice !== undefined && data.unitPrice < 0) {
    throw new Error('El precio de venta no puede ser negativo')
  }
  if (data.otherCostPerUnit !== undefined && data.otherCostPerUnit < 0) {
    throw new Error('Los otros costos por unidad no pueden ser negativos')
  }
  for (const field of GRANULAR_COST_FIELDS) {
    const value = data[field]
    if (value !== undefined && value < 0) {
      throw new Error('Los costos por unidad no pueden ser negativos')
    }
  }
}

type CatalogItemCostFields = {
  isKit: boolean
  materialCostPerUnit: number
  inkCostPerUnit: number
  electricityCostPerUnit: number
  wearCostPerUnit: number
  wasteCostPerUnit: number
  bagCostPerUnit: number
  labelCostPerUnit: number
  laborCostPerUnit: number
  unitPrice: number
}

type KitComponentForCost = {
  quantity: number
  componentItem: {
    materialCostPerUnit: number
    inkCostPerUnit: number
    electricityCostPerUnit: number
    wearCostPerUnit: number
    wasteCostPerUnit: number
    laborCostPerUnit: number
  }
}

/**
 * Desglose financiero completo de un item de catálogo, calculado al vuelo
 * (no persistido). Si es un kit, material/tinta/luz/desgaste/merma/mano de
 * obra se DERIVAN sumando esos campos de cada componente * su cantidad
 * (regla de negocio: nunca duplicar esos valores a mano en el kit) —
 * bagCostPerUnit/labelCostPerUnit del propio kit sí se usan tal cual
 * (compartidos, una vez). Si NO es kit, todos los 8 campos vienen
 * directamente del propio CatalogItem (capturados a mano, no derivados de
 * inventario).
 */
function computeCatalogItemFinancials(item: CatalogItemCostFields, kitComponents: KitComponentForCost[]) {
  const derived = item.isKit ? deriveKitCosts(kitComponents) : null
  const costs = derived
    ? { ...derived, unitBagCost: item.bagCostPerUnit, unitLabelCost: item.labelCostPerUnit }
    : {
        materialCostPerUnit: item.materialCostPerUnit,
        inkCostPerUnit: item.inkCostPerUnit,
        electricityCostPerUnit: item.electricityCostPerUnit,
        wearCostPerUnit: item.wearCostPerUnit,
        wasteCostPerUnit: item.wasteCostPerUnit,
        unitBagCost: item.bagCostPerUnit,
        unitLabelCost: item.labelCostPerUnit,
      }

  const laborCostPerUnit = derived ? derived.laborCostPerUnit : item.laborCostPerUnit

  const unitDirectCost = computeUnitDirectCost({
    unitMaterialCost: costs.materialCostPerUnit,
    unitInkCost: costs.inkCostPerUnit,
    unitElectricityCost: costs.electricityCostPerUnit,
    unitWearCost: costs.wearCostPerUnit,
    unitWasteCost: costs.wasteCostPerUnit,
    unitBagCost: costs.unitBagCost,
    unitLabelCost: costs.unitLabelCost,
  })

  const grossProfit = roundForStorage(item.unitPrice - unitDirectCost)
  const grossMargin = item.unitPrice ? roundForStorage(grossProfit / item.unitPrice) : 0
  const profitAfterLabor = roundForStorage(grossProfit - laborCostPerUnit)
  const marginAfterLabor = item.unitPrice ? roundForStorage(profitAfterLabor / item.unitPrice) : 0

  return {
    unitMaterialCost: roundForStorage(costs.materialCostPerUnit),
    effectiveInkCostPerUnit: roundForStorage(costs.inkCostPerUnit),
    effectiveElectricityCostPerUnit: roundForStorage(costs.electricityCostPerUnit),
    effectiveWearCostPerUnit: roundForStorage(costs.wearCostPerUnit),
    effectiveWasteCostPerUnit: roundForStorage(costs.wasteCostPerUnit),
    effectiveLaborCostPerUnit: roundForStorage(laborCostPerUnit),
    unitDirectCost,
    grossProfit,
    grossMargin,
    profitAfterLabor,
    marginAfterLabor,
    // Legado: se mantiene por compatibilidad con la UI existente
    // (productionCost/margin), ahora igual a unitDirectCost/grossProfit.
    productionCost: unitDirectCost,
    margin: grossProfit,
  }
}

/**
 * Catálogo con receta incluida y desglose financiero granular calculado al
 * vuelo (no persistido) a partir del costo vigente de cada material. Por
 * defecto solo activos; `includeArchived` trae también los archivados
 * (isActive: false) para el toggle "Ver archivados" de la UI, mismo criterio
 * que listMaterials.
 */
export async function listCatalogItems(opts: { includeArchived?: boolean } = {}) {
  const items = await prisma.catalogItem.findMany({
    where: opts.includeArchived ? {} : { isActive: true },
    include: {
      materials: { include: { material: true } },
      kitComponents: { include: { componentItem: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })

  return items.map((item) => ({
    ...item,
    ...computeCatalogItemFinancials(item, item.kitComponents),
    kitSavings: item.isKit ? computeKitSavings(item.unitPrice, item.kitComponents) : null,
  }))
}

export async function getCatalogItem(id: string) {
  const item = await prisma.catalogItem.findUnique({
    where: { id },
    include: {
      materials: { include: { material: true } },
      kitComponents: { include: { componentItem: true }, orderBy: { createdAt: 'asc' } },
    },
  })

  if (!item) {
    throw new Error('No se encontró el item de catálogo solicitado')
  }

  const materials = item.materials.map((line) => ({
    ...line,
    costPerUnit: line.areaCm2PerUnit * line.material.weightedAverageCostPerCm2,
  }))

  const financials = computeCatalogItemFinancials(item, item.kitComponents)
  const kitSavings = item.isKit ? computeKitSavings(item.unitPrice, item.kitComponents) : null

  return {
    ...item,
    materials,
    ...financials,
    kitSavings,
  }
}

// FASE 3 (V1, flujo único de ventas): sellCatalogItem/listCatalogSales se
// retiraron de aquí — no tenían ningún consumidor en la UI (confirmado por
// búsqueda global antes de borrar) y representaban un segundo mecanismo de
// venta paralelo a Lead → Order → OrderLineItem → Payment, prohibido por la
// regla de negocio de "un solo flujo oficial de ventas". La tabla
// `CatalogSale` y sus filas históricas NO se borraron ni se migraron: quedan
// archivadas tal cual en la base como registro histórico de solo lectura
// (sin ningún punto de entrada nuevo, ni server action ni UI). Si algún día
// se necesita consultarlas, se puede volver a exponer un `listCatalogSales`
// de solo lectura sin reactivar `sellCatalogItem`.

/**
 * Crea un CatalogItem + su receta (CatalogItemMaterial) en una transacción.
 * Receta vacía es válida a propósito: hay productos de puro margen de
 * servicio sin materiales asociados (ej. maquila 100% a cargo de un
 * proveedor externo sin costo de material que trackear aquí).
 */
export async function createCatalogItem(data: CreateCatalogItemInput) {
  await requireSession()
  validateCatalogItemInput(data)

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.catalogItem.create({
      data: {
        name: data.name.trim(),
        isKit: data.isKit ?? false,
        unitPrice: data.unitPrice,
        otherCostPerUnit: data.otherCostPerUnit ?? 0,
        materialCostPerUnit: data.materialCostPerUnit ?? 0,
        inkCostPerUnit: data.inkCostPerUnit ?? 0,
        electricityCostPerUnit: data.electricityCostPerUnit ?? 0,
        wearCostPerUnit: data.wearCostPerUnit ?? 0,
        wasteCostPerUnit: data.wasteCostPerUnit ?? 0,
        bagCostPerUnit: data.bagCostPerUnit ?? 0,
        labelCostPerUnit: data.labelCostPerUnit ?? 0,
        laborCostPerUnit: data.laborCostPerUnit ?? 0,
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
  await requireSession()
  validateCatalogItemInput(data)

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.catalogItem.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.isKit !== undefined ? { isKit: data.isKit } : {}),
        ...(data.unitPrice !== undefined ? { unitPrice: data.unitPrice } : {}),
        ...(data.otherCostPerUnit !== undefined ? { otherCostPerUnit: data.otherCostPerUnit } : {}),
        ...(data.materialCostPerUnit !== undefined ? { materialCostPerUnit: data.materialCostPerUnit } : {}),
        ...(data.inkCostPerUnit !== undefined ? { inkCostPerUnit: data.inkCostPerUnit } : {}),
        ...(data.electricityCostPerUnit !== undefined ? { electricityCostPerUnit: data.electricityCostPerUnit } : {}),
        ...(data.wearCostPerUnit !== undefined ? { wearCostPerUnit: data.wearCostPerUnit } : {}),
        ...(data.wasteCostPerUnit !== undefined ? { wasteCostPerUnit: data.wasteCostPerUnit } : {}),
        ...(data.bagCostPerUnit !== undefined ? { bagCostPerUnit: data.bagCostPerUnit } : {}),
        ...(data.labelCostPerUnit !== undefined ? { labelCostPerUnit: data.labelCostPerUnit } : {}),
        ...(data.laborCostPerUnit !== undefined ? { laborCostPerUnit: data.laborCostPerUnit } : {}),
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

export interface KitComponentInput {
  componentItemId: string
  quantity: number
}

/**
 * Reemplaza la lista de componentes de un kit y RE-DERIVA su receta de
 * materiales (CatalogItemMaterial) a partir de esos componentes — un kit no
 * mantiene su receta de materiales a mano, se calcula sumando la receta de
 * cada componente * su cantidad en el kit (ver deriveKitMaterialRecipe en
 * lib/costing.ts). Esto evita que la receta del kit se desincronice de sus
 * componentes, que es justo lo que se detectó en los datos reales de Kit
 * Premium al construir este modelo (ver V1_IMPLEMENTATION_REPORT.md).
 */
export async function setKitComponents(kitId: string, components: KitComponentInput[]) {
  await requireSession()
  for (const c of components) {
    if (!Number.isFinite(c.quantity) || c.quantity <= 0) {
      throw new Error('La cantidad de cada componente del kit debe ser mayor a cero')
    }
    if (c.componentItemId === kitId) {
      throw new Error('Un kit no puede incluirse a sí mismo como componente')
    }
  }

  const item = await prisma.$transaction(async (tx) => {
    const kit = await tx.catalogItem.findUnique({ where: { id: kitId } })
    if (!kit) {
      throw new Error('No se encontró el kit a configurar')
    }

    const componentItems = await tx.catalogItem.findMany({
      where: { id: { in: components.map((c) => c.componentItemId) } },
      include: { materials: true },
    })
    const componentMap = new Map(componentItems.map((c) => [c.id, c]))

    await tx.catalogItemComponent.deleteMany({ where: { kitId } })
    for (const c of components) {
      const componentItem = componentMap.get(c.componentItemId)
      if (!componentItem) {
        throw new Error('Uno de los componentes seleccionados no existe en el catálogo')
      }
      await tx.catalogItemComponent.create({
        data: { kitId, componentItemId: c.componentItemId, quantity: c.quantity },
      })
    }

    const derivedRecipe = deriveKitMaterialRecipe(
      components.map((c) => ({ quantity: c.quantity, componentItem: componentMap.get(c.componentItemId)! }))
    )

    await tx.catalogItemMaterial.deleteMany({ where: { catalogItemId: kitId } })
    for (const line of derivedRecipe) {
      await tx.catalogItemMaterial.create({
        data: { catalogItemId: kitId, materialId: line.materialId, areaCm2PerUnit: line.areaCm2PerUnit },
      })
    }

    return kit
  })

  revalidatePath('/catalogo')

  return item
}

/** Lista liviana (id/nombre/precio) para el selector de componentes de kit — excluye el kit que se está editando. */
export async function listCatalogItemsForKitPicker(excludeKitId?: string) {
  return prisma.catalogItem.findMany({
    where: { isActive: true, isKit: false, ...(excludeKitId ? { id: { not: excludeKitId } } : {}) },
    select: { id: true, name: true, unitPrice: true },
    orderBy: { name: 'asc' },
  })
}

/**
 * Archivar/reactivar togglea isActive en vez de borrar físicamente: ventas
 * (CatalogSale) y líneas de pedido (OrderLineItem) históricos referencian el
 * CatalogItem por FK y deben seguir resolviendo su nombre/precio pasado.
 */
export async function archiveCatalogItem(id: string) {
  await requireSession()
  const item = await prisma.catalogItem.update({
    where: { id },
    data: { isActive: false },
  })

  revalidatePath('/catalogo')

  return item
}

export async function unarchiveCatalogItem(id: string) {
  await requireSession()
  const item = await prisma.catalogItem.update({
    where: { id },
    data: { isActive: true },
  })

  revalidatePath('/catalogo')

  return item
}
