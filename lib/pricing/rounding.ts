import type { RoundingDirection, RoundingRule } from './types'

/**
 * Redondea un precio segun la regla de negocio configurada en Settings.roundingRule.
 *
 * direction:
 * - 'nearest' (default): redondea al multiplo mas cercano (Math.round).
 * - 'up': siempre redondea hacia arriba (Math.ceil) — util para no cobrar de menos
 *   en precios premium o pisos minimos cuando se prefiere ese sesgo.
 *
 * rule === 'none' devuelve el valor sin modificar.
 */
export function roundPrice(
  value: number,
  rule: RoundingRule,
  direction: RoundingDirection = 'nearest'
): number {
  if (rule === 'none') return value

  const base = rule === 'nearest10' ? 10 : 50

  if (direction === 'up') {
    return Math.ceil(value / base) * base
  }

  return Math.round(value / base) * base
}
