import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt, ShoppingCart } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOrder } from "@/lib/actions/orders";
import { OrderStatusSelect } from "../_components/order-status-select";
import { RegisterPaymentDialog } from "../_components/register-payment-dialog";
import { OrderDeliveryDateEditor } from "./_components/order-delivery-date-editor";
import { DeleteOrderButton } from "./_components/delete-order-button";

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

/**
 * Detalle de un pedido (Order): lead al que pertenece, líneas del carrito,
 * status de kanban con opción de cambiarlo, e historial de pagos. `getOrder`
 * ya incluye lead/lineItems/payments -> se traduce a notFound() si no existe.
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

  // FASE 2 (V1): agregado del snapshot financiero congelado por línea (ver
  // OrderLineItem en schema.prisma). Nullable porque líneas creadas antes de
  // esta fase no tienen desglose — se suman como 0, nunca se re-derivan.
  const totalDirectCost = order.lineItems.reduce((sum, line) => sum + (line.totalDirectCost ?? 0), 0);
  const totalLabor = order.lineItems.reduce((sum, line) => sum + (line.totalLabor ?? 0), 0);
  const grossProfit = total - totalDirectCost;
  const grossMargin = total ? grossProfit / total : 0;
  const profitAfterLabor = grossProfit - totalLabor;
  const marginAfterLabor = total ? profitAfterLabor / total : 0;

  // FASE 3 (V1): días restantes / atraso, calculados sobre la fecha
  // compromiso (order.deliveryDate) vs. hoy — solo tiene sentido mientras el
  // pedido no se haya entregado todavía.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const commitmentDate = order.deliveryDate ? new Date(order.deliveryDate) : null;
  if (commitmentDate) commitmentDate.setHours(0, 0, 0, 0);
  const daysRemaining = commitmentDate
    ? Math.round((commitmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isLate = order.status !== "Entregado" && daysRemaining !== null && daysRemaining < 0;

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
          action={
            <div className="flex items-center gap-2">
              <OrderStatusSelect orderId={order.id} status={order.status} size="default" className="w-48" />
              <DeleteOrderButton orderId={order.id} leadId={order.leadId} interest={order.interest} />
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Total del pedido</p>
          <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground">
            {formatMXN(total)}
          </p>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pagado</p>
          <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-success">
            {formatMXN(totalPaid)}
          </p>
        </div>
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Saldo pendiente</p>
          <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground">
            {formatMXN(Math.max(0, balance))}
          </p>
        </div>
      </div>

      <div className="glass-panel grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <p className="text-xs text-muted-foreground">Costo directo</p>
          <p className="tabular-nums font-medium text-foreground">{formatMXN(totalDirectCost)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ganancia bruta</p>
          <p className="tabular-nums font-medium text-success">
            {formatMXN(grossProfit)} <span className="text-xs text-muted-foreground">({(grossMargin * 100).toFixed(0)}%)</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Mano de obra</p>
          <p className="tabular-nums font-medium text-foreground">{formatMXN(totalLabor)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ganancia c/mano de obra</p>
          <p className="tabular-nums font-medium text-success">
            {formatMXN(profitAfterLabor)}{" "}
            <span className="text-xs text-muted-foreground">({(marginAfterLabor * 100).toFixed(0)}%)</span>
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground">Estado de entrega</p>
          <p className="font-medium text-foreground">{order.status === "Entregado" ? "Entregado" : "Pendiente"}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Nota: utilidad no es lo mismo que efectivo — &quot;Ganancia&quot; aquí es sobre el total vendido, no sobre lo cobrado.
      </p>

      <div className="glass-panel grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Fecha de aprobación</p>
          <p className="font-medium text-foreground">
            {order.designApprovedAt ? formatDate(order.designApprovedAt) : "Sin aprobar"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Fecha compromiso</p>
          <p className="font-medium text-foreground">
            {order.deliveryDate ? formatDate(order.deliveryDate) : "Sin definir"}
            {order.deliveryDate ? (
              <span className="ml-1 text-xs text-muted-foreground">
                {order.deliveryDateIsManual ? "(manual)" : "(auto)"}
              </span>
            ) : null}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Días restantes</p>
          <p className={`font-medium ${isLate ? "text-destructive" : "text-foreground"}`}>
            {order.status === "Entregado"
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
          <p className="font-medium text-foreground">{order.deliveredAt ? formatDate(order.deliveredAt) : "Pendiente"}</p>
        </div>
      </div>

      <OrderDeliveryDateEditor
        orderId={order.id}
        deliveryDate={order.deliveryDate ? order.deliveryDate.toISOString() : null}
      />

      {order.notes ? (
        <div className="glass-panel rounded-xl p-4">
          <p className="text-sm text-muted-foreground">{order.notes}</p>
        </div>
      ) : null}

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

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-medium text-foreground">Historial de pagos</h2>
          <RegisterPaymentDialog orderId={order.id} />
        </div>
        {order.payments.length === 0 ? (
          <EmptyState icon={Receipt} title="Sin pagos registrados" description="Registra el primer anticipo o liquidación de este pedido." />
        ) : (
          <div className="glass-panel divide-y divide-border rounded-xl">
            {order.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-4 px-4 py-3">
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
                <span className="shrink-0 text-sm font-medium tabular-nums text-success">
                  {formatMXN(payment.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
