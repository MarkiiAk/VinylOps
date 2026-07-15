"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUS_OPTIONS, SELECTABLE_ORDER_STATUS_OPTIONS } from "@/components/order-status-badge";
import { updateOrderStatus } from "@/lib/actions/orders";

interface OrderStatusSelectProps {
  orderId: string;
  status: string;
  size?: "sm" | "default";
  className?: string;
}

/**
 * Select inline para cambiar la fase de kanban de un pedido — mismo patrón
 * que el cambio de status de Lead en leads-board-client.tsx (useTransition +
 * server action + toast + router.refresh()). Al llegar a Completado/Entregado
 * intenta descontar inventario (consumeInventory: true), igual que el flujo
 * viejo de cotizaciones.
 */
export function OrderStatusSelect({ orderId, status, size = "sm", className }: OrderStatusSelectProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(nextStatus: string | null) {
    if (!nextStatus || nextStatus === status) return;
    startTransition(async () => {
      try {
        const result = await updateOrderStatus(orderId, nextStatus, { consumeInventory: true });
        toast.success(`Status actualizado a ${nextStatus}`);

        // FASE 3 (V1, regla de días hábiles): ya había una fecha compromiso
        // (manual o de una aprobación anterior) — nunca se sobrescribe sola,
        // se pregunta antes de recalcularla.
        if (result.needsDeliveryDateConfirmation) {
          const confirmed = window.confirm(
            "Este pedido ya tenía una fecha de entrega comprometida. ¿Quieres recalcularla como 3 días hábiles a partir de hoy?"
          );
          if (confirmed) {
            await updateOrderStatus(orderId, nextStatus, {
              consumeInventory: true,
              confirmRecalculateDeliveryDate: true,
            });
            toast.success("Fecha de entrega recalculada");
          }
        }

        router.refresh();
      } catch (error) {
        toast.error("No se pudo actualizar el status", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  }

  return (
    <Select value={status} items={ORDER_STATUS_OPTIONS} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size={size} className={className ?? "w-40"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SELECTABLE_ORDER_STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
