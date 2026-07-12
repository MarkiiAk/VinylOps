"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wrapper de next-themes para VinylOps.
 *
 * attribute="class": next-themes agrega/quita la clase "dark" en <html>,
 * que es lo que app/globals.css usa para el bloque .dark.
 * defaultTheme="dark": el taller sigue arrancando en el tema neon oscuro
 * por default (comportamiento historico), el claro es opt-in via el toggle.
 * enableSystem={false}: no seguimos preferencia de SO, solo light/dark
 * explicitos elegidos por el usuario.
 * storageKey="vinylops-theme": namespace propio en localStorage.
 */
export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="vinylops-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
