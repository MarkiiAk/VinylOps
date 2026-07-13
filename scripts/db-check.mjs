// Verificacion rapida de salud de la base Postgres (V1, migrado desde SQLite
// al pasar a Vercel). Reporta conteo de filas por tabla, para poder
// confirmar "la conexion funciona y tiene lo que espero" antes/despues de
// una migracion, sin tener que levantar la app completa.
//
// Nota: Postgres no tiene un "integrity_check" nativo como SQLite (PRAGMA) —
// la integridad fisica del archivo la garantiza el proveedor (Neon/Vercel/
// Supabase/etc). Este script se limita a confirmar conectividad + contenido.

import "dotenv/config";
import pg from "pg";

const databaseUrl = process.argv[2] ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Falta DATABASE_URL (variable de entorno o argumento).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  console.log(`Conectado a: ${databaseUrl.replace(/:[^:@]+@/, ":***@")}`);

  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );

  console.log(`\nTablas (${tables.length}):`);
  for (const { table_name } of tables) {
    const { rows } = await client.query(`SELECT COUNT(*) AS c FROM "${table_name}"`);
    console.log(`  ${table_name.padEnd(24)} ${rows[0].c} filas`);
  }
} catch (error) {
  console.error("No se pudo verificar la base:", error.message);
  process.exit(1);
} finally {
  await client.end();
}
