import type { WeightedAverageCostResult } from './types'

/**
 * Costo por cm2 de una compra individual: precio final pagado dividido entre
 * el area total comprada. No es el costo promedio ponderado del material
 * (ese lo calcula calculateWeightedAverageCost) — es el costo puntual de
 * ESA compra, insumo para actualizar el promedio ponderado.
 */
export function calculatePurchaseCostPerCm2(finalPrice: number, totalAreaCm2: number): number {
  return finalPrice / totalAreaCm2
}

/**
 * Actualiza el costo promedio ponderado por cm2 de un material cuando entra
 * una nueva compra, combinando el area/valor acumulados hasta ahora con el
 * area/valor de la compra nueva.
 *
 * addedValue es el valor monetario total de la compra nueva (finalPrice),
 * no el costo por cm2 — el peso lo da el area, no un promedio simple.
 */
export function calculateWeightedAverageCost(
  currentArea: number,
  currentValue: number,
  addedArea: number,
  addedValue: number
): WeightedAverageCostResult {
  const newTotalArea = currentArea + addedArea
  const newTotalValue = currentValue + addedValue
  const newWeightedAverageCostPerCm2 = newTotalArea > 0 ? newTotalValue / newTotalArea : 0

  return {
    newTotalArea,
    newTotalValue,
    newWeightedAverageCostPerCm2,
  }
}

/** Costo de un uso de material especifico dentro de una cotizacion: area consumida * costo promedio ponderado vigente. */
export function calculateMaterialUsageCost(areaCm2: number, weightedAverageCostPerCm2: number): number {
  return areaCm2 * weightedAverageCostPerCm2
}

/**
 * Costo directo total de materiales de una cotizacion: suma del costo de
 * cada uso de material (vinyl, transfer, etc.) que la compone.
 */
export function calculateDirectMaterialCost(
  materialUsages: Array<{ calculatedAreaCm2: number; weightedAverageCostPerCm2: number }>
): number {
  return materialUsages.reduce(
    (total, usage) => total + calculateMaterialUsageCost(usage.calculatedAreaCm2, usage.weightedAverageCostPerCm2),
    0
  )
}
