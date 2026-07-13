import { SectionHeading } from "@/components/section-heading";
import { getFinancialReportData } from "@/lib/actions/reports";
import { FinancialReportClient } from "./_components/financial-report-client";

/**
 * Reporte financiero V1 (Fase 5): trae TODOS los pedidos/pagos/compras/
 * gastos de una sola vez (poco volumen en este negocio, mismo criterio que
 * /gastos y /materiales) y delega el filtro de periodo + todo el cálculo a
 * FinancialReportClient, que usa la función pura computeFinancialReport
 * (lib/financial-report.ts) — la misma que está cubierta por tests.
 */
export default async function FinancialReportPage() {
  const { orders, purchases, expenses } = await getFinancialReportData();

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Reporte financiero"
        subtitle="Ventas, cobranza, costos de producción, rentabilidad, gastos y resultado — por periodo."
      />

      <FinancialReportClient
        orders={orders.map((o) => ({
          id: o.id,
          createdAt: o.createdAt.toISOString(),
          interest: o.interest,
          leadName: o.lead.name,
          lineItems: o.lineItems.map((l) => ({
            quantity: l.quantity,
            lineTotal: l.lineTotal,
            catalogItemId: l.catalogItemId,
            catalogItem: l.catalogItem ? { isKit: l.catalogItem.isKit, name: l.catalogItem.name } : null,
            description: l.description,
            unitMaterialCost: l.unitMaterialCost,
            unitInkCost: l.unitInkCost,
            unitElectricityCost: l.unitElectricityCost,
            unitWearCost: l.unitWearCost,
            unitWasteCost: l.unitWasteCost,
            unitBagCost: l.unitBagCost,
            unitLabelCost: l.unitLabelCost,
            estimatedUnitLabor: l.estimatedUnitLabor,
          })),
          payments: o.payments.map((p) => ({ amount: p.amount, type: p.type, paidAt: p.paidAt.toISOString() })),
        }))}
        purchases={purchases.map((p) => ({
          id: p.id,
          finalPrice: p.finalPrice,
          purchaseDate: p.purchaseDate.toISOString(),
          materialName: p.material.name,
          supplier: p.supplier,
        }))}
        expenses={expenses.map((e) => ({
          id: e.id,
          amount: e.amount,
          category: e.category,
          date: e.date.toISOString(),
          concept: e.concept,
          method: e.method,
        }))}
      />
    </div>
  );
}
