import { describe, expect, it } from 'vitest'
import { computeFinancialReport, type ReportOrder } from './financial-report'

const NOW = new Date('2026-07-15T10:00:00')

function order(overrides: Partial<ReportOrder> & { id: string }): ReportOrder {
  return {
    createdAt: NOW,
    lineItems: [],
    payments: [],
    ...overrides,
  }
}

describe('computeFinancialReport — reporte por fecha', () => {
  it('solo incluye pedidos/pagos/compras/gastos dentro del rango', () => {
    const inRangeOrder = order({
      id: 'in-range',
      createdAt: new Date('2026-07-15T09:00:00'),
      lineItems: [
        {
          quantity: 2,
          lineTotal: 200,
          catalogItemId: 'cat-1',
          catalogItem: { isKit: false, name: 'Etiquetas para cuadernos' },
          description: 'Etiquetas para cuadernos',
          unitMaterialCost: 3.84,
          unitInkCost: 1,
          unitElectricityCost: 0.25,
          unitWearCost: 1,
          unitWasteCost: 0.75,
          unitBagCost: 0.49,
          unitLabelCost: 0.21,
          estimatedUnitLabor: 4,
        },
      ],
      payments: [{ amount: 100, type: 'Anticipo', paidAt: new Date('2026-07-15T09:30:00') }],
    })

    const outOfRangeOrder = order({
      id: 'out-of-range',
      createdAt: new Date('2026-06-01T09:00:00'),
      lineItems: [
        {
          quantity: 1,
          lineTotal: 500,
          catalogItemId: null,
          catalogItem: null,
          description: 'Fuera de rango',
          unitMaterialCost: 0,
          unitInkCost: 0,
          unitElectricityCost: 0,
          unitWearCost: 0,
          unitWasteCost: 0,
          unitBagCost: 0,
          unitLabelCost: 0,
          estimatedUnitLabor: 0,
        },
      ],
      payments: [{ amount: 500, type: 'Liquidacion', paidAt: new Date('2026-06-01T09:30:00') }],
    })

    const report = computeFinancialReport({
      orders: [inRangeOrder, outOfRangeOrder],
      purchases: [
        { id: 'p1', finalPrice: 50, purchaseDate: new Date('2026-07-15T08:00:00') },
        { id: 'p2', finalPrice: 999, purchaseDate: new Date('2026-05-01T08:00:00') },
      ],
      expenses: [
        { id: 'e1', amount: 30, category: 'Publicidad', date: new Date('2026-07-15T08:00:00') },
        { id: 'e2', amount: 999, category: 'Servicios', date: new Date('2026-01-01T08:00:00') },
      ],
      range: 'hoy',
      now: NOW,
    })

    expect(report.ventas.numeroPedidos).toBe(1)
    expect(report.ventas.ventasGeneradas).toBe(200)
    expect(report.cobranza.dineroCobrado).toBe(100)
    expect(report.resultado.comprasPagadas).toBe(50)
    expect(report.gastos.total).toBe(30)
  })

  it('rango personalizado (from/to explícito) también filtra correctamente', () => {
    const o1 = order({ id: 'o1', createdAt: new Date('2026-03-05'), lineItems: [], payments: [] })
    const o2 = order({ id: 'o2', createdAt: new Date('2026-05-05'), lineItems: [], payments: [] })

    const report = computeFinancialReport({
      orders: [o1, o2],
      purchases: [],
      expenses: [],
      range: { from: new Date('2026-03-01'), to: new Date('2026-04-01') },
      now: NOW,
    })

    expect(report.ventas.numeroPedidos).toBe(1)
    expect(report.detalle.pedidos[0].id).toBe('o1')
  })
})

describe('computeFinancialReport — ventas/cobranza/rentabilidad', () => {
  const commonLine = {
    quantity: 1,
    catalogItemId: 'cat-1',
    catalogItem: { isKit: false, name: 'Producto' },
    description: 'Producto',
    unitMaterialCost: 5,
    unitInkCost: 1,
    unitElectricityCost: 0.25,
    unitWearCost: 1,
    unitWasteCost: 0.75,
    unitBagCost: 0.49,
    unitLabelCost: 0.21,
    estimatedUnitLabor: 4,
  }

  it('ganancia bruta = venta neta - costo directo; margen bruto correcto', () => {
    const report = computeFinancialReport({
      orders: [order({ id: 'o1', lineItems: [{ ...commonLine, lineTotal: 100 }], payments: [] })],
      purchases: [],
      expenses: [],
      range: 'todos',
      now: NOW,
    })

    const directCost = 5 + 1 + 0.25 + 1 + 0.75 + 0.49 + 0.21 // 8.7 (mano de obra NO entra aqui)
    expect(report.produccion.costoDirectoTotal).toBeCloseTo(directCost, 6)
    expect(report.rentabilidad.gananciaBruta).toBeCloseTo(100 - directCost, 6)
    expect(report.rentabilidad.margenBruto).toBeCloseTo((100 - directCost) / 100, 6)
    expect(report.rentabilidad.gananciaDespuesManoObra).toBeCloseTo(100 - directCost - 4, 6)
  })

  it('saldo por cobrar y pedidos pagados/con saldo', () => {
    const paidOrder = order({
      id: 'paid',
      lineItems: [{ ...commonLine, lineTotal: 100 }],
      payments: [{ amount: 100, type: 'Liquidacion', paidAt: NOW }],
    })
    const unpaidOrder = order({
      id: 'unpaid',
      lineItems: [{ ...commonLine, lineTotal: 100 }],
      payments: [{ amount: 40, type: 'Anticipo', paidAt: NOW }],
    })

    const report = computeFinancialReport({
      orders: [paidOrder, unpaidOrder],
      purchases: [],
      expenses: [],
      range: 'todos',
      now: NOW,
    })

    expect(report.cobranza.pedidosPagados).toBe(1)
    expect(report.cobranza.pedidosConSaldo).toBe(1)
    expect(report.cobranza.saldoPorCobrar).toBeCloseTo(60, 6)
  })

  it('kits vendidos y productos vendidos se cuentan por separado', () => {
    const report = computeFinancialReport({
      orders: [
        order({
          id: 'o1',
          lineItems: [
            { ...commonLine, quantity: 2, lineTotal: 78, catalogItem: { isKit: false, name: 'Etiquetas' } },
            { ...commonLine, quantity: 1, lineTotal: 349, catalogItem: { isKit: true, name: 'Kit Básico' } },
          ],
          payments: [],
        }),
      ],
      purchases: [],
      expenses: [],
      range: 'todos',
      now: NOW,
    })

    expect(report.ventas.productosVendidos).toBe(2)
    expect(report.ventas.kitsVendidos).toBe(1)
  })
})

describe('computeFinancialReport — gastos por periodo', () => {
  it('agrupa gastos por categoría dentro del rango', () => {
    const report = computeFinancialReport({
      orders: [],
      purchases: [],
      expenses: [
        { id: 'e1', amount: 100, category: 'Publicidad', date: NOW },
        { id: 'e2', amount: 50, category: 'Publicidad', date: NOW },
        { id: 'e3', amount: 30, category: 'Servicios', date: NOW },
      ],
      range: 'todos',
      now: NOW,
    })

    expect(report.gastos.total).toBe(180)
    expect(report.gastos.porCategoria).toEqual(
      expect.arrayContaining([
        { category: 'Publicidad', total: 150 },
        { category: 'Servicios', total: 30 },
      ])
    )
  })

  it('resultado operativo y flujo de caja aproximado', () => {
    const report = computeFinancialReport({
      orders: [
        order({
          id: 'o1',
          lineItems: [
            {
              quantity: 1,
              lineTotal: 100,
              catalogItemId: null,
              catalogItem: null,
              description: 'x',
              unitMaterialCost: 10,
              unitInkCost: 0,
              unitElectricityCost: 0,
              unitWearCost: 0,
              unitWasteCost: 0,
              unitBagCost: 0,
              unitLabelCost: 0,
              estimatedUnitLabor: 0,
            },
          ],
          payments: [{ amount: 100, type: 'Liquidacion', paidAt: NOW }],
        }),
      ],
      purchases: [{ id: 'p1', finalPrice: 20, purchaseDate: NOW }],
      expenses: [{ id: 'e1', amount: 15, category: 'Servicios', date: NOW }],
      range: 'todos',
      now: NOW,
    })

    // ganancia bruta = 100-10=90; ganancia c/mano = 90 (labor 0); resultado operativo = 90-15=75
    expect(report.resultado.resultadoOperativo).toBeCloseTo(75, 6)
    // flujo de caja = cobrado(100) - compras pagadas(20) - gastos(15) = 65
    expect(report.resultado.flujoCajaAproximado).toBeCloseTo(65, 6)
  })
})
