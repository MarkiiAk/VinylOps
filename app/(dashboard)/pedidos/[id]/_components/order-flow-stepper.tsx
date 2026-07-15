import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OrderFlowStepData {
  label: string;
  done: boolean;
}

/**
 * Resumen visual del avance de un pedido a lo largo de los pasos reales del
 * negocio (contacto -> diseño -> autorización -> trabajo -> anticipo ->
 * entrega y liquidación -> corte -> cierre). No agrega ningún dato nuevo —
 * cada `done` se calcula con lo que ya trae getOrder() (ver pedidos/[id]/page.tsx).
 */
export function OrderFlowStepper({ steps }: { steps: OrderFlowStepData[] }) {
  return (
    <ol className="glass-panel flex flex-wrap gap-x-5 gap-y-2 rounded-xl p-4">
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center gap-1.5">
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold",
              step.done ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
            )}
          >
            {step.done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
          </span>
          <span className={cn("text-xs font-medium", step.done ? "text-foreground" : "text-muted-foreground")}>
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
