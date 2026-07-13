// Respaldo manual de la base Postgres (migrado desde SQLite al pasar a
// Vercel). Usa `pg_dump` si está disponible en el PATH — genera un archivo
// .sql portable en prisma/backups/. Si `pg_dump` no está instalado
// localmente, no falla en silencio: explica que el respaldo real de una
// base hosteada (Neon/Vercel Postgres/Supabase/etc.) lo da el propio
// proveedor (point-in-time recovery / snapshots), y ese es el mecanismo
// principal a usar en producción — este script es un respaldo manual
// adicional para desarrollo/tranquilidad, no el único.

import "dotenv/config";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Falta DATABASE_URL en las variables de entorno.");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const backupsDir = resolve(root, "prisma/backups");
mkdirSync(backupsDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = resolve(backupsDir, `backup-${stamp}.sql`);

try {
  execFileSync("pg_dump", [databaseUrl, "--no-owner", "--no-privileges", "-f", backupPath], {
    stdio: ["ignore", "ignore", "pipe"],
  });
} catch (error) {
  console.error(
    "No se encontró `pg_dump` en este equipo (o falló al correrlo), así que no se generó un respaldo local.\n" +
      "En producción, el respaldo real de una base Postgres hosteada (Neon/Vercel Postgres/Supabase) lo da el " +
      "propio proveedor: point-in-time recovery / snapshots automáticos desde su dashboard — revísalo ahí antes " +
      "de una migración importante.\n" +
      (error?.stderr?.toString() ?? error?.message ?? "")
  );
  process.exit(1);
}

if (!existsSync(backupPath)) {
  console.error("pg_dump corrió pero no se generó el archivo esperado.");
  process.exit(1);
}

console.log(`Respaldo creado: ${backupPath}`);
