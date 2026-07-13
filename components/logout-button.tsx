"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";

/** Botón de cerrar sesión (Fase 7, V1) — un solo usuario admin, sin menú de cuenta. */
export function LogoutButton({ className }: { className?: string }) {
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(() => {
      logout();
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      disabled={isPending}
      onClick={handleLogout}
      className={className}
    >
      <LogOut className="size-4" strokeWidth={2} />
    </Button>
  );
}
