// Constante compartida entre lib/auth.ts (runtime Node.js) y middleware.ts
// (runtime Edge). Vive en su propio archivo para que middleware.ts NUNCA
// importe lib/auth.ts directo — auth.ts importa lib/db.ts (Prisma), que no
// corre en el runtime Edge de Next.js y rompería el build/middleware.
export const SESSION_COOKIE_NAME = 'vinylops_session'
