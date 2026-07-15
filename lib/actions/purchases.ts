'use server'

// Server actions de compras de material. `createPurchase` es la única vía
// autorizada para mover los acumulados de inventario de un Material hacia
// arriba (totalAreaCm2 / totalValue / weightedAverageCostPerCm2 /
// weightedAverageCostPerM2) — nunca se editan a mano desde materials.ts.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { calculateAreaCm2, calculatePurchaseCostPerCm2, calculateWeightedAverageCost } from '@/lib/pricing'

export interface PurchaseInput {
  materialId: string
  widthCm: number
  heightCm: number
  quantity: number
  grossPrice: number
  discount: number
  supplier?: string
  purchaseDate?: Date
  notes?: string
}

function validatePurchaseInput(input: PurchaseInput) {
  if (input.widthCm <= 0 || input.heightCm <= 0) {
    throw new Error('El ancho y el alto de la compra deben ser mayores a cero')
  }
  if (input.quantity <= 0) {
    throw new Error('La cantidad debe ser mayor a cero')
  }
  if (input.grossPrice <= 0) {
    throw new Error('El precio bruto debe ser mayor a cero')
  }
  if (input.discount < 0) {
    throw new Error('El descuento no puede ser negativo')
  }
  if (input.discount > input.grossPrice) {
    throw new Error('El descuento no puede ser mayor al precio bruto')
  }
}

function computePurchaseNumbers(input: PurchaseInput) {
  const finalPrice = input.grossPrice - input.discount
  const totalAreaCm2 = calculateAreaCm2(input.widthCm, input.heightCm, input.quantity)
  const costPerCm2 = calculatePurchaseCostPerCm2(finalPrice, totalAreaCm2)
  const costPerM2 = costPerCm2 * 10_000

  return { finalPrice, totalAreaCm2, costPerCm2, costPerM2 }
}

export interface PreviewPurchaseResult {
  totalAreaCm2: number
  finalPrice: number
  costPerCm2: number
  costPerM2: number
  currentWeightedAverageCostPerCm2: number
  projectedWeightedAverageCostPerCm2: number
  currentWeightedAverageCostPerM2: number
  projectedWeightedAverageCostPerM2: number
}

/** Calcula (sin escribir a DB) el efecto de una compra propuesta sobre el costo promedio ponderado del material. */
export async function previewPurchase(input: PurchaseInput): Promise<PreviewPurchaseResult> {
  validatePurchaseInput(input)

  const material = await prisma.material.findUnique({ where: { id: input.materialId } })
  if (!material) {
    throw new Error('No se encontró el material para esta compra')
  }

  const { finalPrice, totalAreaCm2, costPerCm2, costPerM2 } = computePurchaseNumbers(input)

  const weighted = calculateWeightedAverageCost(material.totalAreaCm2, material.totalValue, totalAreaCm2, finalPrice)

  return {
    totalAreaCm2,
    finalPrice,
    costPerCm2,
    costPerM2,
    currentWeightedAverageCostPerCm2: material.weightedAverageCostPerCm2,
    projectedWeightedAverageCostPerCm2: weighted.newWeightedAverageCostPerCm2,
    currentWeightedAverageCostPerM2: material.weightedAverageCostPerM2,
    projectedWeightedAverageCostPerM2: weighted.newWeightedAverageCostPerCm2 * 10_000,
  }
}

/** Crea la compra y actualiza los acumulados del material, en una transacción. */
export async function createPurchase(input: PurchaseInput) {
  await requireSession()
  validatePurchaseInput(input)

  const { finalPrice, totalAreaCm2, costPerCm2, costPerM2 } = computePurchaseNumbers(input)

  const result = await prisma.$transaction(async (tx) => {
    const material = await tx.material.findUnique({ where: { id: input.materialId } })
    if (!material) {
      throw new Error('No se encontró el material para esta compra')
    }

    const purchase = await tx.purchase.create({
      data: {
        materialId: input.materialId,
        supplier: input.supplier?.trim() || material.supplierDefault || undefined,
        widthCm: input.widthCm,
        heightCm: input.heightCm,
        quantity: input.quantity,
        grossPrice: input.grossPrice,
        discount: input.discount,
        finalPrice,
        totalAreaCm2,
        costPerCm2,
        costPerM2,
        purchaseDate: input.purchaseDate ?? new Date(),
        notes: input.notes?.trim() || undefined,
      },
    })

    const weighted = calculateWeightedAverageCost(material.totalAreaCm2, material.totalValue, totalAreaCm2, finalPrice)

    const updatedMaterial = await tx.material.update({
      where: { id: input.materialId },
      data: {
        totalAreaCm2: weighted.newTotalArea,
        totalValue: weighted.newTotalValue,
        weightedAverageCostPerCm2: weighted.newWeightedAverageCostPerCm2,
        weightedAverageCostPerM2: weighted.newWeightedAverageCostPerCm2 * 10_000,
      },
    })

    return { purchase, material: updatedMaterial }
  })

  revalidatePath('/materiales')
  revalidatePath('/')

  return result
}
