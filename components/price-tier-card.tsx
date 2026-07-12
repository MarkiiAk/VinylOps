"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type PriceTier = "minimum" | "recommended" | "premium";

const TIER_CONFIG: Record<PriceTier, { label: string; description: string }> = {
  minimum: {
    label: "Minimo aceptable",
    description: "Cubre costo + margen base. No bajar de aqui.",
  },
  recommended: {
    label: "Recomendado",
    description: "El precio que deberias cobrar en la mayoria de los casos.",
  },
  premium: {
    label: "Premium",
    description: "Para clientes recurrentes, urgencia o piezas complejas.",
  },
};

function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

interface PriceTierCardProps {
  tier: PriceTier;
  price: number;
  delay?: number;
}

/**
 * Card de un nivel de precio (minimo / recomendado / premium). El tier
 * "recommended" se destaca visualmente con glow violeta y ligera escala,
 * para guiar la decision del dueño sin ocultar las otras dos opciones.
 */
export function PriceTierCard({ tier, price, delay = 0 }: PriceTierCardProps) {
  const config = TIER_CONFIG[tier];
  const isRecommended = tier === "recommended";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative flex flex-col gap-3 rounded-2xl p-5",
        isRecommended
          ? "glass-panel glow-violet ring-1 ring-neon-violet/40 sm:scale-[1.03]"
          : "glass-panel ring-1 ring-white/8"
      )}
    >
      {isRecommended ? (
        <span className="absolute -top-3 left-5 rounded-full bg-neon-violet px-2.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-background uppercase">
          Recomendado
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {config.label}
        </p>
        <p className="text-[0.8rem] text-muted-foreground">{config.description}</p>
      </div>
      <p
        className={cn(
          "font-heading text-3xl font-semibold tabular-nums tracking-tight",
          isRecommended ? "text-neon-violet" : "text-foreground"
        )}
      >
        {formatMXN(price)}
      </p>
    </motion.div>
  );
}
