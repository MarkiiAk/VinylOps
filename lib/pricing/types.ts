// Tipos compartidos del motor de pricing de VinylOps.
// Estos tipos son deliberadamente independientes de los modelos de Prisma
// (Material, Quote, QuoteMaterialUsage) para que lib/pricing/ se mantenga
// como funciones puras sin dependencias de infraestructura. El mapeo entre
// los modelos de Prisma y estos inputs vive en la capa de servicios/route
// handlers, no aqui.

/** Regla de redondeo disponible para precios. */
export type RoundingRule = 'nearest10' | 'nearest50' | 'none'

/** Direccion del redondeo: al valor mas cercano, o siempre hacia arriba. */
export type RoundingDirection = 'nearest' | 'up'

/**
 * Uso de un material dentro de una cotizacion, ya con el area calculada
 * (ver calculateAreaCm2) y el costo promedio ponderado vigente del material
 * (Material.weightedAverageCostPerCm2 en el schema de Prisma).
 */
export interface MaterialUsageInput {
  areaCm2: number
  weightedAverageCostPerCm2: number
  /** Etiqueta opcional para mostrar el desglose en UI, ej. "Vinyl", "Transfer". */
  label?: string
}

/** Item de desglose de costo de materiales, para mostrar "de donde sale el costo". */
export interface MaterialCostBreakdownItem {
  label?: string
  cost: number
}

/** Estado acumulado de un material antes/despues de una nueva compra (costo promedio ponderado). */
export interface WeightedAverageCostResult {
  newTotalArea: number
  newTotalValue: number
  newWeightedAverageCostPerCm2: number
}

/** Categorias de complejidad usadas para sugerir el factor de una cotizacion. */
export interface ComplexityFactorInputs {
  sizeCategory?: 'large' | 'medium' | 'small'
  fontType?: 'boldSimple' | 'thin' | 'script'
  weedingDifficulty?: 'low' | 'medium' | 'high'
  detailLevel?: 'low' | 'medium' | 'high'
  urgency?: boolean
  firstTimeOrNewTechnique?: boolean
  highWasteRisk?: boolean
}

/** Item del desglose del factor de complejidad, para explicar el numero en UI. */
export interface ComplexityFactorBreakdownItem {
  label: string
  delta: number
}

export interface ComplexityFactorResult {
  factor: number
  breakdown: ComplexityFactorBreakdownItem[]
}

/** Input completo para calcular los tres precios de una cotizacion (calculado/recomendado/premium). */
export interface QuotePricingInput {
  materialUsages: MaterialUsageInput[]
  complexityFactor: number
  quantity: number
  minimumPricePerPiece: number
  minimumJobPrice: number
  roundingRule?: RoundingRule
  /** Multiplicador para el piso "minimo aceptable" respecto al precio recomendado. Default 0.90. */
  minimumAcceptableMultiplier?: number
  /** Multiplicador para el precio premium respecto al precio recomendado. Default 1.10. */
  premiumMultiplier?: number
}

export interface QuotePricingResult {
  directMaterialCost: number
  materialCostBreakdown: MaterialCostBreakdownItem[]
  calculatedPrice: number
  minimumByPiece: number
  minimumByJob: number
  guardrailsApplied: {
    byPiece: boolean
    byJob: boolean
  }
  minimumAcceptablePrice: number
  recommendedPrice: number
  premiumPrice: number
  unitPrices: {
    minimumAcceptable: number
    recommended: number
    premium: number
  }
  estimatedMarginAtRecommended: number
  estimatedMarginPercentAtRecommended: number
}
