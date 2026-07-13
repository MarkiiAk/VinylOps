// Prisma Client singleton para VinylOps Pricing Studio.
//
// Prisma 7 requiere un "driver adapter" explícito (ya no basta con `datasource.url`
// en schema.prisma). Para Postgres usamos @prisma/adapter-pg (sobre el driver
// estándar `pg`/node-postgres) — funciona con cualquier Postgres (Vercel/Neon,
// Supabase, RDS, uno local), no depende de un proveedor específico.
//
// Migrado desde SQLite (@prisma/adapter-better-sqlite3 + archivo local) porque
// Vercel corre en funciones serverless con filesystem efímero: no hay forma
// de persistir un archivo .db entre invocaciones.
//
// Patrón singleton estándar de Next.js: en dev, el HMR de Next recrea módulos en
// cada cambio de archivo, lo que puede abrir múltiples conexiones a la DB si no
// cacheamos la instancia en `globalThis`.

import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "Falta configurar DATABASE_URL (cadena de conexión de Postgres) en las variables de entorno."
  );
}

const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
