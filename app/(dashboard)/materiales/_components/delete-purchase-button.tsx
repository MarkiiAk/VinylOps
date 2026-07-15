"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deletePurchase } from "@/lib/actions/purchases";

interface DeletePurchaseButtonProps {
  purchaseId: string;
  label: string;
}

/**
 * Elimina una compra ya registrada y le regresa al material el área/valor
 * que había aportado (ver deletePurchase en lib/actions/purchases.ts) — para
 * corregir compras de prueba o capturadas por error, sin tener que ajustar
 * el inventario a mano.
 */
export function DeletePurchaseButton({ purchaseId, label }: DeletePurchaseButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deletePurchase(purchaseId);
        toast.success("Compra eliminada");
        setConfirmOpen(false);
        router.refresh();
      } catch (error) {
        toast.error("No se pudo eliminar la compra", {
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
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={isPending}
        onClick={() => setConfirmOpen(true)}
        title="Eliminar compra"
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Eliminar compra"
        description={`¿Eliminar la compra "${label}"? Le regresa al material el área/valor que había aportado. No se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        loading={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
