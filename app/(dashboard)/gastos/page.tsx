import { SectionHeading } from "@/components/section-heading";
import { listExpenses } from "@/lib/actions/expenses";
import { ExpenseFormDialog } from "./_components/expense-form-dialog";
import { ExpensesListClient } from "./_components/expenses-list-client";

/**
 * Gastos operativos (Expense) — Fase 4, V1. Separado de Compras
 * (Materiales → Compras): una compra aumenta inventario, un gasto no.
 * Carga todos los gastos de una vez (no son muchas filas en este negocio) y
 * delega el filtro de periodo/categoría al client component.
 */
export default async function GastosPage() {
  const expenses = await listExpenses();

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Gastos"
        subtitle="Gastos operativos del negocio — publicidad, envíos, herramientas, servicios, etc."
        action={<ExpenseFormDialog />}
      />

      <ExpensesListClient
        expenses={expenses.map((e) => ({
          id: e.id,
          date: e.date.toISOString(),
          concept: e.concept,
          category: e.category,
          amount: e.amount,
          method: e.method,
          beneficiary: e.beneficiary,
          notes: e.notes,
          receiptUrl: e.receiptUrl,
        }))}
      />
    </div>
  );
}
