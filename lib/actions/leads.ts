'use server'

// Server actions de Leads: catálogo de clientes de VinylOps. Un Lead es un
// contacto real de WhatsApp con su propio historial de pedidos (Order) a lo
// largo del tiempo — puede volver meses después con un pedido nuevo, y cada
// Order es independiente pero pertenece al mismo Lead.
//
// El status del Lead refleja la relación comercial (3 fases de vida +
// 2 excepciones): Contacto -> Ganado -> Cliente, con Pendiente ("en el
// limbo", le diste info pero no contestó) y Perdido (dijo que no) como
// salidas fuera de la línea principal. Es independiente del status de
// producción de sus pedidos (ver Order.status en lib/actions/orders.ts).

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'

export interface CreateLeadInput {
  name?: string
  phone?: string
  status?: string
  notes?: string
}

export interface UpdateLeadInput {
  name?: string | null
  phone?: string | null
  status?: string
  notes?: string | null
}

export async function listLeads() {
  return prisma.lead.findMany({
    orderBy: { updatedAt: 'desc' },
  })
}

export async function createLead(input: CreateLeadInput) {
  await requireSession()
  const lead = await prisma.lead.create({
    data: {
      name: input.name?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      status: input.status?.trim() || 'Contacto',
      notes: input.notes?.trim() || undefined,
    },
  })

  revalidatePath('/leads')

  return lead
}

export async function updateLead(id: string, input: UpdateLeadInput) {
  await requireSession()
  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name?.trim() || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
  })

  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)

  return lead
}

export async function deleteLead(id: string) {
  await requireSession()
  await prisma.lead.delete({ where: { id } })

  revalidatePath('/leads')
}

/** Lead + todo su historial de pedidos (orders), para /leads/[id]. */
export async function getLeadWithOrders(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      orders: {
        include: { lineItems: true, payments: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!lead) {
    throw new Error('No se encontró el lead solicitado')
  }

  return lead
}
