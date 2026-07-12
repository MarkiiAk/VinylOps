// Verificacion rapida de salud de la base SQLite (V1, Fase 1).
//
// Corre un integrity_check nativo de SQLite + reporta conteo de filas por
// tabla, para poder confirmar "el archivo abre bien y tiene lo que espero"
// antes/despues de una migracion, sin tener que levantar la app completa.

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";

const root = resolve(import.meta.dirname, "..");
const dbPath = process.argv[2] ? resolve(process.argv[2]) : resolve(root, "prisma/dev.db");

if (!existsSync(dbPath)) {
  console.error(`No se encontró ninguna base de datos en ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

const integrity = db.pragma("integrity_check", { simple: true });
console.log(`Archivo: ${dbPath}`);
console.log(`Integridad: ${integrity}`);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all();

console.log(`\nTablas (${tables.length}):`);
for (const { name } of tables) {
  const { c } = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get();
  console.log(`  ${name.padEnd(24)} ${c} filas`);
}

db.close();

if (integrity !== "ok") {
  console.error("\nADVERTENCIA: la base de datos no pasó el chequeo de integridad.");
  process.exit(1);
}
