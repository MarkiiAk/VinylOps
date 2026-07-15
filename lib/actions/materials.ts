'use server'

// Server actions de materiales (inventario) de VinylOps Pricing Studio.
//
// Los campos calculados (totalAreaCm2, totalValue, weightedAverageCostPerCm2,
// weightedAverageCostPerM2) NUNCA se editan directamente desde estas acciones
// de "edición manual" — sólo se mueven a través de lib/actions/purchases.ts
// (nueva compra) o lib/actions/orders.ts (consumo de inventario). Aquí sólo
// se permite editar los campos descriptivos del material.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

export interface ListMaterialsOptions {
  includeArchived?: boolean
  category?: string
  search?: string
  /** Si se define, filtra por materiales de inventario (true) o de solo costo (false). Sin definir = ambos (catalogo completo). */
  isInventoryTracked?: boolean
}

export async function listMaterials(opts: ListMaterialsOptions = {}) {
  const { includeArchived = false, category, search, isInventoryTracked } = opts

  return prisma.material.findMany({
    where: {
      ...(includeArchived ? {} : { isArchived: false }),
      ...(category ? { category } : {}),
      ...(isInventoryTracked !== undefined ? { isInventoryTracked } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { color: { contains: search } },
              { brand: { contains: search } },
              { supplierDefault: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  })
}

export async function getMaterial(id: string) {
  const material = await prisma.material.findUnique({
    where: { id },
    include: {
      purchases: { orderBy: { purchaseDate: 'desc' } },
      orderLineItemUsages: {
        include: { order: true },
        orderBy: { createdAt: 'desc' },
      },
      consumptions: { orderBy: { consumedAt: 'desc' } },
    },
  })

  if (!material) {
    throw new Error('No se encontró el material solicitado')
  }

  return material
}

export interface CreateMaterialInput {
  name: string
  category: string
  color?: string
  finish?: string
  brand?: string
  supplierDefault?: string
  lowStockThresholdCm2?: number
  isInventoryTracked?: boolean
  purchaseUrl?: string
  sheetWidthCm?: number
  sheetHeightCm?: number
}

function validateMaterialInput(data: { name: string; category: string; lowStockThresholdCm2?: number }) {
  if (!data.name?.trim()) {
    throw new Error('El nombre del material es obligatorio')
  }
  if (!data.category?.trim()) {
    throw new Error('La categoría del material es obligatoria')
  }
  if (data.lowStockThresholdCm2 !== undefined && data.lowStockThresholdCm2 < 0) {
    throw new Error('El umbral de bajo stock no puede ser negativo')
  }
}

export async function createMaterial(data: CreateMaterialInput) {
  await requireSession()
  validateMaterialInput(data)

  const material = await prisma.material.create({
    data: {
      name: data.name.trim(),
      category: data.category.trim(),
      color: data.color?.trim() || undefined,
      finish: data.finish?.trim() || undefined,
      brand: data.brand?.trim() || undefined,
      supplierDefault: data.supplierDefault?.trim() || undefined,
      lowStockThresholdCm2: data.lowStockThresholdCm2 ?? 0,
      isInventoryTracked: data.isInventoryTracked ?? true,
      purchaseUrl: data.purchaseUrl?.trim() || undefined,
      sheetWidthCm: data.sheetWidthCm ?? undefined,
      sheetHeightCm: data.sheetHeightCm ?? undefined,
      totalAreaCm2: 0,
      totalValue: 0,
      weightedAverageCostPerCm2: 0,
      weightedAverageCostPerM2: 0,
    },
  })

  revalidatePath('/materiales')
  revalidatePath('/')

  return material
}

export interface UpdateMaterialInput {
  name?: string
  color?: string
  finish?: string
  brand?: string
  supplierDefault?: string
  lowStockThresholdCm2?: number
  isInventoryTracked?: boolean
  purchaseUrl?: string
  sheetWidthCm?: number | null
  sheetHeightCm?: number | null
}

export async function updateMaterial(id: string, data: UpdateMaterialInput) {
  await requireSession()
  if (data.name !== undefined && !data.name.trim()) {
    throw new Error('El nombre del material no puede quedar vacío')
  }
  if (data.lowStockThresholdCm2 !== undefined && data.lowStockThresholdCm2 < 0) {
    throw new Error('El umbral de bajo stock no puede ser negativo')
  }

  const material = await prisma.material.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.color !== undefined ? { color: data.color.trim() || null } : {}),
      ...(data.finish !== undefined ? { finish: data.finish.trim() || null } : {}),
      ...(data.brand !== undefined ? { brand: data.brand.trim() || null } : {}),
      ...(data.supplierDefault !== undefined ? { supplierDefault: data.supplierDefault.trim() || null } : {}),
      ...(data.lowStockThresholdCm2 !== undefined ? { lowStockThresholdCm2: data.lowStockThresholdCm2 } : {}),
      ...(data.isInventoryTracked !== undefined ? { isInventoryTracked: data.isInventoryTracked } : {}),
      ...(data.purchaseUrl !== undefined ? { purchaseUrl: data.purchaseUrl.trim() || null } : {}),
      ...(data.sheetWidthCm !== undefined ? { sheetWidthCm: data.sheetWidthCm } : {}),
      ...(data.sheetHeightCm !== undefined ? { sheetHeightCm: data.sheetHeightCm } : {}),
    },
  })

  revalidatePath('/materiales')
  revalidatePath('/')

  return material
}

export async function archiveMaterial(id: string) {
  await requireSession()
  const material = await prisma.material.update({
    where: { id },
    data: { isArchived: true },
  })

  revalidatePath('/materiales')
  revalidatePath('/')

  return material
}

export async function unarchiveMaterial(id: string) {
  await requireSession()
  const material = await prisma.material.update({
    where: { id },
    data: { isArchived: false },
  })

  revalidatePath('/materiales')
  revalidatePath('/')

  return material
}
