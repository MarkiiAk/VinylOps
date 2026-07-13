import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session-constants";

// FASE 7 (V1, seguridad): chequeo RÁPIDO de "hay cookie de sesión" antes de
// tocar cualquier página del dashboard — sin verificar la firma HMAC aquí
// (evita depender del runtime de middleware para criptografía). La
// verificación completa y autoritativa vive en app/(dashboard)/layout.tsx
// (getSession(), corre en runtime Node.js siempre). Este proxy es solo la
// primera capa: si ni siquiera existe la cookie, redirige de una vez sin
// esperar a renderizar el layout.
export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protege todo excepto: /login, assets estaticos de Next, manifest/iconos
  // PWA, y /api/health (health check no debe requerir sesión).
  matcher: ["/((?!login|api/health|_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js).*)"],
};
