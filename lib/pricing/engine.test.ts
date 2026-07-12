import { describe, expect, it } from 'vitest'
import {
  calculateAreaCm2,
  calculateDirectMaterialCost,
  calculateMaterialUsageCost,
  calculatePurchaseCostPerCm2,
  calculateQuotePrices,
  calculateWeightedAverageCost,
  roundPrice,
  suggestComplexityFactor,
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

describe('roundPrice', () => {
  it('redondea al multiplo de 10 mas cercano', () => {
    expect(roundPrice(618.92, 'nearest10')).toBe(620)
  })

  it('redondea al multiplo de 50 mas cercano', () => {
    expect(roundPrice(557.03, 'nearest50')).toBe(550)
  })

  it('no modifica el valor cuando la regla es none', () => {
    expect(roundPrice(618.92, 'none')).toBe(618.92)
  })

  it('redondea hacia arriba cuando direction es up', () => {
    expect(roundPrice(611, 'nearest10', 'up')).toBe(620)
  })
})

describe('suggestComplexityFactor', () => {
  it('devuelve el factor base 3 sin ninguna caracteristica', () => {
    const result = suggestComplexityFactor({})
    expect(result.factor).toBe(3)
    expect(result.breakdown).toEqual([{ label: 'Base', delta: 3 }])
  })

  it('acumula deltas de tamano, tipografia y weeding', () => {
    const result = suggestComplexityFactor({
      sizeCategory: 'small',
      fontType: 'script',
      weedingDifficulty: 'high',
    })

    // 3 (base) + 0.5 (small) + 0.75 (script) + 0.875 (weeding high, punto medio)
    expect(result.factor).toBeCloseTo(5.125, 6)
    expect(result.breakdown).toHaveLength(4)
  })

  it('acumula urgencia, primera vez y alto riesgo de desperdicio', () => {
    const result = suggestComplexityFactor({
      urgency: true,
      firstTimeOrNewTechnique: true,
      highWasteRisk: true,
    })

    // 3 (base) + 0.75 (urgencia, punto medio) + 0.25 (primera vez) + 0.5 (waste)
    expect(result.factor).toBeCloseTo(4.5, 6)
  })

  it('tipografia bold simple no agrega delta', () => {
    const result = suggestComplexityFactor({ fontType: 'boldSimple' })
    expect(result.factor).toBe(3)
  })

  it('detalle medio y alto agregan sus deltas correspondientes', () => {
    expect(suggestComplexityFactor({ detailLevel: 'medium' }).factor).toBe(3.25)
    expect(suggestComplexityFactor({ detailLevel: 'high' }).factor).toBe(3.75)
  })
})

describe('calculateQuotePrices', () => {
  it('caso completo del spec: XV Regina, 65 etiquetas (vinyl + transfer)', () => {
    const result = calculateQuotePrices({
      materialUsages: [
        { areaCm2: 1800, weightedAverageCostPerCm2: 0.03175, label: 'Vinyl' },
        { areaCm2: 1800, weightedAverageCostPerCm2: 0.04466, label: 'Transfer' },
      ],
      complexityFactor: 4.5,
      quantity: 65,
      minimumPricePerPiece: 8,
      minimumJobPrice: 300,
    })

    expect(result.materialCostBreakdown[0].cost).toBeCloseTo(57.15, 2)
    expect(result.materialCostBreakdown[1].cost).toBeCloseTo(80.39, 1)
    expect(result.directMaterialCost).toBeCloseTo(137.54, 1)
    expect(result.calculatedPrice).toBeCloseTo(618.92, 1)
    expect(result.minimumByPiece).toBe(520)
    expect(result.minimumByJob).toBe(300)
    expect(result.recommendedPrice).toBe(620)
    expect(result.minimumAcceptablePrice).toBe(550)
    expect(result.premiumPrice).toBe(680)
    expect(result.guardrailsApplied.byPiece).toBe(false)
    expect(result.guardrailsApplied.byJob).toBe(false)
  })

  it('minimumByPiece eleva el precio recomendado cuando el calculado queda por debajo', () => {
    const result = calculateQuotePrices({
      materialUsages: [{ areaCm2: 100, weightedAverageCostPerCm2: 0.01 }],
      complexityFactor: 3,
      quantity: 50,
      minimumPricePerPiece: 10, // minimumByPiece = 500, muy por encima del calculatedPrice (~3)
      minimumJobPrice: 50,
    })

    expect(result.calculatedPrice).toBeCloseTo(3, 2)
    expect(result.minimumByPiece).toBe(500)
    expect(result.guardrailsApplied.byPiece).toBe(true)
    expect(result.guardrailsApplied.byJob).toBe(false)
    expect(result.recommendedPrice).toBe(500)
  })

  it('minimumByJob eleva el precio recomendado cuando gana sobre calculado y minimumByPiece', () => {
    const result = calculateQuotePrices({
      materialUsages: [{ areaCm2: 50, weightedAverageCostPerCm2: 0.01 }],
      complexityFactor: 3,
      quantity: 2,
      minimumPricePerPiece: 5, // minimumByPiece = 10
      minimumJobPrice: 300, // gana el trabajo minimo
    })

    expect(result.calculatedPrice).toBeCloseTo(1.5, 2)
    expect(result.minimumByPiece).toBe(10)
    expect(result.minimumByJob).toBe(300)
    expect(result.guardrailsApplied.byJob).toBe(true)
    expect(result.guardrailsApplied.byPiece).toBe(false)
    expect(result.recommendedPrice).toBe(300)
  })

  it('calcula margen estimado en el precio recomendado', () => {
    const result = calculateQuotePrices({
      materialUsages: [{ areaCm2: 1800, weightedAverageCostPerCm2: 0.03175 }],
      complexityFactor: 5,
      quantity: 10,
      minimumPricePerPiece: 1,
      minimumJobPrice: 10,
    })

    expect(result.estimatedMarginAtRecommended).toBeCloseTo(
      result.recommendedPrice - result.directMaterialCost,
      6
    )
    expect(result.estimatedMarginPercentAtRecommended).toBeCloseTo(
      (result.estimatedMarginAtRecommended / result.recommendedPrice) * 100,
      6
    )
  })
})
