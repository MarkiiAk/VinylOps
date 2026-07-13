import { describe, expect, it } from 'vitest'
import { isDateInRange, resolveDateRange } from './date-ranges'

const NOW = new Date('2026-07-15T10:00:00') // miercoles

describe('isDateInRange', () => {
  it('todos: siempre true', () => {
    expect(isDateInRange(new Date('2020-01-01'), 'todos', NOW)).toBe(true)
  })

  it('hoy: solo el mismo dia', () => {
    expect(isDateInRange(new Date('2026-07-15T23:00:00'), 'hoy', NOW)).toBe(true)
    expect(isDateInRange(new Date('2026-07-14T23:00:00'), 'hoy', NOW)).toBe(false)
  })

  it('semana: desde el domingo de esta semana en adelante', () => {
    // NOW es miercoles 15; el domingo de esa semana es 2026-07-12
    expect(isDateInRange(new Date('2026-07-12T00:00:00'), 'semana', NOW)).toBe(true)
    expect(isDateInRange(new Date('2026-07-11T23:00:00'), 'semana', NOW)).toBe(false)
  })

  it('mes: mismo mes y anio', () => {
    expect(isDateInRange(new Date('2026-07-01T12:00:00'), 'mes', NOW)).toBe(true)
    expect(isDateInRange(new Date('2026-06-30T12:00:00'), 'mes', NOW)).toBe(false)
  })

  it('mesAnterior: mes calendario anterior', () => {
    expect(isDateInRange(new Date('2026-06-15T12:00:00'), 'mesAnterior', NOW)).toBe(true)
    expect(isDateInRange(new Date('2026-07-01T12:00:00'), 'mesAnterior', NOW)).toBe(false)
  })
})

describe('resolveDateRange', () => {
  it('todos: sin limites', () => {
    expect(resolveDateRange('todos', NOW)).toEqual({ from: null, to: null })
  })

  it('mes: primer y ultimo dia del mes actual', () => {
    const { from, to } = resolveDateRange('mes', NOW)
    expect(from?.toISOString().slice(0, 10)).toBe('2026-07-01')
    expect(to?.toISOString().slice(0, 10)).toBe('2026-08-01')
  })
})
