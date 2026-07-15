"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleDollarSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPayment } from "@/lib/actions/payments";
import { OVERPAYMENT_MARKER } from "@/lib/payment-rules";

type PaymentType = "Anticipo" | "Liquidacion" | "Otro";
type PaymentMethod = "Efectivo" | "Transferencia" | "Tarjeta" | "Otro";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

interface RegisterPaymentDialogProps {
  orderId: string;
}

/**
 * Dialog simple para registrar un Payment sobre un Order: monto, tipo
 * (Anticipo/Liquidación/Otro), método (Efectivo/Transferencia/Tarjeta/Otro),
 * fecha de pago (default hoy, editable) y notas opcionales. Usa createPayment
 * de lib/actions/payments.ts.
 *
 * FASE 3 (V1): si el pago dejaría el total cobrado por encima del total del
 * pedido, createPayment lo rechaza con un mensaje marcado
 * (OVERPAYMENT_MARKER) — aquí se detecta ese caso, se pregunta con un
 * confirm, y si el usuario acepta se reintenta con allowOverpayment: true.
 */
export function RegisterPaymentDialog({ orderId }: RegisterPaymentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<PaymentType>("Anticipo");
  const [method, setMethod] = useState<PaymentMethod>("Efectivo");
  const [paidAt, setPaidAt] = useState(todayInputValue());
  const [notes, setNotes] = useState("");

  function reset() {
    setAmount("");
    setType("Anticipo");
    setMethod("Efectivo");
    setPaidAt(todayInputValue());
    setNotes("");
  }

  const parsedAmount = Number(amount) || 0;
  const canSubmit = parsedAmount > 0 && Boolean(paidAt);

  async function submit(allowOverpayment: boolean) {
    await createPayment({
      orderId,
      amount: parsedAmount,
      type,
      method,
      paidAt: new Date(`${paidAt}T12:00:00`),
      notes: notes || undefined,
      allowOverpayment,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      try {
        await submit(false);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith(OVERPAYMENT_MARKER)) {
          const detail = error.message.split(':').slice(1).join(':').trim();
          const confirmed = window.confirm(
            `${detail || "Este pago deja un sobrepago sobre el total del pedido."} ¿Registrarlo de todas formas?`
          );
          if (!confirmed) {
            setSubmitting(false);
            return;
          }
          await submit(true);
        } else {
          throw error;
        }
      }

      toast.success("Pago registrado");
      setOpen(false);
      reset();
      router.refresh();
    } catch (error) {
      toast.error("No se pudo registrar el pago", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="gap-1.5">
            <CircleDollarSign className="size-3.5" />
            Registrar pago
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>Anticipo, liquidación u otro cobro recibido sobre este pedido.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount">Monto</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-type">Tipo</Label>
              <Select
                value={type}
                items={[
                  { value: "Anticipo", label: "Anticipo" },
                  { value: "Liquidacion", label: "Liquidación" },
                  { value: "Otro", label: "Otro" },
                ]}
                onValueChange={(value) => setType((value as PaymentType) ?? "Anticipo")}
              >
                <SelectTrigger id="payment-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Anticipo">Anticipo</SelectItem>
                  <SelectItem value="Liquidacion">Liquidación</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payment-method">Método</Label>
              <Select
                value={method}
                items={[
                  { value: "Efectivo", label: "Efectivo" },
                  { value: "Transferencia", label: "Transferencia" },
                  { value: "Tarjeta", label: "Tarjeta" },
                  { value: "Otro", label: "Otro" },
                ]}
                onValueChange={(value) => setMethod((value as PaymentMethod) ?? "Efectivo")}
              >
                <SelectTrigger id="payment-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                  <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-date">Fecha de pago</Label>
              <Input id="payment-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-notes">Notas</Label>
            <Textarea
              id="payment-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting || !canSubmit}>
              {submitting ? "Guardando..." : "Registrar pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
