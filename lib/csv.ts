// Utilidad de exportación CSV (Fase 5, V1) — sin librería externa, solo lo
// necesario para las tablas de detalle del reporte financiero y de gastos.

function escapeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Construye un CSV (con encabezados) a partir de un arreglo de objetos planos. Función pura, sin acceso al DOM. */
export function buildCsv<T extends Record<string, unknown>>(rows: T[], columns: { key: keyof T; label: string }[]): string {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(',')
  const lines = rows.map((row) => columns.map((c) => escapeCsvValue(row[c.key])).join(','))
  return [header, ...lines].join('\n')
}

/** Dispara la descarga de un CSV en el navegador — solo se usa en client components. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
