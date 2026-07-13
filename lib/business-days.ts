// Regla de negocio (Fase 3, V1): "3 días hábiles después de aprobar el
// diseño". El día de aprobación NUNCA cuenta como día 1 — se empieza a
// contar desde el día siguiente. Sábado y domingo nunca cuentan. Los días
// no laborables configurados (ver NonWorkingDay) tampoco cuentan. Si el
// día que cumpliría la cuenta cae en un día no laborable, se sigue
// avanzando al siguiente día hábil (esto sale gratis del algoritmo: solo
// se incrementa el contador en un día hábil, nunca en uno no hábil).
//
// Ejemplo del spec: aprobado lunes -> martes=día hábil 1, miércoles=día 2,
// jueves=día 3 -> compromiso=jueves.

/** yyyy-mm-dd en hora LOCAL (no UTC) — para comparar contra NonWorkingDay sin líos de zona horaria. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // domingo=0, sabado=6
}

export function isBusinessDay(date: Date, nonWorkingDates: Set<string>): boolean {
  if (isWeekend(date)) return false
  if (nonWorkingDates.has(toDateKey(date))) return false
  return true
}

/**
 * Suma `days` días HÁBILES a partir de `fromDate`, sin contar `fromDate`
 * mismo. `nonWorkingDates` es un Set de claves yyyy-mm-dd (ver toDateKey).
 */
export function addBusinessDays(fromDate: Date, days: number, nonWorkingDates: Set<string> = new Set()): Date {
  const cursor = new Date(fromDate)
  let counted = 0

  while (counted < days) {
    cursor.setDate(cursor.getDate() + 1)
    if (isBusinessDay(cursor, nonWorkingDates)) {
      counted++
    }
  }

  return cursor
}

/** Fecha compromiso = 3 días hábiles después de la aprobación de diseño. */
export function computePromisedDeliveryDate(designApprovedAt: Date, nonWorkingDates: Set<string> = new Set()): Date {
  return addBusinessDays(designApprovedAt, 3, nonWorkingDates)
}

export interface ApprovalDecisionInput {
  newStatus: string
  order: {
    designApprovedAt: Date | null
    deliveryDate: Date | null
    deliveredAt: Date | null
  }
  now: Date
  nonWorkingDates?: Set<string>
  /** true si la UI ya pidió confirmación explícita para (re)calcular la fecha compromiso sobre una que ya existía. */
  confirmRecalculateDeliveryDate?: boolean
}

export interface ApprovalDecisionResult {
  designApprovedAt?: Date
  deliveryDate?: Date
  deliveryDateIsManual?: boolean
  deliveredAt?: Date
  /** true = ya había una fecha compromiso y no se recalculó porque la UI no confirmó — debe preguntarle al usuario y reintentar con confirmRecalculateDeliveryDate=true. */
  needsConfirmation: boolean
}

/**
 * Decide qué campos de fecha actualizar en un Order al cambiar su status.
 * Función pura (sin Prisma) para poder probar la regla de días hábiles y el
 * manejo de re-aprobación/fecha manual sin tocar la base de datos — ver
 * updateOrderStatus en lib/actions/orders.ts, que solo aplica este resultado.
 */
export function decideOrderDateUpdate(input: ApprovalDecisionInput): ApprovalDecisionResult {
  const result: ApprovalDecisionResult = { needsConfirmation: false }

  if (input.newStatus === 'DisenoAprobado') {
    // designApprovedAt se actualiza SIEMPRE al (re)aprobar — primera vez o
    // regresión + re-aprobación, nunca se deja el valor viejo silenciosamente.
    result.designApprovedAt = input.now

    if (input.order.deliveryDate === null) {
      // Sin fecha compromiso todavía: se calcula libremente, sin preguntar.
      result.deliveryDate = computePromisedDeliveryDate(input.now, input.nonWorkingDates)
      result.deliveryDateIsManual = false
    } else if (input.confirmRecalculateDeliveryDate) {
      // Ya había fecha (manual o de una aprobación anterior) y la UI ya
      // confirmó explícitamente que se recalcule — nunca sucede en silencio.
      result.deliveryDate = computePromisedDeliveryDate(input.now, input.nonWorkingDates)
      result.deliveryDateIsManual = false
    } else {
      // Ya había fecha y no hay confirmación: no se toca, se marca para que
      // el caller le pregunte al usuario.
      result.needsConfirmation = true
    }
  }

  if (input.newStatus === 'Entregado' && input.order.deliveredAt === null) {
    result.deliveredAt = input.now
  }

  return result
}
