/**
 * Calcula el area total en cm2 de una pieza (o de N piezas identicas).
 *
 * quantity es opcional y por defecto 1 — se usa para casos donde el area de
 * una plancha/lote se calcula multiplicando el area unitaria por la cantidad
 * de piezas que caben o se producen (distinto del `quantity` de la cotizacion
 * completa, que se maneja aparte en calculateQuotePrices).
 */
export function calculateAreaCm2(widthCm: number, heightCm: number, quantity: number = 1): number {
  return widthCm * heightCm * quantity
}
