"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarOff, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addNonWorkingDay, removeNonWorkingDay } from "@/lib/actions/non-working-days";

export interface NonWorkingDayRow {
  id: string;
  date: string; // ISO string, serializado desde el server component
  label: string | null;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/**
 * Config simple de días no laborables (Fase 3, V1) — para la regla de "3
 * días hábiles después de aprobar diseño" (ver lib/business-days.ts). Sin
 * integración a calendario externo, solo una lista editable.
 */
export function NonWorkingDaysManager({ days }: { days: NonWorkingDayRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    startTransition(async () => {
      try {
        await addNonWorkingDay(new Date(`${date}T12:00:00`), label || undefined);
        toast.success("Día no laborable agregado");
        setDate("");
        setLabel("");
        router.refresh();
      } catch (error) {
        toast.error("No se pudo agregar", { description: error instanceof Error ? error.message : undefined });
      }
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      try {
        await removeNonWorkingDay(id);
        toast.success("Día no laborable eliminado");
        router.refresh();
      } catch (error) {
        toast.error("No se pudo eliminar", { description: error instanceof Error ? error.message : undefined });
      }
    });
  }

  return (
    <div className="glass-panel space-y-4 rounded-xl p-5">
      <div className="flex items-center gap-2">
        <CalendarOff className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-sm font-medium text-foreground">Días no laborables</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Estos días no cuentan para la regla de 3 días hábiles después de aprobar un diseño (además de sábados y
        domingos, que nunca cuentan).
      </p>

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="non-working-date" className="text-xs text-muted-foreground">
            Fecha
          </Label>
          <Input id="non-working-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="non-working-label" className="text-xs text-muted-foreground">
            Motivo (opcional)
          </Label>
          <Input
            id="non-working-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej. Puente, vacaciones"
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending || !date} className="gap-1.5">
          <Plus className="size-3.5" />
          Agregar
        </Button>
      </form>

      {days.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin días configurados.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {days.map((day) => (
            <li key={day.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="text-foreground">
                {formatDate(day.date)}
                {day.label ? <span className="ml-1.5 text-xs text-muted-foreground">· {day.label}</span> : null}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => handleRemove(day.id)}
              >
                <X className="size-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
