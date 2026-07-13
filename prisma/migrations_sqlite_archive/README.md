# Migraciones SQLite (archivadas, 2026-07)

Estas migraciones documentan la evolución del schema mientras el proyecto
corrió sobre SQLite local (Fase 1 a Fase 7 del plan V1). Se archivaron aquí
(en vez de borrarse) al migrar a PostgreSQL para desplegar en Vercel, cuyo
filesystem serverless no soporta un archivo `.db` persistente.

**No se pueden aplicar contra Postgres** — el SQL de SQLite (`PRAGMA`,
reconstrucción de tablas vía `RedefineTables`, etc.) es sintácticamente
incompatible. El historial de migraciones real para Postgres empieza de
cero en `prisma/migrations/` (carpeta hermana de esta), como un baseline
único que refleja el schema tal como quedó al final de la etapa SQLite.

No representan pérdida de datos: la base de Vercel es nueva y arranca
limpia por decisión explícita del dueño del negocio, no había datos reales
de producción en la SQLite local que se necesitara preservar.
