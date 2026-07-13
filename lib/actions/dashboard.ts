'use server'

// Server action de resumen para el dashboard principal (`app/(dashboard)/page.tsx`).
// Es sólo lectura — no muta nada, así que no necesita revalidatePath.
//
// FASE 5 (V1): se retira "Ganancia del mes" (en realidad era dinero
// cobrado, no ganancia — mezclaba venta con cobro). Se reemplaza por
// métricas separadas y honestas, todas derivadas del mismo motor que el
// reporte financiero (lib/financial-report.ts) para no duplicar fórmulas.

import { prisma } from '@/lib/db'
import { computeFinancialReport } from '@/lib/financial-report'

const COMPLETED_STATUSES = ['Completado', 'Entregado']
const PENDING_DELIVERY_STATUSES = ['Disenando', 'DisenoAprobado', 'Maquilando', 'Completado']

export async function getDashboardSummary() {
  const now = new Date()

  const [
    activeInventoryMaterials,
    recentPurchases,
    recentOrders,
    completedOrdersCount,
    lowStockMaterials,
    allOrdersForReport,
    allPurchasesForReport,
    allExpensesForReport,
    pendingDeliveryOrders,
  ] = await Promise.all([
    // "Materiales activos" y "Valor inventario" son metricas de INVENTARIO
    // (isInventoryTracked=true) — el catalogo completo de materiales de
    // costo (ej. DTF maquilado) vive en /materiales, no en este resumen.
    prisma.material.findMany({ where: { isArchived: false, isInventoryTracked: true } }),
    prisma.purchase.findMany({
      where: { material: { isInventoryTracked: true } },
      orderBy: { purchaseDate: 'desc' },
      take: 5,
      include: { material: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { lead: true, lineItems: true },
    }),
    prisma.order.count({ where: { status: { in: COMPLETED_STATUSES } } }),
    prisma.material.findMany({
      where: {
        isArchived: false,
        isInventoryTracked: true,
        lowStockThresholdCm2: { gt: 0 },
      },
    }),
    prisma.order.findMany({ include: { lineItems: { include: { catalogItem: true } }, payments: true } }),
    prisma.purchase.findMany(),
    prisma.expense.findMany(),
    prisma.order.findMany({
      where: { status: { in: PENDING_DELIVERY_STATUSES } },
      select: { id: true, deliveryDate: true, status: true },
    }),
  ])

  const totalInventoryValue = activeInventoryMaterials.reduce((sum, material) => sum + material.totalValue, 0)
  const activeMaterialsCount = activeInventoryMaterials.length
  const lowStock = lowStockMaterials.filter((material) => material.totalAreaCm2 <= material.lowStockThresholdCm2)

  const monthlyReport = computeFinancialReport({
    orders: allOrdersForReport,
    purchases: allPurchasesForReport,
    expenses: allExpensesForReport,
    range: 'mes',
    now,
  })

  // Saldo por cobrar es un saldo VIVO (todos los pedidos con saldo
  // pendiente, no solo los creados este mes) — a diferencia de las demás
  // métricas de este resumen, que sí son "del mes".
  const overallReport = computeFinancialReport({
    orders: allOrdersForReport,
    purchases: [],
    expenses: [],
    range: 'todos',
    now,
  })

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const ordersAwaitingDelivery = pendingDeliveryOrders.length
  const lateOrders = pendingDeliveryOrders.filter((o) => o.deliveryDate && new Date(o.deliveryDate) < today).length

  return {
    totalInventoryValue,
    activeMaterialsCount,
    recentPurchases,
    recentOrders,
    acceptedJobsCount: completedOrdersCount,
    lowStockMaterials: lowStock,
    // FASE 5 (V1): métricas honestas del mes, en vez de "Ganancia del mes".
    salesThisMonth: monthlyReport.ventas.ventaNeta,
    collectedThisMonth: monthlyReport.cobranza.dineroCobrado,
    grossProfitThisMonth: monthlyReport.rentabilidad.gananciaBruta,
    expensesThisMonth: monthlyReport.gastos.total,
    operatingResultThisMonth: monthlyReport.resultado.resultadoOperativo,
    receivableBalance: overallReport.cobranza.saldoPorCobrar,
    ordersAwaitingDelivery,
    lateOrders,
  }
}
