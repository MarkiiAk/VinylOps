'use server'

// Server actions de pagos (Payment) sobre un Order.
//
// Registra anticipos y liquidaciones con su fecha REAL de pago (paidAt),
// separada de la fecha de creación del pedido — necesario para contabilidad
// por semana de cobro real ("si abro la cotización el viernes y me paga
// hasta el martes de la siguiente semana, debería entrar en la contabilidad
// de la siguiente semana, no en la de esta"). No hay reporte semanal
// todavía (fuera de alcance por ahora), solo el registro.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

const PAYMENT_TYPES = ['Anticipo', 'Liquidacion']

export interface CreatePaymentInput {
  orderId: string
  amount: number
  type: 'Anticipo' | 'Liquidacion'
  paidAt?: Date
  notes?: string
}

export async function createPayment(input: CreatePaymentInput) {
  if (!input.orderId) {
    throw new Error('El pago debe estar ligado a un pedido')
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('El monto del pago debe ser mayor a cero')
  }
  if (!PAYMENT_TYPES.includes(input.type)) {
    throw new Error(`Tipo de pago inválido: ${input.type}`)
  }

  const order = await prisma.order.findUnique({ where: { id: input.orderId } })
  if (!order) {
    throw new Error('No se encontró el pedido al que se quiere registrar el pago')
  }

  const payment = await prisma.payment.create({
    data: {
      orderId: input.orderId,
      amount: input.amount,
      type: input.type,
      paidAt: input.paidAt ?? new Date(),
      notes: input.notes?.trim() || undefined,
    },
  })

  revalidatePath('/pedidos')
  revalidatePath(`/leads/${order.leadId}`)

  return payment
}

export async function listPaymentsByOrder(orderId: string) {
  return prisma.payment.findMany({
    where: { orderId },
    orderBy: { paidAt: 'desc' },
  })
}
