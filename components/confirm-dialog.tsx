"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
  onConfirm: () => void;
}

/**
 * Reemplaza window.confirm() en toda la app: mismo patrón en todos lados
 * (useState para abrir/cerrar + este dialog + onConfirm dispara la acción
 * real). `loading` deshabilita ambos botones y muestra un spinner en el de
 * confirmar mientras la acción está en curso (useTransition del caller).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={
              <Button type="button" variant="outline" disabled={loading}>
                {cancelLabel}
              </Button>
            }
          />
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={loading}
            className="gap-1.5"
            onClick={onConfirm}
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {loading ? "Procesando..." : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
