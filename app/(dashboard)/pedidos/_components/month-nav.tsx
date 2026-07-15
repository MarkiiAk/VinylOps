"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MonthNavProps {
  year: number;
  month: number; // 0-indexado (Date.getMonth())
  label: string;
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** Navegación mes anterior/siguiente de la vista calendario de /pedidos, vía query params (?vista=calendario&anio=&mes=). */
export function MonthNav({ year, month, label }: MonthNavProps) {
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div className="flex items-center gap-2">
      <Link href={`/pedidos?vista=calendario&anio=${prev.year}&mes=${prev.month + 1}`}>
        <Button variant="outline" size="icon-sm" aria-label="Mes anterior">
          <ChevronLeft className="size-4" />
        </Button>
      </Link>
      <span className="min-w-36 text-center font-heading text-sm font-semibold tracking-tight text-foreground capitalize">
        {label}
      </span>
      <Link href={`/pedidos?vista=calendario&anio=${next.year}&mes=${next.month + 1}`}>
        <Button variant="outline" size="icon-sm" aria-label="Mes siguiente">
          <ChevronRight className="size-4" />
        </Button>
      </Link>
    </div>
  );
}
