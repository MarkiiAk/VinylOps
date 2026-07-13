'use server'

// Server actions de configuración global (Settings). Es un modelo de fila
// única — si no existe ningún registro (primer arranque de la app), se crea
// con los defaults del schema.prisma.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

export async function getSettings() {
  const existing = await prisma.settings.findFirst()
  if (existing) return existing

  return prisma.settings.create({ data: {} })
}

export interface UpdateSettingsInput {
  currency?: string
  businessName?: string
  ownerName?: string
  theme?: string
}

function validateSettingsInput(data: UpdateSettingsInput) {
  if (data.businessName !== undefined && !data.businessName.trim()) {
    throw new Error('El nombre del negocio no puede quedar vacío')
  }
}

export async function updateSettings(data: UpdateSettingsInput) {
  await requireSession()
  validateSettingsInput(data)

  const current = await getSettings()

  const updated = await prisma.settings.update({
    where: { id: current.id },
    data,
  })

  revalidatePath('/configuracion')
  revalidatePath('/')

  return updated
}
