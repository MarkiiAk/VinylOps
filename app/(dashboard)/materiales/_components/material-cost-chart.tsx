"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { costPerSheet, hasFixedSheet, isPieceUnit, type SheetDimensions } from "@/lib/sheet-units";

interface PurchasePoint {
  id: string;
  purchaseDate: Date | string;
  costPerCm2: number;
}

interface MaterialCostChartProps extends SheetDimensions {
  purchases: PurchasePoint[];
  currentWeightedAverageCostPerCm2: number;
  unit: string;
}

function formatMXN(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits,
  }).format(value);
}

/**
 * Grafica la evolucion del costo de las compras de un material a lo largo
 * del tiempo. No reconstruimos el promedio ponderado punto a punto (el
 * schema no guarda ese snapshot historico por compra) — graficamos el costo
 * por cm2 de CADA compra individual, y dejamos explicito que la linea de
 * "promedio ponderado vigente" es el estado actual del material, no un punto
 * historico mas.
 */
export function MaterialCostChart({
  purchases,
  currentWeightedAverageCostPerCm2,
  sheetWidthCm,
  sheetHeightCm,
  unit,
}: MaterialCostChartProps) {
  const fixedSheet = hasFixedSheet({ sheetWidthCm, sheetHeightCm });
  const pieceUnit = isPieceUnit({ unit });
  const toDisplayCost = (costPerCm2: number) =>
    fixedSheet ? costPerSheet(costPerCm2, { sheetWidthCm, sheetHeightCm }) : costPerCm2;
  const displayDigits = fixedSheet || pieceUnit ? 2 : 4;

  const data = [...purchases]
    .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime())
    .map((p, idx) => ({
      index: idx + 1,
      date: new Date(p.purchaseDate).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }),
      cost: toDisplayCost(p.costPerCm2),
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Aun no hay compras registradas para graficar.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              width={70}
              tickFormatter={(v: number) => formatMXN(v, displayDigits)}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                fontSize: "0.75rem",
              }}
              formatter={(value) => [
                formatMXN(Number(value), displayDigits),
                fixedSheet
                  ? "Costo / hoja de esta compra"
                  : pieceUnit
                    ? "Costo / pieza de esta compra"
                    : "Costo / cm2 de esta compra",
              ]}
            />
            <Line
              type="monotone"
              dataKey="cost"
              stroke="var(--color-neon-cyan)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[0.7rem] text-muted-foreground">
        Cada punto es el costo {fixedSheet ? "por hoja" : pieceUnit ? "por pieza" : "/cm2"} de una compra
        individual, no el promedio acumulado. El promedio ponderado vigente del material (estado actual, no
        historico) es{" "}
        <span className="font-medium text-foreground">
          {formatMXN(toDisplayCost(currentWeightedAverageCostPerCm2), displayDigits)}
        </span>{" "}
        {fixedSheet ? "por hoja." : pieceUnit ? "por pieza." : "por cm2."}
      </p>
    </div>
  );
}
