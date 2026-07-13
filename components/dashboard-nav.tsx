"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Layers,
  Kanban,
  Calendar,
  Settings,
  Plus,
  Sparkles,
  Sun,
  Moon,
  Package,
  MessageCircleMore,
  Boxes,
  MoreHorizontal,
  Receipt,
  LineChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// "Catalogo" va primero: es lo que el negocio vende hoy (etiquetas escolares
// + kits de precio fijo), foco principal del producto segun el dueño.
// "Leads" va justo despues: es el paso anterior a un pedido custom
// (seguimiento de clientas que preguntan por WhatsApp antes de comprar).
// "Pedidos" es el tablero Kanban de produccion de esos leads ya ganados.
// "Inventario" y "Materiales" van despues de Dashboard: son consulta de
// referencia (stock real y catalogo de costo respectivamente), no accion
// diaria como Catalogo/Leads/Pedidos. Inventario antes que Materiales
// porque el stock es lo que se revisa mas seguido; Materiales (catalogo
// completo, incluye costo de maquila) es mas ocasional.
// "Calendario" va justo despues de "Pedidos": es una vista alternativa de
// la misma data (fecha de entrega de las tarjetas de Order), no una seccion
// nueva de datos.
const NAV_ITEMS = [
  { href: "/catalogo", label: "Catalogo", icon: Package },
  { href: "/leads", label: "Leads", icon: MessageCircleMore },
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/materiales", label: "Materiales", icon: Layers },
  { href: "/pedidos", label: "Pedidos", icon: Kanban },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/gastos", label: "Gastos", icon: Receipt },
  { href: "/reportes/financiero", label: "Reportes", icon: LineChart },
  { href: "/configuracion", label: "Configuracion", icon: Settings },
];

// Mobile: 5 accesos directos (accion diaria) + "Mas" con el resto en un
// dialog. Decision de UX resuelta (2026-07-07) — antes se reusaba
// NAV_ITEMS completo (8 items) sin recortar, ilegible en la barra inferior.
// Prioridad: Catalogo/Leads/Pedidos/Calendario son accion diaria del
// negocio (vender, dar seguimiento, avanzar produccion, ver entregas);
// Dashboard se deja como resumen rapido. Inventario/Materiales/Config son
// consulta ocasional, van dentro de "Mas".
const MOBILE_PRIMARY_ITEMS = [
  { href: "/catalogo", label: "Catalogo", icon: Package },
  { href: "/leads", label: "Leads", icon: MessageCircleMore },
  { href: "/pedidos", label: "Pedidos", icon: Kanban },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
];

const MOBILE_MORE_ITEMS = [
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/materiales", label: "Materiales", icon: Layers },
  { href: "/gastos", label: "Gastos", icon: Receipt },
  { href: "/reportes/financiero", label: "Reportes", icon: LineChart },
  { href: "/configuracion", label: "Configuracion", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Toggle claro/oscuro. Se monta en la sidebar desktop y en el header mobile.
 * Espera a montar en cliente antes de leer `theme` para evitar mismatch de
 * hidratacion (SSR no conoce la preferencia guardada en localStorage).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Button variant="ghost" size="icon-sm" aria-hidden className="opacity-0" />;
  }

  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" strokeWidth={2} /> : <Moon className="size-4" strokeWidth={2} />}
    </Button>
  );
}

/** Sidebar fija de desktop (md+). Indicador de seccion activa con acento cian. */
export function DesktopSidebar({ businessName }: { businessName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
      <div className="flex items-center gap-2 px-5 pt-6 pb-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="size-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-heading text-sm font-semibold tracking-tight text-sidebar-foreground">
            VinylOps
          </p>
          <p className="truncate text-[0.7rem] text-muted-foreground">{businessName}</p>
        </div>
        <ThemeToggle />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              {active ? (
                <motion.span
                  layoutId="active-nav-indicator"
                  className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary shadow-[0_0_8px_theme(colors.primary)]"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              ) : null}
              <item.icon
                className={cn("size-4", active && "text-primary")}
                strokeWidth={2}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 px-3 pb-5">
        <Link
          href="/leads"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-neon-pink px-3 py-2 text-sm font-semibold text-background transition-transform hover:brightness-110 active:scale-[0.98]"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Nuevo lead
        </Link>
      </div>
    </aside>
  );
}

/** Barra de navegacion inferior para mobile, con padding de safe-area de iPhone. */
export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MOBILE_MORE_ITEMS.some((item) => isActive(pathname, item.href));

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur-lg md:hidden">
      <div className="flex items-stretch justify-around">
        {MOBILE_PRIMARY_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="size-5" strokeWidth={active ? 2.25 : 1.85} />
              {item.label}
            </Link>
          );
        })}

        <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
          <DialogTrigger
            render={
              <button
                type="button"
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium transition-colors",
                  moreActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <MoreHorizontal className="size-5" strokeWidth={moreActive ? 2.25 : 1.85} />
                Mas
              </button>
            }
          />
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>Mas opciones</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-1">
              {MOBILE_MORE_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4" strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </nav>
  );
}

/** Boton flotante "+ Nuevo lead", siempre visible en mobile sobre el bottom nav. */
export function MobileNewQuoteFab() {
  return (
    <Link
      href="/leads"
      className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-1.5 rounded-full bg-neon-pink px-4 py-3 text-sm font-semibold text-background shadow-[0_8px_24px_-8px_oklch(0.72_0.22_350/60%)] transition-transform active:scale-95 md:hidden"
    >
      <Plus className="size-4" strokeWidth={2.5} />
      Nuevo lead
    </Link>
  );
}
