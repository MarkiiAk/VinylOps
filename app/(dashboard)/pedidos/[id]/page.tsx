import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ShoppingCart,
  UserRound,
  Palette,
  HandCoins,
  PackageCheck,
  Calculator,
} from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/order-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOrder } from "@/lib/actions/orders";
import type { Payment } from "@/lib/generated/prisma/client";
import { OrderStatusSelect } from "../_components/order-status-select";
import { RegisterPaymentDialog } from "../_components/register-payment-dialog";
import { OrderDeliveryDateEditor } from "./_components/order-delivery-date-editor";
import { DeleteOrderButton } from "./_components/delete-order-button";
import { CloseOrderButton } from "./_components/close-order-button";
import { OrderFlowStepper } from "./_components/order-flow-stepper";

function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(date)
  );
}

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

const STATUS_ORDER = ["Disenando", "DisenoAprobado", "Maquilando", "Completado", "Entregado", "Cerrado"];

type OrderLineItem = Awaited<ReturnType<typeof getOrder>>["lineItems"][number];

function statusIndex(status: string) {
  const i = STATUS_ORDER.indexOf(status);
  return i === -1 ? 0 : i;
}

function PaymentRow({ payment }: { payment: Payment }) {
  return (
    <div key={payment.id} className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          {payment.type === "Anticipo" ? "Anticipo" : payment.type === "Liquidacion" ? "Liquidación" : "Otro"}
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">· {payment.method}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(payment.paidAt)}
          {payment.notes ? ` · ${payment.notes}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums text-success">{formatMXN(payment.amount)}</span>
    </div>
  );
}

/**
 * Detalle de un pedido, organizado literal como el flujo real del negocio
 * (contacto -> diseño -> autorización -> trabajo -> anticipo -> entrega y
 * liquidación -> corte de ganancia -> cierre) en vez de tarjetas sueltas.
 * Cada sección usa exactamente los datos/acciones que ya existían
 * (OrderStatusSelect, RegisterPaymentDialog, OrderDeliveryDateEditor),
 * reposicionados bajo el paso que les corresponde.
 */
export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;

  let order;
  try {
    order = await getOrder(id);
  } catch {
    notFound();
  }

  const total = order.lineItems.reduce((sum, line) => sum + line.lineTotal, 0);
  const totalPaid = order.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = total - totalPaid;

  const anticipos = order.payments.filter((p) => p.type === "Anticipo");
  const liquidaciones = order.payments.filter((p) => p.type === "Liquidacion");
  const otrosPagos = order.payments.filter((p) => p.type !== "Anticipo" && p.type !== "Liquidacion");

  // Paso 8 (corte de ganancia): el desglose por componente ya viene congelado
  // por línea (unit*Cost en OrderLineItem, ver lib/costing.ts). Material/
  // tinta/luz/desgaste/merma escalan por cantidad; bolsa/etiquetita NO —
  // createOrder ya congela un solo total de bolsa/etiquetita para todo el
  // pedido (en la primera línea), así que aquí se suman tal cual, sin
  // volver a multiplicar por cantidad.
  const sumComponent = (pick: (line: OrderLineItem) => number | null) =>
    order.lineItems.reduce((sum, line) => sum + (pick(line) ?? 0) * line.quantity, 0);
  const sumFlatComponent = (pick: (line: OrderLineItem) => number | null) =>
    order.lineItems.reduce((sum, line) => sum + (pick(line) ?? 0), 0);

  const costoMaterial = sumComponent((l) => l.unitMaterialCost);
  const costoTinta = sumComponent((l) => l.unitInkCost);
  const costoLuz = sumComponent((l) => l.unitElectricityCost);
  const costoDesgaste = sumComponent((l) => l.unitWearCost);
  const costoMerma = sumComponent((l) => l.unitWasteCost);
  const costoBolsaEtiqueta = sumFlatComponent((l) => l.unitBagCost) + sumFlatComponent((l) => l.unitLabelCost);

  const totalDirectCost = order.lineItems.reduce((sum, line) => sum + (line.totalDirectCost ?? 0), 0);
  const totalLabor = order.lineItems.reduce((sum, line) => sum + (line.totalLabor ?? 0), 0);
  const gananciaPedido = total - totalDirectCost - totalLabor;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const commitmentDate = order.deliveryDate ? new Date(order.deliveryDate) : null;
  if (commitmentDate) commitmentDate.setHours(0, 0, 0, 0);
  const daysRemaining = commitmentDate
    ? Math.round((commitmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isDone = order.status === "Entregado" || order.status === "Cerrado";
  const isLate = !isDone && daysRemaining !== null && daysRemaining < 0;

  const idx = statusIndex(order.status);
  const steps = [
    { label: "Contacto", done: true },
    { label: "Diseño", done: idx >= 1 },
    { label: "Autorización", done: Boolean(order.designApprovedAt) },
    { label: "Trabajo", done: idx >= 2 },
    { label: "Anticipo", done: anticipos.length > 0 },
    { label: "Entrega y liquidación", done: idx >= 4 && liquidaciones.length > 0 },
    { label: "Corte de ganancia", done: idx >= 3 },
    { label: "Cierre", done: order.status === "Cerrado" },
  ];

  const canClose = order.status === "Entregado" && balance <= 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/leads/${order.leadId}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver a {order.lead.name || "el lead"}
        </Link>
        <SectionHeading
          title={order.interest}
          subtitle={[
            order.lead.name || "Sin nombre",
            order.lead.phone || "Sin teléfono",
            `Creado ${formatDate(order.createdAt)}`,
          ].join(" · ")}
          action={<DeleteOrderButton orderId={order.id} leadId={order.leadId} interest={order.interest} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Total del pedido</p>
          <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground">{formatMXN(total)}</p>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pagado</p>
          <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-success">{formatMXN(totalPaid)}</p>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Saldo pendiente</p>
          <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground">
            {formatMXN(Math.max(0, balance))}
          </p>
        </div>
      </div>

      <OrderFlowStepper steps={steps} />

      {/* Paso 1: Contacto */}
      <section className="glass-panel space-y-2 rounded-xl p-4">
        <h2 className="flex items-center gap-2 font-heading text-sm font-medium text-foreground">
          <UserRound className="size-4 text-primary" />
          Paso 1 · Contacto
        </h2>
        <p className="text-sm text-foreground">
          {order.lead.name || "Sin nombre"} · {order.lead.phone || "Sin teléfono"}
        </p>
        <Link href={`/leads/${order.leadId}`} className="inline-block text-xs text-primary hover:underline">
          Ver historial completo de este cliente
        </Link>
      </section>

      {/* Pasos 2-4: Diseño, autorización y trabajo */}
      <section className="glass-panel space-y-3 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-heading text-sm font-medium text-foreground">
            <Palette className="size-4 text-primary" />
            Pasos 2-4 · Diseño, autorización y trabajo
          </h2>
          <OrderStatusSelect orderId={order.id} status={order.status} size="default" className="w-48" />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Fecha de aprobación</p>
            <p className="font-medium text-foreground">
              {order.designApprovedAt ? formatDate(order.designApprovedAt) : "Sin aprobar"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fase actual</p>
            <OrderStatusBadge status={order.status} />
          </div>
        </div>
        {order.notes ? <p className="text-sm text-muted-foreground">{order.notes}</p> : null}
      </section>

      {/* Paso 5: Anticipo */}
      <section className="glass-panel space-y-2 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-heading text-sm font-medium text-foreground">
            <HandCoins className="size-4 text-primary" />
            Paso 5 · Anticipo
          </h2>
          <RegisterPaymentDialog orderId={order.id} />
        </div>
        {anticipos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin anticipo registrado todavía.</p>
        ) : (
          <div className="divide-y divide-border">
            {anticipos.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </div>
        )}
      </section>

      {/* Paso 6: Entrega y liquidación */}
      <section className="glass-panel space-y-3 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-heading text-sm font-medium text-foreground">
            <PackageCheck className="size-4 text-primary" />
            Paso 6 · Entrega y liquidación
          </h2>
          <RegisterPaymentDialog orderId={order.id} />
        </div>

        <OrderDeliveryDateEditor
          orderId={order.id}
          deliveryDate={order.deliveryDate ? order.deliveryDate.toISOString() : null}
        />

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Días restantes</p>
            <p className={`font-medium ${isLate ? "text-destructive" : "text-foreground"}`}>
              {isDone
                ? "—"
                : daysRemaining === null
                  ? "Sin fecha"
                  : isLate
                    ? `Atrasado ${Math.abs(daysRemaining)} día(s)`
                    : `${daysRemaining} día(s)`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Entrega real</p>
            <p className="font-medium text-foreground">
              {order.deliveredAt ? formatDate(order.deliveredAt) : "Pendiente"}
            </p>
          </div>
        </div>

        {liquidaciones.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin liquidación registrada todavía.</p>
        ) : (
          <div className="divide-y divide-border">
            {liquidaciones.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </div>
        )}

        {otrosPagos.length > 0 ? (
          <div className="space-y-1 border-t border-border pt-2">
            <p className="text-xs text-muted-foreground">Otros pagos</p>
            <div className="divide-y divide-border">
              {otrosPagos.map((payment) => (
                <PaymentRow key={payment.id} payment={payment} />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <div className="space-y-3">
        <h2 className="font-heading text-sm font-medium text-foreground">Líneas del carrito</h2>
        {order.lineItems.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Sin líneas" description="Este pedido no tiene líneas registradas." />
        ) : (
          <div className="glass-panel overflow-x-auto rounded-xl">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Descripción</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio unitario</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lineItems.map((line) => (
                  <TableRow key={line.id} className="border-border">
                    <TableCell className="font-medium text-foreground">{line.description}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {line.catalogItemId ? "Catálogo" : "Otro"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{line.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatMXN(line.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-foreground">
                      {formatMXN(line.lineTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Paso 8: Corte de ganancia */}
      <section className="glass-panel space-y-3 rounded-xl p-4">
        <h2 className="flex items-center gap-2 font-heading text-sm font-medium text-foreground">
          <Calculator className="size-4 text-primary" />
          Paso 8 · Corte de ganancia
        </h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Venta total</p>
            <p className="tabular-nums font-medium text-foreground">{formatMXN(total)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Material</p>
            <p className="tabular-nums font-medium text-foreground">{formatMXN(costoMaterial)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tinta</p>
            <p className="tabular-nums font-medium text-foreground">{formatMXN(costoTinta)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Luz</p>
            <p className="tabular-nums font-medium text-foreground">{formatMXN(costoLuz)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Desgaste</p>
            <p className="tabular-nums font-medium text-foreground">{formatMXN(costoDesgaste)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Merma</p>
            <p className="tabular-nums font-medium text-foreground">{formatMXN(costoMerma)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bolsa/etiqueta</p>
            <p className="tabular-nums font-medium text-foreground">{formatMXN(costoBolsaEtiqueta)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Mano de obra</p>
            <p className="tabular-nums font-medium text-foreground">{formatMXN(totalLabor)}</p>
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Ganancia de este pedido (venta − material/maquila − mano de obra)
          </p>
          <p className="font-heading text-2xl font-semibold text-success">{formatMXN(gananciaPedido)}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          No incluye gasto operativo del negocio (luz de la casa, herramientas, etc.) — eso se ve agregado en
          Reportes, no repartido por pedido.
        </p>
      </section>

      {/* Paso 9: Cierre */}
      <section className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
        <div className="space-y-1">
          <h2 className="font-heading text-sm font-medium text-foreground">Paso 9 · Cierre</h2>
          <p className="text-xs text-muted-foreground">
            {order.status === "Cerrado"
              ? "Este pedido ya está cerrado."
              : canClose
                ? "Ya está entregado y liquidado — listo para cerrar."
                : "Se habilita cuando el pedido esté Entregado y sin saldo pendiente."}
          </p>
        </div>
        {order.status === "Cerrado" ? (
          <OrderStatusBadge status="Cerrado" />
        ) : canClose ? (
          <CloseOrderButton orderId={order.id} />
        ) : null}
      </section>
    </div>
  );
}
