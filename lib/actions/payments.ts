'use server'

// Server actions de pagos (Payment) sobre un Order.
//
// Registra anticipos y liquidaciones con su fecha REAL de pago (paidAt),
// separada de la fecha de creación del pedido — necesario para contabilidad
// por semana de cobro real ("si abro la cotización el viernes y me paga
// hasta el martes de la siguiente semana, debería entrar en la contabilidad
// de la siguiente semana, no en la de esta"). No hay reporte semanal
// todavía (fuera de alcance por ahora), solo el registro.
//
// FASE 3 (V1): protección contra sobrepago — la suma de pagos de un pedido
// no debe superar su total sin confirmación explícita (allowOverpayment).

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { evaluateOverpayment, OVERPAYMENT_MARKER } from '@/lib/payment-rules'

const PAYMENT_TYPES = ['Anticipo', 'Liquidacion', 'Otro']
const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro']

export interface CreatePaymentInput {
  orderId: string
  amount: number
  type: 'Anticipo' | 'Liquidacion' | 'Otro'
  method: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Otro'
  paidAt?: Date
  notes?: string
  /** true = el usuario ya confirmó explícitamente que el pago deja un sobrepago. */
  allowOverpayment?: boolean
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
  if (!PAYMENT_METHODS.includes(input.method)) {
    throw new Error(`Método de pago inválido: ${input.method}`)
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { lineItems: true, payments: true },
  })
  if (!order) {
    throw new Error('No se encontró el pedido al que se quiere registrar el pago')
  }

  const orderTotal = order.lineItems.reduce((sum, line) => sum + line.lineTotal, 0)
  const alreadyPaid = order.payments.reduce((sum, payment) => sum + payment.amount, 0)
  const overpayment = evaluateOverpayment({
    orderTotal,
    alreadyPaid,
    newAmount: input.amount,
    allowOverpayment: input.allowOverpayment ?? false,
  })

  if (overpayment.blocked) {
    throw new Error(
      `${OVERPAYMENT_MARKER}: este pago dejaría el total cobrado ($${overpayment.projectedTotal.toFixed(2)}) por encima del total del pedido ($${orderTotal.toFixed(2)}).`
    )
  }

  const payment = await prisma.payment.create({
    data: {
      orderId: input.orderId,
      amount: input.amount,
      type: input.type,
      method: input.method,
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
