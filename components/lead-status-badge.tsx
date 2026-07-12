import { cn } from "@/lib/utils";

// El Lead tiene solo 3 fases "de vida" + 2 excepciones (confirmado por
// Marco, 2026-07-07 — reemplaza un esquema anterior de 11 fases que
// mezclaba la relación comercial con el avance de un pedido puntual, eso
// era un error): Contacto (primer "hola" de WhatsApp) -> Ganado (dijo que sí
// y dio aunque sea $1 de anticipo) -> Cliente (ya se le entregó al menos un
// trabajo completo). Pendiente y Perdido son excepciones fuera de esa línea:
// Pendiente = "en el limbo" (le diste info, no contestó, ni sí ni no);
// Perdido = rechazó la compra explícitamente. El status del Lead es
// independiente del status de kanban de sus pedidos (ver Order.status).
export type LeadStatus = "Contacto" | "Pendiente" | "Ganado" | "Cliente" | "Perdido";

export const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "Contacto", label: "Contacto" },
  { value: "Pendiente", label: "Pendiente" },
  { value: "Ganado", label: "Ganado" },
  { value: "Cliente", label: "Cliente" },
  { value: "Perdido", label: "Perdido" },
];

const STATUS_CONFIG: Record<LeadStatus, { label: string; className: string }> = {
  Contacto: { label: "Contacto", className: "bg-muted text-muted-foreground" },
  Pendiente: { label: "Pendiente", className: "bg-warning/15 text-warning" },
  Ganado: { label: "Ganado", className: "bg-[oklch(0.68_0.2_300)]/15 text-neon-violet" },
  Cliente: { label: "Cliente", className: "bg-success/15 text-success" },
  Perdido: {
    label: "Perdido",
    className: "bg-muted text-muted-foreground line-through decoration-1",
  },
};

interface LeadStatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Badge de estado de lead, mismo criterio visual que QuoteStatusBadge:
 * Contacto = neutral, Pendiente = ámbar (algo quedó a medias), Ganado =
 * marca (violeta), Cliente = success (verde), Perdido = neutral tachado.
 */
export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const config = STATUS_CONFIG[status as LeadStatus] ?? {
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
