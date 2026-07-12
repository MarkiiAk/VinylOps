import type { ComplexityFactorInputs, ComplexityFactorResult } from './types'

/**
 * Sugiere un factor de complejidad para una cotizacion a partir de
 * caracteristicas cualitativas del trabajo (tamano, tipografia, dificultad
 * de weeding, nivel de detalle, urgencia, riesgo de desperdicio, etc).
 *
 * Base = 3. Reglas y puntos medios documentados (el spec da rangos, no
 * numeros exactos, para "weeding alto" y "urgente"):
 * - weeding difficulty high: el spec da un rango +0.75 a +1 -> se usa el
 *   punto medio +0.875.
 * - urgency: el spec da un rango +0.5 a +1 -> se usa el punto medio +0.75.
 * El resto de las reglas usa el valor unico que da el spec.
 *
 * Devuelve el desglose (breakdown) para que la UI pueda explicar "por que
 * este factor" mostrando cada regla aplicada y su delta.
 */
export function suggestComplexityFactor(inputs: ComplexityFactorInputs): ComplexityFactorResult {
  const BASE = 3
  const breakdown: ComplexityFactorResult['breakdown'] = [{ label: 'Base', delta: BASE }]

  if (inputs.sizeCategory === 'medium') {
    breakdown.push({ label: 'Tamano mediano', delta: 0.25 })
  } else if (inputs.sizeCategory === 'small') {
    breakdown.push({ label: 'Tamano pequeno', delta: 0.5 })
  }

  if (inputs.fontType === 'script') {
    breakdown.push({ label: 'Tipografia script/cursiva', delta: 0.75 })
  } else if (inputs.fontType === 'thin') {
    breakdown.push({ label: 'Tipografia delgada', delta: 0.5 })
  } else if (inputs.fontType === 'boldSimple') {
    breakdown.push({ label: 'Tipografia bold simple', delta: 0 })
  }

  if (inputs.weedingDifficulty === 'medium') {
    breakdown.push({ label: 'Weeding medio', delta: 0.5 })
  } else if (inputs.weedingDifficulty === 'high') {
    // Spec: rango +0.75 a +1 -> punto medio documentado +0.875
    breakdown.push({ label: 'Weeding alto (punto medio de +0.75 a +1)', delta: 0.875 })
  }

  if (inputs.detailLevel === 'medium') {
    breakdown.push({ label: 'Detalle medio', delta: 0.25 })
  } else if (inputs.detailLevel === 'high') {
    breakdown.push({ label: 'Detalle alto', delta: 0.75 })
  }

  if (inputs.urgency) {
    // Spec: rango +0.5 a +1 -> punto medio documentado +0.75
    breakdown.push({ label: 'Urgencia (punto medio de +0.5 a +1)', delta: 0.75 })
  }

  if (inputs.firstTimeOrNewTechnique) {
    breakdown.push({ label: 'Primera vez / tecnica nueva', delta: 0.25 })
  }

  if (inputs.highWasteRisk) {
    breakdown.push({ label: 'Alto riesgo de desperdicio', delta: 0.5 })
  }

  const factor = breakdown.reduce((total, item) => total + item.delta, 0)

  return { factor, breakdown }
}
