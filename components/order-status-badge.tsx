import { cn } from "@/lib/utils";

// Fases de kanban de un pedido (Order), independientes del status del Lead
// (ver lead-status-badge.tsx): Disenando -> DisenoAprobado -> Maquilando ->
// Completado -> Entregado. Al llegar a Completado o Entregado se puede
// descontar inventario (ver updateOrderStatus en lib/actions/orders.ts).
export type OrderStatus = "Disenando" | "DisenoAprobado" | "Maquilando" | "Completado" | "Entregado";

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "Disenando", label: "Diseñando" },
  { value: "DisenoAprobado", label: "Diseño aprobado" },
  { value: "Maquilando", label: "Maquilando" },
  { value: "Completado", label: "Completado" },
  { value: "Entregado", label: "Entregado" },
];

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  Disenando: { label: "Diseñando", className: "bg-muted text-muted-foreground" },
  DisenoAprobado: { label: "Diseño aprobado", className: "bg-primary/15 text-primary" },
  Maquilando: { label: "Maquilando", className: "bg-warning/15 text-warning" },
  Completado: { label: "Completado", className: "bg-[oklch(0.68_0.2_300)]/15 text-neon-violet" },
  Entregado: { label: "Entregado", className: "bg-success/15 text-success" },
};

interface OrderStatusBadgeProps {
  status: OrderStatus | string;
  className?: string;
}

/** Badge de estado de pedido: Diseñando = neutral, Maquilando = ámbar, Completado = marca, Entregado = success. */
export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status as OrderStatus] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
