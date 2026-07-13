# VinylOps Pricing Studio

Herramienta interna de **By Lilo Studio** (negocio real de vinil/Cricut/DTF) para cotizar trabajos custom, vender el catálogo de precio fijo y llevar inventario de materiales. "VinylOps" es el nombre del sistema; "By Lilo Studio" es la marca de cara al cliente.

## Correr en desarrollo

```bash
npm install
# Necesitas un Postgres corriendo y DATABASE_URL configurado en .env (ver .env.example).
# Para desarrollo local sin depender de la base real: docker run -d --name vinylops-pg \
#   -e POSTGRES_USER=vinylops -e POSTGRES_PASSWORD=vinylops -e POSTGRES_DB=vinylops \
#   -p 55432:5432 postgres:16-alpine
npx prisma migrate dev
npm run db:seed   # datos de ejemplo (idempotente) — NUNCA correr contra la base real del negocio
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Qué hace la app

- **Catálogo** (`/catalogo`) — productos y kits de precio fijo (etiquetas escolares). Cada item muestra su receta de materiales, costo de producción, margen, y proveedor de cada material. Vender un item descuenta inventario automáticamente. Historial en `/catalogo/historial`.
- **Cotizaciones** (`/cotizaciones`) — trabajos custom (cortes de vinil, decals, eventos) con motor de pricing por área + factor de complejidad, tres tiers de precio (mínimo aceptable / recomendado / premium). Incluye Smart Quote, un parser en español para armar una cotización a partir de una descripción libre.
- **Materiales** (`/materiales`) — inventario con costeo por promedio ponderado; cada compra actualiza el costo promedio del material.
- **Dashboard** (`/`) — resumen general del negocio.
- **Configuración** (`/configuracion`) — nombre del negocio, reglas de pricing por defecto (factor de complejidad, mínimos, redondeo).
- Tema claro (paleta pastel de la marca) y oscuro (neon), con toggle persistente.

## Stack y decisiones técnicas

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para el detalle de por qué se eligió cada pieza del stack (Next.js 16 + Prisma 7 + Postgres + Tailwind v4 + shadcn/ui sobre Base UI) y las particularidades de cada una (driver adapters de Prisma 7, PWA manual sin `next-pwa`, etc.).

## Pendientes conocidos

- Las cantidades de material por receta del catálogo (`areaCm2PerUnit` en `prisma/seed.ts`) son estimaciones marcadas `// TODO: ajustar con medida real` — corregir cuando se tengan las medidas exactas de corte de cada plantilla.
- Métrica de ROI/punto de equilibrio (inversión en material vs. ingresos acumulados): pausada a propósito, fuera de alcance por ahora.
- Catálogo "papelería creativa": todavía no definido por el negocio.
