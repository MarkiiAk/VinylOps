"use client";

import { useMemo, useState } from "react";
import { Download, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeFinancialReport, type ReportOrder } from "@/lib/financial-report";
import type { DateRangePreset } from "@/lib/date-ranges";
import { buildCsv, downloadCsv } from "@/lib/csv";

interface OrderRow {
  id: string;
  createdAt: string;
  interest: string;
  leadName: string | null;
  lineItems: ReportOrder["lineItems"];
  payments: { amount: number; type: string; paidAt: string }[];
}

interface PurchaseRow {
  id: string;
  finalPrice: number;
  purchaseDate: string;
  materialName: string;
  supplier: string | null;
}

interface ExpenseRow {
  id: string;
  amount: number;
  category: string;
  date: string;
  concept: string;
  method: string;
}

const RANGE_OPTIONS: { value: DateRangePreset | "personalizado"; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "mesAnterior", label: "Mes anterior" },
  { value: "personalizado", label: "Rango personalizado" },
  { value: "todos", label: "Todo" },
];

function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground" title={hint}>
        {label}
      </p>
      <p className="tabular-nums font-medium text-foreground">{value}</p>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel space-y-3 rounded-xl p-4">
      <h3 className="font-heading text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </div>
  );
}

/**
 * Cliente del reporte financiero: arma el rango efectivo (preset o
 * personalizado), reconstruye los Date desde los ISO strings serializados
 * por el server component, y llama a la función pura
 * computeFinancialReport (lib/financial-report.ts) — el mismo motor que
 * está cubierto por tests, corriendo aquí en el navegador sin Prisma.
 */
export function FinancialReportClient({
  orders,
  purchases,
  expenses,
}: {
  orders: OrderRow[];
  purchases: PurchaseRow[];
  expenses: ExpenseRow[];
}) {
  const [rangeOption, setRangeOption] = useState<DateRangePreset | "personalizado">("mes");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(() => {
    if (rangeOption !== "personalizado") return rangeOption;
    return {
      from: customFrom ? new Date(`${customFrom}T00:00:00`) : null,
      to: customTo ? new Date(`${customTo}T23:59:59`) : null,
    };
  }, [rangeOption, customFrom, customTo]);

  const report = useMemo(() => {
    return computeFinancialReport({
      orders: orders.map((o) => ({
        id: o.id,
        createdAt: new Date(o.createdAt),
        lineItems: o.lineItems,
        payments: o.payments.map((p) => ({ ...p, paidAt: new Date(p.paidAt) })),
      })),
      purchases: purchases.map((p) => ({ id: p.id, finalPrice: p.finalPrice, purchaseDate: new Date(p.purchaseDate) })),
      expenses: expenses.map((e) => ({ id: e.id, amount: e.amount, category: e.category, date: new Date(e.date) })),
      range,
    });
  }, [orders, purchases, expenses, range]);

  function exportPedidos() {
    const csv = buildCsv(
      report.detalle.pedidos.map((o) => ({
        id: o.id,
        fecha: o.createdAt.toISOString().slice(0, 10),
        total: o.lineItems.reduce((s, l) => s + l.lineTotal, 0),
        cobrado: o.payments.reduce((s, p) => s + p.amount, 0),
      })),
      [
        { key: "id", label: "ID" },
        { key: "fecha", label: "Fecha" },
        { key: "total", label: "Total" },
        { key: "cobrado", label: "Cobrado" },
      ]
    );
    downloadCsv("pedidos.csv", csv);
  }

  function exportPagos() {
    const csv = buildCsv(
      report.detalle.pagos.map((p) => ({
        orderId: p.orderId,
        fecha: p.paidAt.toISOString().slice(0, 10),
        tipo: p.type,
        monto: p.amount,
      })),
      [
        { key: "orderId", label: "Pedido" },
        { key: "fecha", label: "Fecha" },
        { key: "tipo", label: "Tipo" },
        { key: "monto", label: "Monto" },
      ]
    );
    downloadCsv("pagos.csv", csv);
  }

  function exportCompras() {
    const csv = buildCsv(
      report.detalle.compras.map((p) => ({ fecha: p.purchaseDate.toISOString().slice(0, 10), total: p.finalPrice })),
      [
        { key: "fecha", label: "Fecha" },
        { key: "total", label: "Total" },
      ]
    );
    downloadCsv("compras.csv", csv);
  }

  function exportGastos() {
    const csv = buildCsv(
      report.detalle.gastos.map((e) => ({
        fecha: e.date.toISOString().slice(0, 10),
        categoria: e.category,
        importe: e.amount,
      })),
      [
        { key: "fecha", label: "Fecha" },
        { key: "categoria", label: "Categoría" },
        { key: "importe", label: "Importe" },
      ]
    );
    downloadCsv("gastos.csv", csv);
  }

  function exportProductos() {
    const csv = buildCsv(report.detalle.productosMasVendidos, [
      { key: "name", label: "Producto" },
      { key: "quantity", label: "Cantidad" },
      { key: "total", label: "Total vendido" },
    ]);
    downloadCsv("productos-mas-vendidos.csv", csv);
  }

  function exportKits() {
    const csv = buildCsv(report.detalle.kitsMasVendidos, [
      { key: "name", label: "Kit" },
      { key: "quantity", label: "Cantidad" },
      { key: "total", label: "Total vendido" },
    ]);
    downloadCsv("kits-mas-vendidos.csv", csv);
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel flex flex-wrap items-end gap-3 rounded-xl p-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Periodo</Label>
          <Select value={rangeOption} onValueChange={(v) => setRangeOption((v as DateRangePreset | "personalizado") ?? "mes")}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {rangeOption === "personalizado" ? (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </>
        ) : null}
      </div>

      <div className="glass-panel flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
        <p>
          Utilidad no es lo mismo que efectivo, y una venta no es lo mismo que un cobro: un pedido puede estar
          &quot;vendido&quot; (Ventas) sin que el dinero haya entrado todavía (Cobranza). Igual, una compra de
          material no siempre es el costo que se consumió en este periodo. &quot;Descuentos&quot; se reporta en $0:
          este V1 todavía no tiene un mecanismo de descuento por pedido/línea.
        </p>
      </div>

      <SectionCard title="Ventas">
        <Kpi label="Pedidos" value={String(report.ventas.numeroPedidos)} />
        <Kpi label="Ventas generadas" value={formatMXN(report.ventas.ventasGeneradas)} />
        <Kpi label="Descuentos" value={formatMXN(report.ventas.descuentos)} />
        <Kpi label="Venta neta" value={formatMXN(report.ventas.ventaNeta)} />
        <Kpi label="Ticket promedio" value={formatMXN(report.ventas.ticketPromedio)} />
        <Kpi label="Productos vendidos" value={String(report.ventas.productosVendidos)} />
        <Kpi label="Kits vendidos" value={String(report.ventas.kitsVendidos)} />
      </SectionCard>

      <SectionCard title="Cobranza">
        <Kpi label="Dinero cobrado" value={formatMXN(report.cobranza.dineroCobrado)} />
        <Kpi label="Anticipos" value={formatMXN(report.cobranza.anticipos)} />
        <Kpi label="Liquidaciones" value={formatMXN(report.cobranza.liquidaciones)} />
        <Kpi label="Otros pagos" value={formatMXN(report.cobranza.otros)} />
        <Kpi label="Saldo por cobrar" value={formatMXN(report.cobranza.saldoPorCobrar)} />
        <Kpi label="Pedidos pagados" value={String(report.cobranza.pedidosPagados)} />
        <Kpi label="Pedidos con saldo" value={String(report.cobranza.pedidosConSaldo)} />
      </SectionCard>

      <SectionCard title="Producción (costo directo de ventas)">
        <Kpi label="Material" value={formatMXN(report.produccion.material)} />
        <Kpi label="Tinta" value={formatMXN(report.produccion.tinta)} />
        <Kpi label="Luz" value={formatMXN(report.produccion.luz)} />
        <Kpi label="Desgaste" value={formatMXN(report.produccion.desgaste)} />
        <Kpi label="Merma" value={formatMXN(report.produccion.merma)} />
        <Kpi label="Bolsa" value={formatMXN(report.produccion.bolsa)} />
        <Kpi label="Etiquetita" value={formatMXN(report.produccion.etiquetita)} />
        <Kpi label="Mano de obra (estimada)" value={formatMXN(report.produccion.manoDeObra)} />
      </SectionCard>

      <SectionCard title="Rentabilidad">
        <Kpi label="Ganancia bruta" value={formatMXN(report.rentabilidad.gananciaBruta)} />
        <Kpi label="Margen bruto" value={formatPct(report.rentabilidad.margenBruto)} />
        <Kpi label="Ganancia c/mano de obra" value={formatMXN(report.rentabilidad.gananciaDespuesManoObra)} />
        <Kpi label="Margen c/mano de obra" value={formatPct(report.rentabilidad.margenDespuesManoObra)} />
      </SectionCard>

      <SectionCard title="Gastos">
        <Kpi label="Total del periodo" value={formatMXN(report.gastos.total)} />
        {report.gastos.porCategoria.map((c) => (
          <Kpi key={c.category} label={c.category} value={formatMXN(c.total)} />
        ))}
      </SectionCard>

      <SectionCard title="Resultado">
        <Kpi
          label="Resultado operativo"
          value={formatMXN(report.resultado.resultadoOperativo)}
          hint="Ganancia después de mano de obra menos gastos operativos"
        />
        <Kpi
          label="Flujo de caja aproximado"
          value={formatMXN(report.resultado.flujoCajaAproximado)}
          hint="Pagos recibidos menos compras pagadas menos gastos pagados"
        />
        <Kpi label="Compras pagadas" value={formatMXN(report.resultado.comprasPagadas)} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailTable title="Pedidos del periodo" onExport={exportPedidos} count={report.detalle.pedidos.length}>
          {report.detalle.pedidos.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="text-foreground">{formatDate(o.createdAt.toISOString())}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatMXN(o.lineItems.reduce((s, l) => s + l.lineTotal, 0))}
              </span>
            </li>
          ))}
        </DetailTable>

        <DetailTable title="Pagos del periodo" onExport={exportPagos} count={report.detalle.pagos.length}>
          {report.detalle.pagos.map((p, i) => (
            <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="text-foreground">
                {formatDate(p.paidAt.toISOString())} · {p.type}
              </span>
              <span className="tabular-nums text-success">{formatMXN(p.amount)}</span>
            </li>
          ))}
        </DetailTable>

        <DetailTable title="Compras del periodo" onExport={exportCompras} count={report.detalle.compras.length}>
          {report.detalle.compras.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="text-foreground">{formatDate(p.purchaseDate.toISOString())}</span>
              <span className="tabular-nums text-muted-foreground">{formatMXN(p.finalPrice)}</span>
            </li>
          ))}
        </DetailTable>

        <DetailTable title="Gastos del periodo" onExport={exportGastos} count={report.detalle.gastos.length}>
          {report.detalle.gastos.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="text-foreground">
                {formatDate(e.date.toISOString())} · {e.category}
              </span>
              <span className="tabular-nums text-muted-foreground">{formatMXN(e.amount)}</span>
            </li>
          ))}
        </DetailTable>

        <DetailTable
          title="Productos más vendidos"
          onExport={exportProductos}
          count={report.detalle.productosMasVendidos.length}
        >
          {report.detalle.productosMasVendidos.map((p) => (
            <li key={p.name} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="text-foreground">{p.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {p.quantity} · {formatMXN(p.total)}
              </span>
            </li>
          ))}
        </DetailTable>

        <DetailTable title="Kits más vendidos" onExport={exportKits} count={report.detalle.kitsMasVendidos.length}>
          {report.detalle.kitsMasVendidos.map((k) => (
            <li key={k.name} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="text-foreground">{k.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {k.quantity} · {formatMXN(k.total)}
              </span>
            </li>
          ))}
        </DetailTable>
      </div>
    </div>
  );
}

function DetailTable({
  title,
  count,
  onExport,
  children,
}: {
  title: string;
  count: number;
  onExport: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel space-y-2 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-medium text-foreground">{title}</h3>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={onExport} disabled={count === 0}>
          <Download className="size-3.5" />
          CSV
        </Button>
      </div>
      {count === 0 ? (
        <p className="text-xs text-muted-foreground">Sin datos en este periodo.</p>
      ) : (
        <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">{children}</ul>
      )}
    </div>
  );
}
