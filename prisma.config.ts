// Config de Prisma 7 para VinylOps Pricing Studio.
// Prisma 7 separa la configuracion de conexion del schema.prisma: el CLI (db push,
// migrate, studio) lee `datasource.url` de este archivo. El runtime de la app usa
// el driver adapter definido en lib/db.ts. Ver ARCHITECTURE.md, seccion
// "Prisma 7 + Postgres".
import "dotenv/config";
import { defineConfig } from "prisma/config";

// OJO: `prisma generate` (corre en postinstall, sin conexión a la base
// todavía en un deploy nuevo de Vercel) carga este archivo pero NO necesita
// una DATABASE_URL real — solo lee el schema para generar el cliente. Por
// eso no se lanza un error aquí si falta: los comandos que sí necesitan
// conexión real (`migrate deploy`, `migrate dev`, `studio`) fallan solos,
// con su propio mensaje claro, si la variable no está configurada. Lanzar
// el error en este archivo tumbaba el build completo (incluyendo
// `prisma generate`) antes de que Vercel tuviera oportunidad de correr nada.
const databaseUrl = process.env["DATABASE_URL"] ?? "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
