// Tipos del motor de costeo de compras de VinylOps (ver nota en engine.ts:
// solo sobrevive el área+costo ponderado de Purchase, el resto del motor
// original de pricing por área+complejidad se retiró en Fase 6, V1).

/** Estado acumulado de un material antes/despues de una nueva compra (costo promedio ponderado). */
export interface WeightedAverageCostResult {
  newTotalArea: number
  newTotalValue: number
  newWeightedAverageCostPerCm2: number
}
