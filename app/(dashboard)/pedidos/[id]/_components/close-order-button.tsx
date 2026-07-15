"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClose() {
    startTransition(async () => {
      try {
        await updateOrderStatus(orderId, "Cerrado");
        toast.success("Pedido cerrado");
        setConfirmOpen(false);
        router.refresh();
      } catch (error) {
        toast.error("No se pudo cerrar el pedido", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={isPending}
        onClick={() => setConfirmOpen(true)}
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
        {isPending ? "Cerrando..." : "Cerrar pedido"}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Cerrar pedido"
        description="¿Cerrar este pedido? Marca que ya quedó completamente liquidado y resuelto."
        confirmLabel="Cerrar pedido"
        loading={isPending}
        onConfirm={handleClose}
      />
    </>
  );
}
