'use server'

// Server actions de gastos operativos (Expense) — Fase 4, V1.
//
// NUNCA se mezcla con Purchase: una compra que aumenta inventario de
// material va en Purchase (lib/actions/purchases.ts); un gasto que NO
// aumenta inventario (publicidad, envíos, herramientas, etc.) va aquí.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { EXPENSE_CATEGORIES, EXPENSE_METHODS } from '@/lib/expense-categories'

export interface CreateExpenseInput {
  date: Date
  concept: string
  category: string
  amount: number
  method: string
  beneficiary?: string
  notes?: string
  receiptUrl?: string
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>

function validateExpenseInput(data: Partial<CreateExpenseInput>) {
  if (data.concept !== undefined && !data.concept.trim()) {
    throw new Error('El concepto del gasto es obligatorio')
  }
  if (data.category !== undefined && !EXPENSE_CATEGORIES.includes(data.category as (typeof EXPENSE_CATEGORIES)[number])) {
    throw new Error(`Categoría de gasto inválida: ${data.category}`)
  }
  if (data.amount !== undefined && (!Number.isFinite(data.amount) || data.amount <= 0)) {
    throw new Error('El importe del gasto debe ser mayor a cero')
  }
  if (data.method !== undefined && !EXPENSE_METHODS.includes(data.method as (typeof EXPENSE_METHODS)[number])) {
    throw new Error(`Método de pago inválido: ${data.method}`)
  }
}

export async function createExpense(data: CreateExpenseInput) {
  await requireSession()
  validateExpenseInput(data)

  const expense = await prisma.expense.create({
    data: {
      date: data.date,
      concept: data.concept.trim(),
      category: data.category,
      amount: data.amount,
      method: data.method,
      beneficiary: data.beneficiary?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      receiptUrl: data.receiptUrl?.trim() || undefined,
    },
  })

  revalidatePath('/gastos')
  revalidatePath('/')

  return expense
}

export async function updateExpense(id: string, data: UpdateExpenseInput) {
  await requireSession()
  validateExpenseInput(data)

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      ...(data.date !== undefined ? { date: data.date } : {}),
      ...(data.concept !== undefined ? { concept: data.concept.trim() } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.method !== undefined ? { method: data.method } : {}),
      ...(data.beneficiary !== undefined ? { beneficiary: data.beneficiary.trim() || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes.trim() || null } : {}),
      ...(data.receiptUrl !== undefined ? { receiptUrl: data.receiptUrl.trim() || null } : {}),
    },
  })

  revalidatePath('/gastos')
  revalidatePath('/')

  return expense
}

/** Elimina un gasto — sin archivado, a diferencia de catálogo/materiales: un gasto mal capturado se borra directo (la UI pide confirmación antes). */
export async function deleteExpense(id: string) {
  await requireSession()
  await prisma.expense.delete({ where: { id } })

  revalidatePath('/gastos')
  revalidatePath('/')
}

export interface ListExpensesOptions {
  from?: Date
  to?: Date
  category?: string
}

export async function listExpenses(opts: ListExpensesOptions = {}) {
  return prisma.expense.findMany({
    where: {
      ...(opts.from || opts.to
        ? { date: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
        : {}),
      ...(opts.category ? { category: opts.category } : {}),
    },
    orderBy: { date: 'desc' },
  })
}
