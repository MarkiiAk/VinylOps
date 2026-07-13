import { describe, expect, it } from 'vitest'
import { evaluateOverpayment } from './payment-rules'

describe('evaluateOverpayment', () => {
  it('pago parcial (no llega al total): nunca bloquea', () => {
    const result = evaluateOverpayment({ orderTotal: 500, alreadyPaid: 0, newAmount: 200, allowOverpayment: false })
    expect(result.isOverpayment).toBe(false)
    expect(result.blocked).toBe(false)
    expect(result.projectedTotal).toBe(200)
  })

  it('pago que completa exacto el total: no es sobrepago', () => {
    const result = evaluateOverpayment({ orderTotal: 500, alreadyPaid: 300, newAmount: 200, allowOverpayment: false })
    expect(result.isOverpayment).toBe(false)
    expect(result.blocked).toBe(false)
  })

  it('sobrepago sin confirmación: se bloquea', () => {
    const result = evaluateOverpayment({ orderTotal: 500, alreadyPaid: 400, newAmount: 200, allowOverpayment: false })
    expect(result.isOverpayment).toBe(true)
    expect(result.blocked).toBe(true)
    expect(result.projectedTotal).toBe(600)
  })

  it('sobrepago CON confirmación explícita: no se bloquea', () => {
    const result = evaluateOverpayment({ orderTotal: 500, alreadyPaid: 400, newAmount: 200, allowOverpayment: true })
    expect(result.isOverpayment).toBe(true)
    expect(result.blocked).toBe(false)
  })
})
