import { describe, expect, it } from 'vitest'
import {
  computeKitSavings,
  computeLineSnapshot,
  computeUnitDirectCost,
  deriveKitCosts,
  deriveKitMaterialRecipe,
} from './costing'

describe('computeUnitDirectCost', () => {
  it('suma los 7 componentes de costo granular', () => {
    const cost = computeUnitDirectCost({
      unitMaterialCost: 2,
      unitInkCost: 0.5,
      unitElectricityCost: 0.2,
      unitWearCost: 0.1,
      unitWasteCost: 0.15,
      unitBagCost: 1,
      unitLabelCost: 0.3,
    })
    expect(cost).toBeCloseTo(4.25, 6)
  })
})

describe('computeLineSnapshot — ganancia bruta y margen', () => {
  it('calcula ganancia bruta, margen bruto, ganancia y margen después de mano de obra', () => {
    const snapshot = computeLineSnapshot({
      unitMaterialCost: 5,
      unitInkCost: 1,
      unitElectricityCost: 0.5,
      unitWearCost: 0.2,
      unitWasteCost: 0.3,
      unitBagCost: 1,
      unitLabelCost: 0.5,
      estimatedUnitLabor: 3,
      quantity: 2,
      lineTotal: 100, // 2 unidades a $50
    })

    // costo directo unitario = 5+1+0.5+0.2+0.3+1+0.5 = 8.5; total = 17
    expect(snapshot.unitDirectCost).toBeCloseTo(8.5, 6)
    expect(snapshot.totalDirectCost).toBeCloseTo(17, 6)
    expect(snapshot.lineGrossProfit).toBeCloseTo(83, 6) // 100 - 17
    expect(snapshot.lineGrossMargin).toBeCloseTo(0.83, 6)

    // mano de obra total = 3*2 = 6; ganancia c/mano = 83-6=77; margen = 0.77
    expect(snapshot.totalLabor).toBeCloseTo(6, 6)
    expect(snapshot.profitAfterLabor).toBeCloseTo(77, 6)
    expect(snapshot.marginAfterLabor).toBeCloseTo(0.77, 6)
  })

  it('protege contra división entre cero cuando lineTotal es 0', () => {
    const snapshot = computeLineSnapshot({
      unitMaterialCost: 1,
      unitInkCost: 0,
      unitElectricityCost: 0,
      unitWearCost: 0,
      unitWasteCost: 0,
      unitBagCost: 0,
      unitLabelCost: 0,
      estimatedUnitLabor: 0,
      quantity: 1,
      lineTotal: 0,
    })

    expect(snapshot.lineGrossMargin).toBe(0)
    expect(snapshot.marginAfterLabor).toBe(0)
    expect(Number.isFinite(snapshot.lineGrossMargin)).toBe(true)
    expect(Number.isFinite(snapshot.marginAfterLabor)).toBe(true)
  })
})

describe('computeLineSnapshot — línea manual ("Otro")', () => {
  it('con material declarado: el costo de material congela un valor > 0', () => {
    const snapshot = computeLineSnapshot({
      unitMaterialCost: 12.5, // ej. area declarada * costo vigente del material / cantidad
      unitInkCost: 0,
      unitElectricityCost: 0,
      unitWearCost: 0,
      unitWasteCost: 0,
      unitBagCost: 0,
      unitLabelCost: 0,
      estimatedUnitLabor: 0,
      quantity: 1,
      lineTotal: 50,
    })

    expect(snapshot.unitMaterialCost).toBeCloseTo(12.5, 6)
    expect(snapshot.unitDirectCost).toBeCloseTo(12.5, 6)
    expect(snapshot.lineGrossProfit).toBeCloseTo(37.5, 6)
  })

  it('sin material declarado: costo de material 0, la ganancia se calcula igual sin NaN', () => {
    const snapshot = computeLineSnapshot({
      unitMaterialCost: 0,
      unitInkCost: 0,
      unitElectricityCost: 0,
      unitWearCost: 0,
      unitWasteCost: 0,
      unitBagCost: 0,
      unitLabelCost: 0,
      estimatedUnitLabor: 0,
      quantity: 1,
      lineTotal: 50,
    })

    expect(snapshot.unitDirectCost).toBe(0)
    expect(snapshot.lineGrossProfit).toBe(50)
    expect(snapshot.lineGrossMargin).toBe(1)
  })
})

describe('snapshot congelado: inmutable ante cambios posteriores', () => {
  it('un snapshot ya calculado no se ve afectado por un cálculo posterior con otros costos', () => {
    // Analogo puro de "cambiar el catálogo/costo de un material después no
    // debe alterar ventas históricas": el snapshot es un objeto de datos
    // calculado una sola vez a partir de los valores vigentes en ESE
    // momento (ver freezeLineItemSnapshot / createOrder en
    // lib/actions/orders.ts) y nunca se vuelve a derivar de la fila viva de
    // CatalogItem/Material — por diseño no hay ninguna referencia que
    // pueda mutarlo después.
    const original = computeLineSnapshot({
      unitMaterialCost: 5,
      unitInkCost: 1,
      unitElectricityCost: 0,
      unitWearCost: 0,
      unitWasteCost: 0,
      unitBagCost: 0,
      unitLabelCost: 0,
      estimatedUnitLabor: 0,
      quantity: 1,
      lineTotal: 50,
    })
    const snapshotAtSaleTime = { ...original }

    // "el material subió de costo" / "el catálogo cambió de precio" después
    computeLineSnapshot({
      unitMaterialCost: 999,
      unitInkCost: 999,
      unitElectricityCost: 0,
      unitWearCost: 0,
      unitWasteCost: 0,
      unitBagCost: 0,
      unitLabelCost: 0,
      estimatedUnitLabor: 0,
      quantity: 1,
      lineTotal: 999,
    })

    expect(original).toEqual(snapshotAtSaleTime)
  })
})

describe('kits: empaque compartido y ahorro', () => {
  it('la bolsa y la etiquetita del kit se cuentan UNA vez (no por componente)', () => {
    // Un kit con 5 componentes pero bagCostPerUnit/labelCostPerUnit fijos en
    // el propio CatalogItem del kit (no multiplicados por el numero de
    // componentes) — ver GranularCostInput en lib/actions/catalog.ts.
    const snapshot = computeLineSnapshot({
      unitMaterialCost: 10,
      unitInkCost: 0,
      unitElectricityCost: 0,
      unitWearCost: 0,
      unitWasteCost: 0,
      unitBagCost: 3, // 1 bolsa compartida
      unitLabelCost: 1, // 1 etiquetita compartida
      estimatedUnitLabor: 0,
      quantity: 1,
      lineTotal: 349,
    })

    expect(snapshot.unitBagCost).toBe(3)
    expect(snapshot.unitLabelCost).toBe(1)
    expect(snapshot.unitDirectCost).toBe(14) // 10+3+1, no se multiplica por componentes
  })

  it('Kit Básico: precio equivalente y ahorro con los componentes y precios reales (2026-07)', () => {
    // 3 cuadernos + 2 lápices + 1 útiles ($39 c/u) + 0.5 DTF textil ($99) + 0.5 DTF UV ($119)
    const components = [
      { quantity: 3, componentItem: { unitPrice: 39 } },
      { quantity: 2, componentItem: { unitPrice: 39 } },
      { quantity: 1, componentItem: { unitPrice: 39 } },
      { quantity: 0.5, componentItem: { unitPrice: 99 } },
      { quantity: 0.5, componentItem: { unitPrice: 119 } },
    ]
    const savings = computeKitSavings(349, components)

    // OJO: con los precios oficiales (2026-07) el Kit Básico NO es más
    // barato que comprar todo por separado ($343) — el "ahorro" da -$6.
    // Esto es un hallazgo real de negocio (ver V1_IMPLEMENTATION_REPORT.md),
    // no un error de la fórmula: se deja el test fiel al dato oficial en vez
    // de forzar un resultado "bonito".
    expect(savings.equivalentPrice).toBeCloseTo(6 * 39 + 0.5 * 99 + 0.5 * 119, 6)
    expect(savings.savingsAbsolute).toBeCloseTo(savings.equivalentPrice - 349, 6)
    expect(savings.savingsAbsolute).toBeCloseTo(-6, 6)
  })

  it('Kit Premium: precio equivalente y ahorro con los componentes y precios reales (2026-07)', () => {
    // 4 cuadernos + 3 lápices + 1 útiles ($39 c/u) + 1 silueta ($49) + 1 DTF
    // textil ($99) + 1 DTF UV ($119) + 1 identificador rectangular una cara ($79)
    const components = [
      { quantity: 4, componentItem: { unitPrice: 39 } },
      { quantity: 3, componentItem: { unitPrice: 39 } },
      { quantity: 1, componentItem: { unitPrice: 39 } },
      { quantity: 1, componentItem: { unitPrice: 49 } },
      { quantity: 1, componentItem: { unitPrice: 99 } },
      { quantity: 1, componentItem: { unitPrice: 119 } },
      { quantity: 1, componentItem: { unitPrice: 79 } },
    ]
    const savings = computeKitSavings(449, components)

    expect(savings.equivalentPrice).toBeCloseTo(8 * 39 + 49 + 99 + 119 + 79, 6)
    expect(savings.savingsAbsolute).toBeCloseTo(savings.equivalentPrice - 449, 6)
    expect(savings.savingsAbsolute).toBeGreaterThan(0)
  })

  it('deriveKitCosts: Kit Básico deriva material/tinta/luz/desgaste/merma/mano de obra oficiales (2026-07)', () => {
    const cuadernos = { materialCostPerUnit: 3.84, inkCostPerUnit: 1, electricityCostPerUnit: 0.25, wearCostPerUnit: 1, wasteCostPerUnit: 0.75, laborCostPerUnit: 4 }
    const lapices = cuadernos
    const utiles = cuadernos
    const textiles = { materialCostPerUnit: 17.5, inkCostPerUnit: 0, electricityCostPerUnit: 0, wearCostPerUnit: 0, wasteCostPerUnit: 1, laborCostPerUnit: 4 }
    const agua = { materialCostPerUnit: 35, inkCostPerUnit: 0, electricityCostPerUnit: 0, wearCostPerUnit: 0, wasteCostPerUnit: 1, laborCostPerUnit: 4 }

    const derived = deriveKitCosts([
      { quantity: 3, componentItem: cuadernos },
      { quantity: 2, componentItem: lapices },
      { quantity: 1, componentItem: utiles },
      { quantity: 0.5, componentItem: textiles },
      { quantity: 0.5, componentItem: agua },
    ])

    expect(derived.materialCostPerUnit).toBeCloseTo(3.84 * 6 + 17.5 * 0.5 + 35 * 0.5, 6)
    expect(derived.inkCostPerUnit).toBeCloseTo(6, 6)
    expect(derived.electricityCostPerUnit).toBeCloseTo(1.5, 6)
    expect(derived.wearCostPerUnit).toBeCloseTo(6, 6)
    expect(derived.wasteCostPerUnit).toBeCloseTo(5.5, 6)
    expect(derived.laborCostPerUnit).toBeCloseTo(28, 6)

    // Costo directo del kit = derivado + bolsa (0.49) + etiquetita (0.21) propias del kit.
    const unitDirectCost = computeUnitDirectCost({
      unitMaterialCost: derived.materialCostPerUnit,
      unitInkCost: derived.inkCostPerUnit,
      unitElectricityCost: derived.electricityCostPerUnit,
      unitWearCost: derived.wearCostPerUnit,
      unitWasteCost: derived.wasteCostPerUnit,
      unitBagCost: 0.49,
      unitLabelCost: 0.21,
    })
    expect(unitDirectCost).toBeCloseTo(68.99, 6)
  })

  it('deriveKitMaterialRecipe suma el consumo de materiales de cada componente * su cantidad', () => {
    const recipe = deriveKitMaterialRecipe([
      { quantity: 2, componentItem: { materials: [{ materialId: 'sticker', areaCm2PerUnit: 100 }] } },
      { quantity: 0.5, componentItem: { materials: [{ materialId: 'dtf', areaCm2PerUnit: 1450 }] } },
      { quantity: 1, componentItem: { materials: [{ materialId: 'sticker', areaCm2PerUnit: 50 }] } },
    ])

    const sticker = recipe.find((r) => r.materialId === 'sticker')
    const dtf = recipe.find((r) => r.materialId === 'dtf')

    expect(sticker?.areaCm2PerUnit).toBeCloseTo(250, 6) // 2*100 + 1*50
    expect(dtf?.areaCm2PerUnit).toBeCloseTo(725, 6) // 0.5*1450
  })
})
