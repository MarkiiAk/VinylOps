import type { ReactNode } from "react";

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/**
 * Encabezado de seccion reutilizable: titulo + subtitulo opcional + slot de
 * accion (boton, filtro, etc.) alineado a la derecha en desktop y debajo en
 * mobile para no apretar el titulo.
 */
export function SectionHeading({ title, subtitle, action }: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="max-w-prose text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
