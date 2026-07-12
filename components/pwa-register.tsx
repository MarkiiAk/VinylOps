"use client";

import { useEffect } from "react";

/**
 * Registra el service worker manual de la app (public/sw.js).
 * Ver ARCHITECTURE.md, seccion "PWA" para el porque de no usar next-pwa.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // evita cache agresivo en dev/HMR

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("VinylOps: fallo el registro del service worker", err);
    });
  }, []);

  return null;
}
