import { NextResponse } from "next/server";

/**
 * Healthcheck simple. Sirve tambien como placeholder para confirmar que el
 * patron de route handlers de app/api funciona antes de que Ingenieria
 * Fullstack agregue los endpoints reales (materiales, cotizaciones, etc).
 */
export async function GET() {
  return NextResponse.json({ status: "ok", service: "vinylops-pricing-studio" });
}
