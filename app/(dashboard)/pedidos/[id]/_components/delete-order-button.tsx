"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteOrder } from "@/lib/actions/orders";

interface DeleteOrderButtonProps {
  orderId: string;
  leadId: string;
  interest: string;
  /** true = no navega a ningún lado al terminar, solo refresca (para usarlo en listas como el kanban, donde no tiene sentido salir de la pantalla). Default: navega a /leads/[leadId]. */
  stayOnPage?: boolean;
}

/**
 * Elimina el pedido completo (pagos/líneas en cascada, inventario
 * consumido se le regresa al material — ver deleteOrder en
 * lib/actions/orders.ts). Confirm simple porque es una acción destructiva
 * sin deshacer; redirige de vuelta al lead al terminar, salvo que se pida
 * quedarse en la pantalla actual (ver stayOnPage).
 */
export function DeleteOrderButton({ orderId, leadId, interest, stayOnPage = false }: DeleteOrderButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    const confirmed = window.confirm(
      `¿Eliminar el pedido "${interest}"? Esto borra sus pagos y líneas, y regresa al inventario cualquier material que se le hubiera descontado. No se puede deshacer.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteOrder(orderId);
        toast.success("Pedido eliminado");
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
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={isPending}
      onClick={handleDelete}
      title="Eliminar pedido"
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
