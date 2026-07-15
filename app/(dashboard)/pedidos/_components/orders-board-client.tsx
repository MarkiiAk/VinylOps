"use client";

import Link from "next/link";
import { ChevronRight, Kanban } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ORDER_STATUS_OPTIONS } from "@/components/order-status-badge";
import { OrderStatusSelect } from "./order-status-select";
import { RegisterPaymentDialog } from "./register-payment-dialog";
import { DeleteOrderButton } from "../[id]/_components/delete-order-button";

function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(iso));
}

function isPendingDelivery(status: string) {
  return status !== "Entregado" && status !== "Cerrado";
}

export interface OrderCardData {
  id: string;
  interest: string;
  status: string;
  deliveryDate: string | null; // ISO string, serializado desde el server component
  lead: { id: string; name: string | null; phone: string | null };
  total: number;
}

/**
 * Tablero Kanban de pedidos: una columna por Order.status (ver
 * ORDER_STATUS_OPTIONS). Cada tarjeta muestra lead/interés/total/entrega,
 * con Select inline para cambiar de fase (mismo patrón useTransition +
 * server action + toast + router.refresh() que leads-board-client.tsx) y un
 * dialog para registrar un pago.
 */
export function OrdersBoardClient({ orders }: { orders: OrderCardData[] }) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Kanban}
        title="No hay pedidos todavía"
        description="Los pedidos nacen desde el detalle de un lead ('Nuevo pedido')."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {ORDER_STATUS_OPTIONS.map((column) => {
        const columnOrders = orders.filter((order) => order.status === column.value);
        return (
          <div key={column.value} className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">
                {column.label}
              </h2>
              <span className="text-xs text-muted-foreground">{columnOrders.length}</span>
            </div>

            <div className="space-y-3">
              {columnOrders.map((order) => (
                <div key={order.id} className="glass-panel flex flex-col gap-3 rounded-xl p-3">
                  <Link href={`/pedidos/${order.id}`} className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium text-foreground">
                        {order.lead.name || "Sin nombre"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{order.lead.phone || "Sin teléfono"}</p>
                    </div>
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </Link>

                  <p className="line-clamp-2 text-xs text-muted-foreground">{order.interest}</p>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium tabular-nums text-foreground">
                      {formatMXN(order.total)}
                    </span>
                    {order.deliveryDate ? (
                      <span
                        className={`text-xs ${
                          isPendingDelivery(order.status) && new Date(order.deliveryDate) < new Date(new Date().toDateString())
                            ? "font-medium text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {isPendingDelivery(order.status) && new Date(order.deliveryDate) < new Date(new Date().toDateString())
                          ? "Atrasado · "
                          : "Entrega: "}
                        {formatDate(order.deliveryDate)}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-border pt-2">
                    <OrderStatusSelect orderId={order.id} status={order.status} className="w-full" />
                    <div className="flex items-center gap-2">
                      <RegisterPaymentDialog orderId={order.id} />
                      <DeleteOrderButton
                        orderId={order.id}
                        leadId={order.lead.id}
                        interest={order.interest}
                        stayOnPage
                        className="ml-auto"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
