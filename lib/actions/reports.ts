'use server'

// Server action de datos crudos para el reporte financiero (Fase 5, V1) —
// solo lectura, solo trae filas de Order/Payment/Purchase/Expense. Todo el
// cálculo real vive en lib/financial-report.ts (funciones puras, testeadas
// sin Prisma) para poder probarlo sin tocar la base de datos.

import { prisma } from '@/lib/db'

export async function getFinancialReportData() {
  const [orders, purchases, expenses] = await Promise.all([
    prisma.order.findMany({
      include: {
        lineItems: { include: { catalogItem: true } },
        payments: true,
        lead: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.purchase.findMany({ include: { material: true }, orderBy: { purchaseDate: 'desc' } }),
    prisma.expense.findMany({ orderBy: { date: 'desc' } }),
  ])

  return { orders, purchases, expenses }
}
