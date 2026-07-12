'use server'

// Server actions de configuración global (Settings). Es un modelo de fila
// única — si no existe ningún registro (primer arranque de la app), se crea
// con los defaults del schema.prisma.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

export async function getSettings() {
  const existing = await prisma.settings.findFirst()
  if (existing) return existing

  return prisma.settings.create({ data: {} })
}

export interface UpdateSettingsInput {
  currency?: string
  defaultComplexityFactor?: number
  defaultMinimumPricePerPiece?: number
  defaultMinimumJobPrice?: number
  defaultWastePercentage?: number
  premiumMultiplier?: number
  minimumAcceptableMultiplier?: number
  roundingRule?: string
  businessName?: string
  ownerName?: string
  theme?: string
}

function validateSettingsInput(data: UpdateSettingsInput) {
  if (data.defaultComplexityFactor !== undefined && data.defaultComplexityFactor <= 0) {
    throw new Error('El factor de complejidad por defecto debe ser mayor a cero')
  }
  if (data.defaultMinimumPricePerPiece !== undefined && data.defaultMinimumPricePerPiece < 0) {
    throw new Error('El precio mínimo por pieza por defecto no puede ser negativo')
  }
  if (data.defaultMinimumJobPrice !== undefined && data.defaultMinimumJobPrice < 0) {
    throw new Error('El precio mínimo por trabajo por defecto no puede ser negativo')
  }
  if (data.defaultWastePercentage !== undefined && data.defaultWastePercentage < 0) {
    throw new Error('El porcentaje de desperdicio por defecto no puede ser negativo')
  }
  if (data.premiumMultiplier !== undefined && data.premiumMultiplier <= 0) {
    throw new Error('El multiplicador premium debe ser mayor a cero')
  }
  if (data.minimumAcceptableMultiplier !== undefined && data.minimumAcceptableMultiplier <= 0) {
    throw new Error('El multiplicador mínimo aceptable debe ser mayor a cero')
  }
  if (data.roundingRule !== undefined && !['nearest10', 'nearest50', 'none'].includes(data.roundingRule)) {
    throw new Error('Regla de redondeo inválida')
  }
  if (data.businessName !== undefined && !data.businessName.trim()) {
    throw new Error('El nombre del negocio no puede quedar vacío')
  }
}

export async function updateSettings(data: UpdateSettingsInput) {
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
