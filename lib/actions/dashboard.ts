'use server'

// Server action de resumen para el dashboard principal (`app/(dashboard)/page.tsx` a futuro).
// Es sólo lectura — no muta nada, así que no necesita revalidatePath.

import { prisma } from '@/lib/db'

const COMPLETED_STATUSES = ['Completado', 'Entregado']

export async function getDashboardSummary() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [activeInventoryMaterials, recentPurchases, recentOrders, completedOrdersCount, monthlyPayments, lowStockMaterials] =
    await Promise.all([
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
      // "Ganancia del mes" ahora se aproxima con dinero REAL recibido
      // (Payment.paidAt dentro del mes) — ya no hay un unico
      // finalChargedPrice por pedido como en el viejo Quote, así que el
      // criterio más honesto es lo que efectivamente entró a caja.
      prisma.payment.findMany({
        where: { paidAt: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.material.findMany({
        where: {
          isArchived: false,
          isInventoryTracked: true,
          lowStockThresholdCm2: { gt: 0 },
        },
      }),
    ])

  const totalInventoryValue = activeInventoryMaterials.reduce((sum, material) => sum + material.totalValue, 0)
  const activeMaterialsCount = activeInventoryMaterials.length

  const estimatedProfitThisMonth = monthlyPayments.reduce((sum, payment) => sum + payment.amount, 0)

  const lowStock = lowStockMaterials.filter((material) => material.totalAreaCm2 <= material.lowStockThresholdCm2)

  return {
    totalInventoryValue,
    activeMaterialsCount,
    recentPurchases,
    recentOrders,
    acceptedJobsCount: completedOrdersCount,
    estimatedProfitThisMonth,
    lowStockMaterials: lowStock,
  }
}
