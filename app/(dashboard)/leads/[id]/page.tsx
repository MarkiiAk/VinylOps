import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, ShoppingCart } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { getLeadWithOrders } from "@/lib/actions/leads";
import { LeadFormDialog } from "../_components/lead-form-dialog";
import { DeleteOrderButton } from "../../pedidos/[id]/_components/delete-order-button";

function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(date)
  );
}

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Detalle de un lead: datos de contacto + historial completo de sus pedidos
 * (Order). El status del lead es la relación comercial (Contacto..Cliente),
 * independiente del status de kanban de cada pedido. `getLeadWithOrders`
 * lanza si no existe -> se traduce a notFound() de Next para el 404 estandar.
 */
export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;

  let lead;
  try {
    lead = await getLeadWithOrders(id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/leads"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver a leads
        </Link>
        <SectionHeading
          title={lead.name || "Sin nombre"}
          subtitle={[lead.phone || "Sin teléfono", `Contacto desde ${formatDate(lead.createdAt)}`].join(" · ")}
          action={
            <div className="flex flex-wrap gap-2">
              <LeadFormDialog
                lead={{
                  id: lead.id,
                  name: lead.name,
                  phone: lead.phone,
                  status: lead.status,
                  notes: lead.notes,
                }}
              />
              <Link href={`/leads/${lead.id}/nuevo-pedido`}>
                <Button className="gap-1.5 bg-neon-pink text-background hover:bg-neon-pink/90">
                  <Plus className="size-4" />
                  Nuevo pedido
                </Button>
              </Link>
            </div>
          }
        />
      </div>

      <div className="glass-panel flex flex-wrap items-center gap-4 rounded-xl p-4">
        <LeadStatusBadge status={lead.status} />
        {lead.notes ? (
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">{lead.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sin notas.</p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-sm font-medium text-foreground">Historial de pedidos</h2>
        {lead.orders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Sin pedidos todavía"
            description="Cuando este lead confirme una compra, crea su primer pedido aquí."
            action={
              <Link href={`/leads/${lead.id}/nuevo-pedido`}>
                <Button size="sm" className="bg-neon-pink text-background hover:bg-neon-pink/90">
                  Nuevo pedido
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="glass-panel divide-y divide-border rounded-xl">
            {lead.orders.map((order) => {
              const total = order.lineItems.reduce((sum, line) => sum + line.lineTotal, 0);
              return (
                <div
                  key={order.id}
                  className="flex items-center gap-2 px-4 py-3 transition-colors hover:bg-sidebar-accent/40"
                >
                  <Link href={`/pedidos/${order.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-sm font-medium text-foreground">{order.interest}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(order.createdAt)}
                        {order.deliveryDate ? ` · Entrega: ${formatDate(order.deliveryDate)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium tabular-nums text-foreground">{formatMXN(total)}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </Link>
                  <DeleteOrderButton orderId={order.id} leadId={lead.id} interest={order.interest} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
