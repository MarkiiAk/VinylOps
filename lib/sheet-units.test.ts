import { describe, expect, it } from 'vitest'
import { areaToSheets, costPerSheet, hasFixedSheet, sheetAreaCm2 } from './sheet-units'

const carta = { sheetWidthCm: 21.6, sheetHeightCm: 27.9 }
const noSheet = { sheetWidthCm: null, sheetHeightCm: null }

describe('hasFixedSheet', () => {
  it('true cuando ambas dimensiones existen', () => {
    expect(hasFixedSheet(carta)).toBe(true)
  })
  it('false cuando falta alguna dimension', () => {
    expect(hasFixedSheet(noSheet)).toBe(false)
    expect(hasFixedSheet({ sheetWidthCm: 21.6, sheetHeightCm: null })).toBe(false)
  })
})

describe('sheetAreaCm2', () => {
  it('multiplica ancho x alto', () => {
    expect(sheetAreaCm2(carta)).toBeCloseTo(602.64, 2)
  })
  it('da 0 sin dimensiones', () => {
    expect(sheetAreaCm2(noSheet)).toBe(0)
  })
})

describe('costPerSheet', () => {
  it('convierte costo por cm2 a costo por hoja', () => {
    expect(costPerSheet(0.05, carta)).toBeCloseTo(0.05 * 602.64, 4)
  })
})

describe('areaToSheets', () => {
  it('divide el area entre el area de una hoja', () => {
    expect(areaToSheets(602.64 * 3, carta)).toBeCloseTo(3, 6)
  })
  it('da 0 sin dimensiones (evita division entre cero)', () => {
    expect(areaToSheets(1000, noSheet)).toBe(0)
  })
})
