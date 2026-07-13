import { describe, expect, it } from 'vitest'
import {
  calculateAreaCm2,
  calculateDirectMaterialCost,
  calculateMaterialUsageCost,
  calculatePurchaseCostPerCm2,
  calculateWeightedAverageCost,
} from './engine'

describe('calculateAreaCm2', () => {
  it('multiplica ancho x alto x cantidad', () => {
    expect(calculateAreaCm2(10, 5, 2)).toBe(100)
  })

  it('usa quantity 1 por defecto', () => {
    expect(calculateAreaCm2(10, 5)).toBe(50)
  })
})

describe('calculatePurchaseCostPerCm2', () => {
  it('divide precio final entre area total', () => {
    expect(calculatePurchaseCostPerCm2(100, 1000)).toBe(0.1)
  })
})

describe('calculateWeightedAverageCost', () => {
  it('combina area/valor actuales con una compra nueva', () => {
    // Material con 1000cm2 acumulados a $0.03/cm2 (valor $30), entra una
    // compra nueva de 500cm2 por $20 (osea $0.04/cm2)
    const result = calculateWeightedAverageCost(1000, 30, 500, 20)

    expect(result.newTotalArea).toBe(1500)
    expect(result.newTotalValue).toBe(50)
    expect(result.newWeightedAverageCostPerCm2).toBeCloseTo(50 / 1500, 6)
  })

  it('devuelve 0 de costo promedio si el area total queda en 0', () => {
    const result = calculateWeightedAverageCost(0, 0, 0, 0)
    expect(result.newWeightedAverageCostPerCm2).toBe(0)
  })
})

describe('calculateMaterialUsageCost / calculateDirectMaterialCost', () => {
  it('calcula el costo de un uso individual', () => {
    expect(calculateMaterialUsageCost(1800, 0.03175)).toBeCloseTo(57.15, 2)
  })

  it('suma el costo de multiples usos de material', () => {
    const total = calculateDirectMaterialCost([
      { calculatedAreaCm2: 1800, weightedAverageCostPerCm2: 0.03175 },
      { calculatedAreaCm2: 1800, weightedAverageCostPerCm2: 0.04466 },
    ])

    expect(total).toBeCloseTo(137.538, 2)
  })
})
