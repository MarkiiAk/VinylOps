"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatCardVariant = "neutral" | "success" | "warning";

const VARIANT_STYLES: Record<StatCardVariant, { icon: string; ring: string }> = {
  neutral: {
    icon: "bg-primary/10 text-primary",
    ring: "ring-white/8",
  },
  success: {
    icon: "bg-success/12 text-success",
    ring: "ring-success/20",
  },
  warning: {
    icon: "bg-warning/12 text-warning",
    ring: "ring-warning/20",
  },
};

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  variant?: StatCardVariant;
  hint?: string;
  delay?: number;
}

/**
 * Card de metrica individual (inventario total, ganancia del mes, etc).
 * Variante controla el acento semantico: neutral = info, success = buen
 * margen/ganancia, warning = margen bajo/atencion requerida.
 *
 * `icon` se recibe ya renderizado (ReactNode), no como referencia a un
 * componente: este card es "use client" y puede montarse desde Server
 * Components, que no pueden pasar funciones/componentes como props (RSC).
 */
export function StatCard({ label, value, icon, variant = "neutral", hint, delay = 0 }: StatCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "glass-panel flex flex-col gap-3 rounded-xl p-4 ring-1",
        styles.ring
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        <div className={cn("flex size-8 items-center justify-center rounded-lg [&>svg]:size-4", styles.icon)}>
          {icon}
        </div>
      </div>
      <div className="space-y-0.5">
        <p className="font-heading text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {value}
        </p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </motion.div>
  );
}
