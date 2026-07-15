"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateOrderStatus } from "@/lib/actions/orders";

interface CloseOrderButtonProps {
  orderId: string;
}

/**
 * Paso 9 del flujo: cierre financiero del pedido, distinto de "Entregado"
 * (que solo marca la entrega física). Solo se muestra cuando ya está
 * Entregado y sin saldo pendiente (ver canClose en page.tsx) — no dispara
 * consumo de inventario, eso ya pasó antes en Completado/Entregado.
 */
export function CloseOrderButton({ orderId }: CloseOrderButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClose() {
    const confirmed = window.confirm(
      "¿Cerrar este pedido? Marca que ya quedó completamente liquidado y resuelto."
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await updateOrderStatus(orderId, "Cerrado");
        toast.success("Pedido cerrado");
        router.refresh();
      } catch (error) {
        toast.error("No se pudo cerrar el pedido", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={isPending} onClick={handleClose}>
      <Lock className="size-3.5" />
      {isPending ? "Cerrando..." : "Cerrar pedido"}
    </Button>
  );
}
