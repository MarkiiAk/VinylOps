'use server'

// Configuración simple de días no laborables (Fase 3, V1) — usada por la
// regla de "3 días hábiles después de aprobar diseño" (ver
// lib/business-days.ts). Sin integración a calendario externo: solo una
// lista editable desde /configuracion.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { toDateKey } from '@/lib/business-days'

export async function listNonWorkingDays() {
  return prisma.nonWorkingDay.findMany({ orderBy: { date: 'asc' } })
}

/** Set de claves yyyy-mm-dd, listo para pasar a decideOrderDateUpdate/addBusinessDays. */
export async function listNonWorkingDateKeys(): Promise<Set<string>> {
  const days = await prisma.nonWorkingDay.findMany()
  return new Set(days.map((d) => toDateKey(d.date)))
}

export async function addNonWorkingDay(date: Date, label?: string) {
  await requireSession()
  const day = await prisma.nonWorkingDay.create({
    data: { date, label: label?.trim() || undefined },
  })

  revalidatePath('/configuracion')

  return day
}

export async function removeNonWorkingDay(id: string) {
  await requireSession()
  await prisma.nonWorkingDay.delete({ where: { id } })

  revalidatePath('/configuracion')
}
