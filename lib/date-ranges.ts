// Presets de rango de fecha reutilizados por /gastos y /reportes/financiero
// (Fase 4 y 5, V1): Hoy, Esta semana, Este mes, Mes anterior, Todos/Rango
// personalizado. Funciones puras para poder probarlas sin tocar el DOM ni
// Prisma.

export type DateRangePreset = 'hoy' | 'semana' | 'mes' | 'mesAnterior' | 'todos'

/** true si `date` cae dentro del preset de rango, evaluado contra `now` (para poder probarlo con una fecha fija). */
export function isDateInRange(date: Date, preset: DateRangePreset, now: Date = new Date()): boolean {
  if (preset === 'todos') return true

  if (preset === 'hoy') {
    return date.toDateString() === now.toDateString()
  }

  if (preset === 'semana') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
    return date >= start
  }

  if (preset === 'mes') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }

  // mesAnterior
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return date.getFullYear() === prevMonth.getFullYear() && date.getMonth() === prevMonth.getMonth()
}

/** Rango [from, to) explícito para un preset — útil para queries de Prisma (where: { date: { gte, lt } }). */
export function resolveDateRange(preset: DateRangePreset, now: Date = new Date()): { from: Date | null; to: Date | null } {
  if (preset === 'todos') return { from: null, to: null }

  if (preset === 'hoy') {
    const from = new Date(now)
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(to.getDate() + 1)
    return { from, to }
  }

  if (preset === 'semana') {
    const from = new Date(now)
    from.setDate(now.getDate() - now.getDay())
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(to.getDate() + 7)
    return { from, to }
  }

  if (preset === 'mes') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return { from, to }
  }

  // mesAnterior
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const to = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from, to }
}
