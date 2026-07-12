// Prisma Client singleton para VinylOps Pricing Studio.
//
// Prisma 7 requiere un "driver adapter" explícito (ya no basta con `datasource.url`
// en schema.prisma). Para SQLite usamos @prisma/adapter-better-sqlite3, que es el
// adapter oficial soportado por Prisma para better-sqlite3.
//
// Patrón singleton estándar de Next.js: en dev, el HMR de Next recrea módulos en
// cada cambio de archivo, lo que puede abrir múltiples conexiones a la DB si no
// cacheamos la instancia en `globalThis`.

import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const DATABASE_URL = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

const adapter = new PrismaBetterSqlite3({
  url: DATABASE_URL,
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
