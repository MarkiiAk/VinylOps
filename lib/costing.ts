// Motor de costeo del modelo financiero V1 (Fase 2).
//
// Formulas oficiales — NO modificar sin actualizar tambien esta nota y el
// spec que las origino. Todas las divisiones estan protegidas contra cero
// (devuelven 0 en vez de NaN/Infinity cuando el denominador es 0).
//
//   Costo directo unitario = Material + Tinta + Luz + Desgaste + Merma + Bolsa + Etiquetita
//   Costo directo total    = Costo directo unitario * Cantidad
//   Ganancia bruta         = Total vendido - Costo directo total
//   Margen bruto           = Ganancia bruta / Total vendido
//   Ganancia despues de mano de obra = Ganancia bruta - Mano de obra total
//   Margen despues de mano de obra   = Ganancia despues de mano de obra / Total vendido
//
// Los valores que persisten en OrderLineItem son el SNAPSHOT congelado al
// momento de crear el pedido: no se recalculan despues aunque cambie el
// catalogo, el costo de un material, o el precio de venta.

/**
 * Redondeo de PERSISTENCIA: a 6 decimales, solo para eliminar ruido de punto
 * flotante (ej. 0.1 + 0.2 = 0.30000000000000004), sin perder precision real
 * de negocio. NO usar para mostrar al usuario.
 */
export function roundForStorage(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 1e6) / 1e6
}

/** Redondeo de VISUALIZACION: 2 decimales, solo para mostrar en UI/reportes. */
export function roundForDisplay(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

/** division segura: devuelve 0 en vez de NaN/Infinity cuando el denominador es 0. */
function safeDiv(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return numerator / denominator
}

export interface UnitCostBreakdown {
  unitMaterialCost: number
  unitInkCost: number
  unitElectricityCost: number
  unitWearCost: number
  unitWasteCost: number
  unitBagCost: number
  unitLabelCost: number
}

/** Costo directo unitario = suma de los 7 componentes de costo. */
export function computeUnitDirectCost(costs: UnitCostBreakdown): number {
  const total =
    costs.unitMaterialCost +
    costs.unitInkCost +
    costs.unitElectricityCost +
    costs.unitWearCost +
    costs.unitWasteCost +
    costs.unitBagCost +
    costs.unitLabelCost
  return roundForStorage(total)
}

export interface LineSnapshotInput extends UnitCostBreakdown {
  quantity: number
  lineTotal: number
  estimatedUnitLabor: number
}

export interface LineSnapshot extends UnitCostBreakdown {
  unitDirectCost: number
  totalDirectCost: number
  estimatedUnitLabor: number
  totalLabor: number
  lineGrossProfit: number
  lineGrossMargin: number
  profitAfterLabor: number
  marginAfterLabor: number
}

/** Snapshot financiero completo de una linea, listo para congelar en OrderLineItem. */
export function computeLineSnapshot(input: LineSnapshotInput): LineSnapshot {
  const unitDirectCost = computeUnitDirectCost(input)
  // Bolsa y etiquetita son un costo de EMPAQUE de la línea, no un costo POR
  // UNIDAD: si vendes 3 de lo mismo en una línea, siguen siendo 1 bolsa y 1
  // etiquetita, no 3 — a diferencia de material/tinta/luz/desgaste/merma,
  // que sí escalan con la cantidad (feedback real del dueño: "para un
  // carrito se usa UNA bolsita y UNA etiquetita no 3 bolsas"). unitDirectCost
  // (arriba) no cambia — sigue siendo el costo de referencia si se vendiera
  // 1 sola unidad (lo usa el costeo de catálogo, ver lib/actions/catalog.ts).
  const scalingUnitCost =
    input.unitMaterialCost +
    input.unitInkCost +
    input.unitElectricityCost +
    input.unitWearCost +
    input.unitWasteCost
  const totalDirectCost = roundForStorage(scalingUnitCost * input.quantity + input.unitBagCost + input.unitLabelCost)
  const totalLabor = roundForStorage(input.estimatedUnitLabor * input.quantity)

  const lineGrossProfit = roundForStorage(input.lineTotal - totalDirectCost)
  const lineGrossMargin = roundForStorage(safeDiv(lineGrossProfit, input.lineTotal))

  const profitAfterLabor = roundForStorage(lineGrossProfit - totalLabor)
  const marginAfterLabor = roundForStorage(safeDiv(profitAfterLabor, input.lineTotal))

  return {
    unitMaterialCost: roundForStorage(input.unitMaterialCost),
    unitInkCost: roundForStorage(input.unitInkCost),
    unitElectricityCost: roundForStorage(input.unitElectricityCost),
    unitWearCost: roundForStorage(input.unitWearCost),
    unitWasteCost: roundForStorage(input.unitWasteCost),
    unitBagCost: roundForStorage(input.unitBagCost),
    unitLabelCost: roundForStorage(input.unitLabelCost),
    unitDirectCost,
    totalDirectCost,
    estimatedUnitLabor: roundForStorage(input.estimatedUnitLabor),
    totalLabor,
    lineGrossProfit,
    lineGrossMargin,
    profitAfterLabor,
    marginAfterLabor,
  }
}

export interface KitComponentLike {
  quantity: number
  componentItem: { unitPrice: number }
}

/** Precio normal equivalente = suma de (precio de venta de cada componente * cantidad). */
export function computeKitEquivalentPrice(components: KitComponentLike[]): number {
  return roundForStorage(components.reduce((sum, c) => sum + c.componentItem.unitPrice * c.quantity, 0))
}

export interface KitSavings {
  equivalentPrice: number
  savingsAbsolute: number
  savingsPercentage: number
}

/** Ahorro absoluto y porcentual del kit vs. comprar sus componentes por separado. */
export function computeKitSavings(kitPrice: number, components: KitComponentLike[]): KitSavings {
  const equivalentPrice = computeKitEquivalentPrice(components)
  const savingsAbsolute = roundForStorage(equivalentPrice - kitPrice)
  const savingsPercentage = roundForStorage(safeDiv(savingsAbsolute, equivalentPrice))

  return { equivalentPrice, savingsAbsolute, savingsPercentage }
}

export interface KitComponentCosts {
  materialCostPerUnit: number
  inkCostPerUnit: number
  electricityCostPerUnit: number
  wearCostPerUnit: number
  wasteCostPerUnit: number
  laborCostPerUnit: number
}

export interface KitCostComponent {
  quantity: number
  componentItem: KitComponentCosts
}

/**
 * Costos de un kit (material/tinta/luz/desgaste/merma/mano de obra),
 * DERIVADOS sumando esos mismos campos de cada componente * su cantidad en
 * el kit — regla de negocio explícita: "si mañana cambia el costo de un
 * producto, el kit debe recalcularse automáticamente a partir de su
 * receta", nunca duplicar esos valores a mano en el propio kit. bolsa/
 * etiquetita NO se derivan aquí: son costos propios del kit (una bolsa y
 * una etiquetita compartidas, no una por componente) — ver
 * bagCostPerUnit/labelCostPerUnit en CatalogItem.
 */
export function deriveKitCosts(components: KitCostComponent[]): KitComponentCosts {
  const totals = components.reduce(
    (acc, c) => ({
      materialCostPerUnit: acc.materialCostPerUnit + c.componentItem.materialCostPerUnit * c.quantity,
      inkCostPerUnit: acc.inkCostPerUnit + c.componentItem.inkCostPerUnit * c.quantity,
      electricityCostPerUnit: acc.electricityCostPerUnit + c.componentItem.electricityCostPerUnit * c.quantity,
      wearCostPerUnit: acc.wearCostPerUnit + c.componentItem.wearCostPerUnit * c.quantity,
      wasteCostPerUnit: acc.wasteCostPerUnit + c.componentItem.wasteCostPerUnit * c.quantity,
      laborCostPerUnit: acc.laborCostPerUnit + c.componentItem.laborCostPerUnit * c.quantity,
    }),
    {
      materialCostPerUnit: 0,
      inkCostPerUnit: 0,
      electricityCostPerUnit: 0,
      wearCostPerUnit: 0,
      wasteCostPerUnit: 0,
      laborCostPerUnit: 0,
    }
  )

  return {
    materialCostPerUnit: roundForStorage(totals.materialCostPerUnit),
    inkCostPerUnit: roundForStorage(totals.inkCostPerUnit),
    electricityCostPerUnit: roundForStorage(totals.electricityCostPerUnit),
    wearCostPerUnit: roundForStorage(totals.wearCostPerUnit),
    wasteCostPerUnit: roundForStorage(totals.wasteCostPerUnit),
    laborCostPerUnit: roundForStorage(totals.laborCostPerUnit),
  }
}

export interface MaterialRecipeLine {
  materialId: string
  areaCm2PerUnit: number
}

export interface ComponentWithRecipe {
  quantity: number
  componentItem: { materials: MaterialRecipeLine[] }
}

/**
 * Receta de materiales de un kit, DERIVADA de sus componentes (no se edita a
 * mano): suma, para cada material, el area por unidad de cada componente *
 * la cantidad de ese componente en el kit. Evita que la receta del kit se
 * desincronice de sus componentes (causa raiz de la inconsistencia detectada
 * en los datos reales de Kit Premium — ver V1_IMPLEMENTATION_REPORT.md).
 */
export function deriveKitMaterialRecipe(components: ComponentWithRecipe[]): MaterialRecipeLine[] {
  const totals = new Map<string, number>()

  for (const component of components) {
    for (const line of component.componentItem.materials) {
      const current = totals.get(line.materialId) ?? 0
      totals.set(line.materialId, current + line.areaCm2PerUnit * component.quantity)
    }
  }

  return Array.from(totals.entries()).map(([materialId, areaCm2PerUnit]) => ({
    materialId,
    areaCm2PerUnit: roundForStorage(areaCm2PerUnit),
  }))
}
