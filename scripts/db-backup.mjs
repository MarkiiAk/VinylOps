// Respaldo manual y verificable de la base SQLite (V1, Fase 1).
//
// Copia prisma/dev.db a prisma/backups/ con timestamp, y verifica que el
// archivo resultante sea una base SQLite valida y abrible antes de darlo por
// bueno. No requiere detener el servidor de dev (SQLite soporta lectura
// concurrente mientras se copia el archivo, siempre que no haya una
// transaccion de escritura en curso en ese instante exacto).

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";

const root = resolve(import.meta.dirname, "..");
const dbPath = resolve(root, "prisma/dev.db");
const backupsDir = resolve(root, "prisma/backups");

if (!existsSync(dbPath)) {
  console.error(`No se encontró la base de datos en ${dbPath} — nada que respaldar.`);
  process.exit(1);
}

mkdirSync(backupsDir, { recursive: true });

const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, "-");
const backupPath = resolve(backupsDir, `dev.db.backup-${stamp}`);

copyFileSync(dbPath, backupPath);

// Verificacion: el respaldo debe abrir como SQLite valido y responder una
// consulta real, no solo "el archivo existe".
try {
  const db = new Database(backupPath, { readonly: true });
  const integrity = db.pragma("integrity_check", { simple: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  db.close();

  if (integrity !== "ok") {
    console.error(`El respaldo se creó pero falló la verificación de integridad: ${integrity}`);
    process.exit(1);
  }

  console.log(`Respaldo creado y verificado: ${backupPath}`);
  console.log(`Tablas encontradas: ${tables.length}`);
} catch (error) {
  console.error("El respaldo se copió pero no se pudo abrir/verificar:", error);
  process.exit(1);
}
