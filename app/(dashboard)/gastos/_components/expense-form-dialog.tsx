"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
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
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES, EXPENSE_METHODS } from "@/lib/expense-categories";

export interface ExpenseFormValues {
  id: string;
  date: string; // ISO string, serializado desde el server component
  concept: string;
  category: string;
  amount: number;
  method: string;
  beneficiary: string | null;
  notes: string | null;
  receiptUrl: string | null;
}

interface ExpenseFormDialogProps {
  expense?: ExpenseFormValues;
  trigger?: React.ReactNode;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm = {
  date: todayInputValue(),
  concept: "",
  category: EXPENSE_CATEGORIES[0] as string,
  amount: "",
  method: EXPENSE_METHODS[0] as string,
  beneficiary: "",
  notes: "",
  receiptUrl: "",
};

/**
 * Dialog crear/editar Expense (gasto operativo) — mismo patrón que
 * MaterialFormDialog: estado local, server action, toast, router.refresh().
 */
export function ExpenseFormDialog({ expense, trigger }: ExpenseFormDialogProps) {
  const router = useRouter();
  const isEdit = !!expense;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    if (expense) {
      setForm({
        date: expense.date.slice(0, 10),
        concept: expense.concept,
        category: expense.category,
        amount: String(expense.amount),
        method: expense.method,
        beneficiary: expense.beneficiary ?? "",
        notes: expense.notes ?? "",
        receiptUrl: expense.receiptUrl ?? "",
      });
    } else {
      setForm(emptyForm);
    }
  }

  const parsedAmount = Number(form.amount) || 0;
  const canSubmit = form.concept.trim().length > 0 && parsedAmount > 0 && Boolean(form.date);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        date: new Date(`${form.date}T12:00:00`),
        concept: form.concept,
        category: form.category,
        amount: parsedAmount,
        method: form.method,
        beneficiary: form.beneficiary || undefined,
        notes: form.notes || undefined,
        receiptUrl: form.receiptUrl || undefined,
      };

      if (isEdit && expense) {
        await updateExpense(expense.id, payload);
        toast.success("Gasto actualizado", { description: form.concept });
      } else {
        await createExpense(payload);
        toast.success("Gasto registrado", { description: form.concept });
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(isEdit ? "No se pudo actualizar el gasto" : "No se pudo registrar el gasto", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button className="gap-1.5">
              <Plus className="size-4" />
              Registrar gasto
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar gasto" : "Registrar gasto"}</DialogTitle>
          <DialogDescription>
            Gasto operativo — NO usar aquí para compras de material (esas van en Materiales → Compras).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="expense-concept">Concepto</Label>
            <Input
              id="expense-concept"
              value={form.concept}
              onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))}
              placeholder="Ej. Anuncio en Facebook"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Importe</Label>
              <Input
                id="expense-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-date">Fecha</Label>
              <Input
                id="expense-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expense-category">Categoría</Label>
              <Select
                value={form.category}
                items={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
                onValueChange={(value) => setForm((f) => ({ ...f, category: value ?? f.category }))}
              >
                <SelectTrigger id="expense-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-method">Método</Label>
              <Select
                value={form.method}
                items={EXPENSE_METHODS.map((m) => ({ value: m, label: m }))}
                onValueChange={(value) => setForm((f) => ({ ...f, method: value ?? f.method }))}
              >
                <SelectTrigger id="expense-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-beneficiary">Proveedor / beneficiario (opcional)</Label>
            <Input
              id="expense-beneficiary"
              value={form.beneficiary}
              onChange={(e) => setForm((f) => ({ ...f, beneficiary: e.target.value }))}
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-receipt">Comprobante (link, opcional)</Label>
            <Input
              id="expense-receipt"
              value={form.receiptUrl}
              onChange={(e) => setForm((f) => ({ ...f, receiptUrl: e.target.value }))}
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-notes">Notas</Label>
            <Textarea
              id="expense-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Opcional"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting || !canSubmit}>
              {submitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditExpenseTrigger() {
  return (
    <Button size="sm" variant="ghost" className="gap-1.5">
      <Pencil className="size-3.5" />
      Editar
    </Button>
  );
}
