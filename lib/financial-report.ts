// Motor del reporte financiero V1 (Fase 5) — funciones puras, sin Prisma,
// para poder probarlas sin tocar la base de datos. lib/actions/reports.ts
// solo trae las filas crudas (Order+lineItems+payments, Purchase, Expense)
// y les aplica esto.
//
// Principios de negocio (no inventar/no mezclar, ver spec V1):
// - Venta (Order.createdAt) != Cobro (Payment.paidAt): NUNCA se suman como
//   si fueran lo mismo, se reportan por separado.
// - Compra de inventario (Purchase) != gasto operativo (Expense): nunca se
//   mezclan en la misma bolsa.
// - "Descuentos" se reporta en 0: este V1 no tiene mecanismo de descuento
//   por línea/pedido en el modelo de datos todavía (fuera de alcance de
//   esta fase) — Venta neta = Ventas generadas hasta que exista ese campo.

import { isDateInRange, type DateRangePreset } from './date-ranges'

export interface ReportOrderLine {
  quantity: number
  lineTotal: number
  catalogItemId: string | null
  catalogItem: { isKit: boolean; name: string } | null
  description: string
  unitMaterialCost: number | null
  unitInkCost: number | null
  unitElectricityCost: number | null
  unitWearCost: number | null
  unitWasteCost: number | null
  unitBagCost: number | null
  unitLabelCost: number | null
  estimatedUnitLabor: number | null
}

export interface ReportPayment {
  amount: number
  type: string
  paidAt: Date
}

export interface ReportOrder {
  id: string
  createdAt: Date
  lineItems: ReportOrderLine[]
  payments: ReportPayment[]
}

export interface ReportPurchase {
  id: string
  finalPrice: number
  purchaseDate: Date
}

export interface ReportExpense {
  id: string
  amount: number
  category: string
  date: Date
}

export interface FinancialReportInput {
  orders: ReportOrder[]
  purchases: ReportPurchase[]
  expenses: ReportExpense[]
  range: DateRangePreset | { from: Date | null; to: Date | null }
  now?: Date
}

function inRange(date: Date, range: FinancialReportInput['range'], now: Date): boolean {
  if (typeof range === 'string') return isDateInRange(date, range, now)
  if (range.from && date < range.from) return false
  if (range.to && date >= range.to) return false
  return true
}

function safeDiv(a: number, b: number): number {
  return b ? a / b : 0
}

export interface FinancialReport {
  ventas: {
    numeroPedidos: number
    ventasGeneradas: number
    descuentos: number
    ventaNeta: number
    ticketPromedio: number
    productosVendidos: number
    kitsVendidos: number
  }
  cobranza: {
    dineroCobrado: number
    anticipos: number
    liquidaciones: number
    otros: number
    saldoPorCobrar: number
    pedidosPagados: number
    pedidosConSaldo: number
  }
  produccion: {
    material: number
    tinta: number
    luz: number
    desgaste: number
    merma: number
    bolsa: number
    etiquetita: number
    manoDeObra: number
    costoDirectoTotal: number
  }
  rentabilidad: {
    gananciaBruta: number
    margenBruto: number
    gananciaDespuesManoObra: number
    margenDespuesManoObra: number
  }
  gastos: {
    total: number
    porCategoria: { category: string; total: number }[]
  }
  resultado: {
    resultadoOperativo: number
    flujoCajaAproximado: number
    comprasPagadas: number
  }
  detalle: {
    pedidos: ReportOrder[]
    pagos: (ReportPayment & { orderId: string })[]
    compras: ReportPurchase[]
    gastos: ReportExpense[]
    productosMasVendidos: { name: string; quantity: number; total: number }[]
    kitsMasVendidos: { name: string; quantity: number; total: number }[]
  }
}

export function computeFinancialReport(input: FinancialReportInput): FinancialReport {
  const now = input.now ?? new Date()

  const ordersInRange = input.orders.filter((o) => inRange(o.createdAt, input.range, now))
  const paymentsInRange = input.orders.flatMap((o) =>
    o.payments.filter((p) => inRange(p.paidAt, input.range, now)).map((p) => ({ ...p, orderId: o.id }))
  )
  const purchasesInRange = input.purchases.filter((p) => inRange(p.purchaseDate, input.range, now))
  const expensesInRange = input.expenses.filter((e) => inRange(e.date, input.range, now))

  // --- Ventas ---
  const ventasGeneradas = ordersInRange.reduce(
    (sum, o) => sum + o.lineItems.reduce((s, l) => s + l.lineTotal, 0),
    0
  )
  const descuentos = 0 // sin mecanismo de descuento en el modelo de datos de este V1
  const ventaNeta = ventasGeneradas - descuentos
  const numeroPedidos = ordersInRange.length
  const ticketPromedio = safeDiv(ventaNeta, numeroPedidos)

  let productosVendidos = 0
  let kitsVendidos = 0
  const productCounts = new Map<string, { quantity: number; total: number }>()
  const kitCounts = new Map<string, { quantity: number; total: number }>()

  for (const order of ordersInRange) {
    for (const line of order.lineItems) {
      if (line.catalogItemId && line.catalogItem) {
        const bucket = line.catalogItem.isKit ? kitCounts : productCounts
        const current = bucket.get(line.catalogItem.name) ?? { quantity: 0, total: 0 }
        current.quantity += line.quantity
        current.total += line.lineTotal
        bucket.set(line.catalogItem.name, current)
        if (line.catalogItem.isKit) kitsVendidos += line.quantity
        else productosVendidos += line.quantity
      }
    }
  }

  // --- Cobranza ---
  const dineroCobrado = paymentsInRange.reduce((sum, p) => sum + p.amount, 0)
  const anticipos = paymentsInRange.filter((p) => p.type === 'Anticipo').reduce((s, p) => s + p.amount, 0)
  const liquidaciones = paymentsInRange.filter((p) => p.type === 'Liquidacion').reduce((s, p) => s + p.amount, 0)
  const otrosPagos = paymentsInRange.filter((p) => p.type !== 'Anticipo' && p.type !== 'Liquidacion').reduce((s, p) => s + p.amount, 0)

  let saldoPorCobrar = 0
  let pedidosPagados = 0
  let pedidosConSaldo = 0
  for (const order of ordersInRange) {
    const total = order.lineItems.reduce((s, l) => s + l.lineTotal, 0)
    const paid = order.payments.reduce((s, p) => s + p.amount, 0)
    const balance = total - paid
    saldoPorCobrar += Math.max(0, balance)
    if (balance <= 0) pedidosPagados++
    else pedidosConSaldo++
  }

  // --- Producción (costo directo de ventas, por componente) ---
  const produccion = ordersInRange.reduce(
    (acc, order) => {
      for (const line of order.lineItems) {
        acc.material += (line.unitMaterialCost ?? 0) * line.quantity
        acc.tinta += (line.unitInkCost ?? 0) * line.quantity
        acc.luz += (line.unitElectricityCost ?? 0) * line.quantity
        acc.desgaste += (line.unitWearCost ?? 0) * line.quantity
        acc.merma += (line.unitWasteCost ?? 0) * line.quantity
        // Bolsa/etiquetita NO escalan por cantidad — son 1 sola bolsa y 1
        // etiquetita por pedido, ya congeladas así por createOrder (ver
        // lib/actions/orders.ts), no por unidad vendida.
        acc.bolsa += line.unitBagCost ?? 0
        acc.etiquetita += line.unitLabelCost ?? 0
        acc.manoDeObra += (line.estimatedUnitLabor ?? 0) * line.quantity
      }
      return acc
    },
    { material: 0, tinta: 0, luz: 0, desgaste: 0, merma: 0, bolsa: 0, etiquetita: 0, manoDeObra: 0 }
  )
  const costoDirectoTotal =
    produccion.material + produccion.tinta + produccion.luz + produccion.desgaste + produccion.merma + produccion.bolsa + produccion.etiquetita

  // --- Rentabilidad ---
  const gananciaBruta = ventaNeta - costoDirectoTotal
  const margenBruto = safeDiv(gananciaBruta, ventaNeta)
  const gananciaDespuesManoObra = gananciaBruta - produccion.manoDeObra
  const margenDespuesManoObra = safeDiv(gananciaDespuesManoObra, ventaNeta)

  // --- Gastos ---
  const gastosTotal = expensesInRange.reduce((s, e) => s + e.amount, 0)
  const gastosPorCategoriaMap = new Map<string, number>()
  for (const e of expensesInRange) {
    gastosPorCategoriaMap.set(e.category, (gastosPorCategoriaMap.get(e.category) ?? 0) + e.amount)
  }

  // --- Resultado ---
  const resultadoOperativo = gananciaDespuesManoObra - gastosTotal
  const comprasPagadas = purchasesInRange.reduce((s, p) => s + p.finalPrice, 0)
  const flujoCajaAproximado = dineroCobrado - comprasPagadas - gastosTotal

  return {
    ventas: { numeroPedidos, ventasGeneradas, descuentos, ventaNeta, ticketPromedio, productosVendidos, kitsVendidos },
    cobranza: {
      dineroCobrado,
      anticipos,
      liquidaciones,
      otros: otrosPagos,
      saldoPorCobrar,
      pedidosPagados,
      pedidosConSaldo,
    },
    produccion: { ...produccion, costoDirectoTotal },
    rentabilidad: { gananciaBruta, margenBruto, gananciaDespuesManoObra, margenDespuesManoObra },
    gastos: {
      total: gastosTotal,
      porCategoria: Array.from(gastosPorCategoriaMap.entries()).map(([category, total]) => ({ category, total })),
    },
    resultado: { resultadoOperativo, flujoCajaAproximado, comprasPagadas },
    detalle: {
      pedidos: ordersInRange,
      pagos: paymentsInRange,
      compras: purchasesInRange,
      gastos: expensesInRange,
      productosMasVendidos: Array.from(productCounts.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.quantity - a.quantity),
      kitsMasVendidos: Array.from(kitCounts.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.quantity - a.quantity),
    },
  }
}
