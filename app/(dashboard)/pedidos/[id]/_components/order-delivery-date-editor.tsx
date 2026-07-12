"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setOrderDeliveryDate } from "@/lib/actions/orders";

function toInputValue(deliveryDate: string | null) {
  return deliveryDate ? deliveryDate.slice(0, 10) : "";
}

interface OrderDeliveryDateEditorProps {
  orderId: string;
  deliveryDate: string | null; // ISO string, serializado desde el server component
}

/**
 * Editor inline de la fecha de entrega de un pedido ya creado: mismo patrón
 * que order-status-select.tsx (useTransition + server action + toast +
 * router.refresh()). Guarda automáticamente al cambiar el valor del input,
 * sin botón de confirmación aparte (consistente con lo simple del control).
 */
export function OrderDeliveryDateEditor({ orderId, deliveryDate }: OrderDeliveryDateEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(toInputValue(deliveryDate));

  function handleChange(next: string) {
    setValue(next);
    startTransition(async () => {
      try {
        await setOrderDeliveryDate(orderId, next ? new Date(`${next}T12:00:00`) : null);
        toast.success(next ? "Fecha de entrega actualizada" : "Fecha de entrega eliminada");
        router.refresh();
      } catch (error) {
        toast.error("No se pudo actualizar la fecha de entrega", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  }

  return (
    <div className="glass-panel flex items-center gap-3 rounded-xl p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <CalendarDays className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor="order-delivery-date" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Fecha de entrega
        </Label>
        <Input
          id="order-delivery-date"
          type="date"
          value={value}
          disabled={isPending}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>
    </div>
  );
}
