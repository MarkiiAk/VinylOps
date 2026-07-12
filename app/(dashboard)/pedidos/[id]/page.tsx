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
          action={<OrderStatusSelect orderId={order.id} status={order.status} size="default" className="w-48" />}
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
                    {payment.type === "Anticipo" ? "Anticipo" : "Liquidación"}
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
