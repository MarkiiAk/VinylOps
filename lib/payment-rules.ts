// Reglas de pagos (Fase 3, V1) — funciones puras, sin Prisma, para poder
// probarlas sin tocar la base de datos. Ver lib/actions/payments.ts para el
// punto donde se usan.
//
// OVERPAYMENT_MARKER vive aquí (no en lib/actions/payments.ts) porque un
// archivo 'use server' solo puede exportar funciones async — exportar una
// constante desde ahí rompe el build de Next ("The module has no exports at all").

/** Prefijo del mensaje de error cuando un pago excede el total del pedido sin confirmación — la UI lo detecta para mostrar un confirm y reintentar con allowOverpayment: true. */
export const OVERPAYMENT_MARKER = 'OVERPAYMENT_REQUIRES_CONFIRMATION'

export interface OverpaymentCheckInput {
  orderTotal: number
  alreadyPaid: number
  newAmount: number
  allowOverpayment: boolean
}

export interface OverpaymentCheckResult {
  projectedTotal: number
  isOverpayment: boolean
  /** true = el pago debe rechazarse (hay sobrepago y no vino confirmado). */
  blocked: boolean
}

/**
 * La suma de pagos de un pedido no debe superar su total sin confirmación
 * explícita — regla de negocio del dueño ("no mezclar ventas generadas con
 * dinero cobrado", "nunca debe substituirse silenciosamente").
 */
export function evaluateOverpayment(input: OverpaymentCheckInput): OverpaymentCheckResult {
  const projectedTotal = input.alreadyPaid + input.newAmount
  const isOverpayment = projectedTotal > input.orderTotal
  return {
    projectedTotal,
    isOverpayment,
    blocked: isOverpayment && !input.allowOverpayment,
  }
}
