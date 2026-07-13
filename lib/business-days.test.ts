import { describe, expect, it } from 'vitest'
import { addBusinessDays, computePromisedDeliveryDate, decideOrderDateUpdate, toDateKey } from './business-days'

// Fechas de referencia: julio 2026. 2026-07-06 es lunes, 2026-07-09 es
// jueves, 2026-07-10 es viernes (confirmado con toDateKey/getDay abajo).
function d(iso: string): Date {
  return new Date(`${iso}T09:00:00`)
}

describe('addBusinessDays / computePromisedDeliveryDate', () => {
  it('aprobación en lunes: martes=1, miércoles=2, jueves=3 -> compromiso jueves', () => {
    const monday = d('2026-07-06')
    expect(monday.getDay()).toBe(1)
    const result = computePromisedDeliveryDate(monday)
    expect(toDateKey(result)).toBe('2026-07-09') // jueves
  })

  it('aprobación en jueves: viernes=1, (fin de semana no cuenta), lunes=2, martes=3', () => {
    const thursday = d('2026-07-09')
    expect(thursday.getDay()).toBe(4)
    const result = computePromisedDeliveryDate(thursday)
    expect(toDateKey(result)).toBe('2026-07-14') // martes siguiente
  })

  it('aprobación en viernes: fin de semana no cuenta, lunes=1, martes=2, miércoles=3', () => {
    const friday = d('2026-07-10')
    expect(friday.getDay()).toBe(5)
    const result = computePromisedDeliveryDate(friday)
    expect(toDateKey(result)).toBe('2026-07-15') // miércoles siguiente
  })

  it('fin de semana en medio del conteo (aprobación miércoles)', () => {
    const wednesday = d('2026-07-08')
    expect(wednesday.getDay()).toBe(3)
    // jueves=1, viernes=2, (sab/dom no cuentan), lunes=3
    const result = computePromisedDeliveryDate(wednesday)
    expect(toDateKey(result)).toBe('2026-07-13') // lunes siguiente
  })

  it('día no laborable configurado en medio del conteo', () => {
    const monday = d('2026-07-06')
    // martes 7 configurado como no laborable -> martes no cuenta, miercoles=1, jueves=2, viernes=3
    const nonWorking = new Set(['2026-07-07'])
    const result = computePromisedDeliveryDate(monday, nonWorking)
    expect(toDateKey(result)).toBe('2026-07-10') // viernes
  })

  it('dos días no laborables consecutivos en medio del conteo', () => {
    const monday = d('2026-07-06')
    // martes 7 y miercoles 8 no laborables -> jueves=1, viernes=2, (finde no cuenta), lunes=3
    const nonWorking = new Set(['2026-07-07', '2026-07-08'])
    const result = computePromisedDeliveryDate(monday, nonWorking)
    expect(toDateKey(result)).toBe('2026-07-13') // lunes siguiente
  })

  it('si el día 3 cae en no laborable, sigue avanzando al siguiente día hábil', () => {
    const monday = d('2026-07-06')
    // jueves 9 (que sería el día 3) configurado como no laborable -> avanza a viernes
    const nonWorking = new Set(['2026-07-09'])
    const result = computePromisedDeliveryDate(monday, nonWorking)
    expect(toDateKey(result)).toBe('2026-07-10') // viernes
  })
})

describe('decideOrderDateUpdate: aprobación de diseño', () => {
  it('primera aprobación, sin fecha previa: calcula sola, sin pedir confirmación', () => {
    const now = d('2026-07-06')
    const result = decideOrderDateUpdate({
      newStatus: 'DisenoAprobado',
      order: { designApprovedAt: null, deliveryDate: null, deliveredAt: null },
      now,
    })

    expect(result.needsConfirmation).toBe(false)
    expect(result.designApprovedAt).toEqual(now)
    expect(toDateKey(result.deliveryDate!)).toBe('2026-07-09')
    expect(result.deliveryDateIsManual).toBe(false)
  })

  it('ya existe una fecha manual: NO la sobrescribe silenciosamente, pide confirmación', () => {
    const now = d('2026-07-06')
    const manualDate = d('2026-08-01')
    const result = decideOrderDateUpdate({
      newStatus: 'DisenoAprobado',
      order: { designApprovedAt: null, deliveryDate: manualDate, deliveredAt: null },
      now,
    })

    expect(result.needsConfirmation).toBe(true)
    expect(result.deliveryDate).toBeUndefined()
    // designApprovedAt sí se actualiza aunque la fecha compromiso no se toque.
    expect(result.designApprovedAt).toEqual(now)
  })

  it('fecha manual + confirmación explícita: sí recalcula', () => {
    const now = d('2026-07-06')
    const manualDate = d('2026-08-01')
    const result = decideOrderDateUpdate({
      newStatus: 'DisenoAprobado',
      order: { designApprovedAt: null, deliveryDate: manualDate, deliveredAt: null },
      now,
      confirmRecalculateDeliveryDate: true,
    })

    expect(result.needsConfirmation).toBe(false)
    expect(toDateKey(result.deliveryDate!)).toBe('2026-07-09')
    expect(result.deliveryDateIsManual).toBe(false)
  })

  it('re-aprobación (regresó a Diseñando y se re-aprueba): actualiza designApprovedAt, pide confirmación para la fecha', () => {
    const firstApproval = d('2026-07-01')
    const secondApproval = d('2026-07-06')
    const previouslyCalculatedDate = d('2026-07-04')

    const result = decideOrderDateUpdate({
      newStatus: 'DisenoAprobado',
      order: { designApprovedAt: firstApproval, deliveryDate: previouslyCalculatedDate, deliveredAt: null },
      now: secondApproval,
    })

    expect(result.designApprovedAt).toEqual(secondApproval)
    expect(result.needsConfirmation).toBe(true)
    expect(result.deliveryDate).toBeUndefined()
  })

  it('marcar Entregado guarda deliveredAt solo la primera vez', () => {
    const now = d('2026-07-06')
    const result = decideOrderDateUpdate({
      newStatus: 'Entregado',
      order: { designApprovedAt: d('2026-07-01'), deliveryDate: d('2026-07-04'), deliveredAt: null },
      now,
    })
    expect(result.deliveredAt).toEqual(now)

    const alreadyDelivered = decideOrderDateUpdate({
      newStatus: 'Entregado',
      order: { designApprovedAt: d('2026-07-01'), deliveryDate: d('2026-07-04'), deliveredAt: d('2026-07-05') },
      now,
    })
    expect(alreadyDelivered.deliveredAt).toBeUndefined()
  })

  it('otros cambios de status no tocan ninguna fecha', () => {
    const now = d('2026-07-06')
    const result = decideOrderDateUpdate({
      newStatus: 'Maquilando',
      order: { designApprovedAt: d('2026-07-01'), deliveryDate: d('2026-07-04'), deliveredAt: null },
      now,
    })
    expect(result).toEqual({ needsConfirmation: false })
  })
})

describe('addBusinessDays', () => {
  it('nunca cuenta sábado ni domingo', () => {
    const saturday = new Date('2026-07-11T09:00:00')
    const sunday = new Date('2026-07-12T09:00:00')
    // ninguno de los dos debe ser el resultado de sumar dias habiles desde el viernes anterior
    const result = addBusinessDays(new Date('2026-07-10T09:00:00'), 1)
    expect(toDateKey(result)).not.toBe(toDateKey(saturday))
    expect(toDateKey(result)).not.toBe(toDateKey(sunday))
  })
})
