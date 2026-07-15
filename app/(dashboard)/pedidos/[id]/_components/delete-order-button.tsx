"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { deleteOrder } from "@/lib/actions/orders";

interface DeleteOrderButtonProps {
  orderId: string;
  leadId: string;
  interest: string;
  /** true = no navega a ningún lado al terminar, solo refresca (para usarlo en listas como el kanban, donde no tiene sentido salir de la pantalla). Default: navega a /leads/[leadId]. */
  stayOnPage?: boolean;
  className?: string;
}

/**
 * Elimina el pedido completo (pagos/líneas en cascada, inventario
 * consumido se le regresa al material — ver deleteOrder en
 * lib/actions/orders.ts). Confirm vía ConfirmDialog porque es una acción
 * destructiva sin deshacer; redirige de vuelta al lead al terminar, salvo
 * que se pida quedarse en la pantalla actual (ver stayOnPage).
 */
export function DeleteOrderButton({
  orderId,
  leadId,
  interest,
  stayOnPage = false,
  className,
}: DeleteOrderButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteOrder(orderId);
        toast.success("Pedido eliminado");
        setConfirmOpen(false);
        if (!stayOnPage) {
          router.push(`/leads/${leadId}`);
        }
        router.refresh();
      } catch (error) {
        toast.error("No se pudo eliminar el pedido", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn("text-destructive hover:bg-destructive/10 hover:text-destructive", className)}
        disabled={isPending}
        onClick={() => setConfirmOpen(true)}
        title="Eliminar pedido"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Eliminar pedido"
        description={`¿Eliminar el pedido "${interest}"? Esto borra sus pagos y líneas, y regresa al inventario cualquier material que se le hubiera descontado. No se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        loading={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
