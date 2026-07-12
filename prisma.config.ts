// Config de Prisma 7 para VinylOps Pricing Studio.
// Prisma 7 separa la configuracion de conexion del schema.prisma: el CLI (db push,
// migrate, studio) lee `datasource.url` de este archivo. El runtime de la app usa
// el driver adapter definido en lib/db.ts. Ver ARCHITECTURE.md, seccion
// "Prisma 7 + SQLite".
import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env["DATABASE_URL"] ?? "file:./prisma/dev.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
