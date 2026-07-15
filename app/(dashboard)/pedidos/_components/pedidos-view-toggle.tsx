import Link from "next/link";
import { Kanban, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface PedidosViewToggleProps {
  vista: "kanban" | "calendario";
}

/** Cambia entre el tablero Kanban y la vista calendario de /pedidos (antes /calendario, ruta aparte). */
export function PedidosViewToggle({ vista }: PedidosViewToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
      <Link
        href="/pedidos"
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          vista === "kanban"
            ? "bg-sidebar-accent text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Kanban className="size-3.5" />
        Tablero
      </Link>
      <Link
        href="/pedidos?vista=calendario"
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          vista === "calendario"
            ? "bg-sidebar-accent text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <CalendarDays className="size-3.5" />
        Calendario
      </Link>
    </div>
  );
}
