import { describe, expect, it } from 'vitest'
import { buildCsv } from './csv'

describe('buildCsv', () => {
  it('genera encabezado y filas separadas por coma', () => {
    const csv = buildCsv(
      [
        { name: 'Ana', amount: 100 },
        { name: 'Beto', amount: 200 },
      ],
      [
        { key: 'name', label: 'Nombre' },
        { key: 'amount', label: 'Monto' },
      ]
    )
    expect(csv).toBe('Nombre,Monto\nAna,100\nBeto,200')
  })

  it('escapa valores con comas, comillas o saltos de línea', () => {
    const csv = buildCsv(
      [{ note: 'Hola, "mundo"\nsegunda línea' }],
      [{ key: 'note', label: 'Nota' }]
    )
    expect(csv).toBe('Nota\n"Hola, ""mundo""\nsegunda línea"')
  })
})
