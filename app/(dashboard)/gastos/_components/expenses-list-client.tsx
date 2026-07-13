"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Receipt, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { deleteExpense } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { isDateInRange, type DateRangePreset } from "@/lib/date-ranges";
import { ExpenseFormDialog, type ExpenseFormValues } from "./expense-form-dialog";

export interface ExpenseRow {
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

const RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "mesAnterior", label: "Mes anterior" },
  { value: "todos", label: "Todos" },
];

const ALL_CATEGORIES = "__all__";

function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

/**
 * Listado de gastos operativos (Expense) con filtro de rango de fecha
 * (en memoria, mismo criterio que otros listados del repo) y categoría, más
 * el total del periodo filtrado. CRUD vía ExpenseFormDialog + deleteExpense.
 */
export function ExpensesListClient({ expenses }: { expenses: ExpenseRow[] }) {
  const router = useRouter();
  const [range, setRange] = useState<DateRangePreset>("mes");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      expenses.filter(
        (e) => isDateInRange(new Date(e.date), range) && (category === ALL_CATEGORIES || e.category === category)
      ),
    [expenses, range, category]
  );

  const total = useMemo(() => filtered.reduce((sum, e) => sum + e.amount, 0), [filtered]);

  async function handleDelete(expense: ExpenseRow) {
    const confirmed = window.confirm(`¿Eliminar el gasto "${expense.concept}" (${formatMXN(expense.amount)})?`);
    if (!confirmed) return;
    setDeletingId(expense.id);
    try {
      await deleteExpense(expense.id);
      toast.success("Gasto eliminado");
      router.refresh();
    } catch (error) {
      toast.error("No se pudo eliminar el gasto", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setDeletingId(null);
    }
  }

  function toFormValues(expense: ExpenseRow): ExpenseFormValues {
    return { ...expense };
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel flex flex-wrap items-end gap-3 rounded-xl p-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Periodo</Label>
          <Select value={range} onValueChange={(v) => setRange((v as DateRangePreset) ?? "mes")}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Categoría</Label>
          <Select value={category} onValueChange={(v) => setCategory(v ?? ALL_CATEGORIES)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>Todas</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto space-y-0.5 text-right">
          <p className="text-xs text-muted-foreground">Total del periodo</p>
          <p className="font-heading text-xl font-semibold tabular-nums text-foreground">{formatMXN(total)}</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin gastos en este periodo"
          description="Los gastos operativos que registres aparecerán aquí."
        />
      ) : (
        <div className="glass-panel divide-y divide-border rounded-xl">
          {filtered.map((expense) => (
            <div key={expense.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-medium text-foreground">{expense.concept}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDate(expense.date)} · {expense.category} · {expense.method}
                  {expense.beneficiary ? ` · ${expense.beneficiary}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                {formatMXN(expense.amount)}
              </span>
              <ExpenseFormDialog
                expense={toFormValues(expense)}
                trigger={
                  <Button size="sm" variant="ghost">
                    Editar
                  </Button>
                }
              />
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={deletingId === expense.id}
                onClick={() => handleDelete(expense)}
                title="Eliminar"
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
