import { cn } from "@/lib/utils";

export type QuoteStatus =
  | "Draft"
  | "Quoted"
  | "Accepted"
  | "Rejected"
  | "Completed"
  | "Cancelled";

const STATUS_CONFIG: Record<QuoteStatus, { label: string; className: string }> = {
  Draft: {
    label: "Borrador",
    className: "bg-muted text-muted-foreground",
  },
  Quoted: {
    label: "Cotizada",
    className: "bg-primary/15 text-primary",
  },
  Accepted: {
    label: "Aceptada",
    className: "bg-success/15 text-success",
  },
  Rejected: {
    label: "Rechazada",
    className: "bg-danger/15 text-danger",
  },
  Completed: {
    label: "Completada",
    className: "bg-[oklch(0.68_0.2_300)]/15 text-neon-violet",
  },
  Cancelled: {
    label: "Cancelada",
    className: "bg-muted text-muted-foreground line-through decoration-1",
  },
};

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
  className?: string;
}

/**
 * Badge de estado de cotizacion con semantica de color consistente:
 * Draft = neutral, Quoted = info (cian), Accepted = success (verde),
 * Rejected/Cancelled = danger/neutral, Completed = marca (violeta).
 */
export function QuoteStatusBadge({ status, className }: QuoteStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
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
