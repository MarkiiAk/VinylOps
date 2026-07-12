import type { Config } from "tailwindcss";

/**
 * Tailwind CSS v4 mueve la mayor parte del theming a CSS nativo (ver
 * app/globals.css, bloque @theme inline + variables :root/.dark). Con la v4,
 * Tailwind se auto-detecta en el proyecto sin necesidad de `content: []`
 * (usa deteccion automatica de archivos vía el plugin de PostCSS).
 *
 * Este archivo se mantiene por dos razones:
 *  1. Es un punto de extension explicito y documentado para el equipo de
 *     Diseno (ej. breakpoints custom, plugins de Tailwind clasicos que no
 *     tengan aun equivalente en `@theme`).
 *  2. Referencia visible de la paleta neon del producto para quien no quiera
 *     leer las variables CSS crudas.
 *
 * La fuente de verdad real de colores/radios es app/globals.css.
 */
const config: Config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "neon-cyan": "oklch(0.85 0.16 200)",
        "neon-violet": "oklch(0.68 0.2 300)",
        "neon-pink": "oklch(0.72 0.22 350)",
        // Semantica de margen/estado — ver app/globals.css para el detalle
        // de por que estas se mantienen separadas de los acentos de marca.
        success: "oklch(0.72 0.19 149)",
        warning: "oklch(0.8 0.17 80)",
        danger: "oklch(0.68 0.22 25)",
      },
    },
  },
};

export default config;
