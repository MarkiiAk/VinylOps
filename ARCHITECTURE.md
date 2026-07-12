# VinylOps Pricing Studio — Architecture

> Fase actual: **scaffold + arquitectura**. No hay pantallas de producto ni motor de
> pricing implementados todavía — eso lo construyen Diseño e Ingeniería Fullstack en
> el siguiente sprint. Este documento explica qué se construyó, por qué, y qué
> decisiones tomó Ingeniería que el resto del equipo necesita conocer antes de
> escribir código sobre esta base.

## Qué es esta app

App web privada de uso interno para un negocio de vinil/Cricut. No es un SaaS: no
hay login de clientes, no hay multi-tenant, no hay necesidad de escalar más allá de
un puñado de usuarios internos (dueño + operador de producción). Esa restricción es
la que guía casi todas las decisiones de stack de abajo.

## Stack elegido

| Capa | Tecnología | Versión instalada |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.10 |
| Lenguaje | TypeScript | 5.x |
| UI | React | 19.2.4 |
| Estilos | Tailwind CSS | v4 |
| Componentes | shadcn/ui (sobre Base UI, no Radix — ver abajo) | shadcn CLI 4.12 |
| Estado UI ligero | Zustand | 5.x |
| Gráficas | Recharts | 3.x |
| Animación | Framer Motion | 12.x |
| ORM | Prisma | 7.8.0 |
| Base de datos | SQLite | archivo `prisma/dev.db` |
| PWA | Manifest + Service Worker manual (sin next-pwa) | — |

### Por qué esto se desvía del stack estándar de Ak Labs

El stack estándar de Ak Labs para proyectos de cliente es FastAPI + PostgreSQL +
Docker + AWS, pensado para SaaS multi-tenant con necesidad real de escala e
infraestructura productiva. VinylOps no es eso: es una herramienta interna,
de un solo negocio, sin necesidad de servidor de base de datos separado ni de
despliegue en la nube por ahora. Next.js full-stack (App Router + Route Handlers)
más SQLite como archivo local cubre el caso de uso con cero infraestructura que
mantener. Si en el futuro esta app necesita multiusuario real con roles o
escalar a más de un negocio, ese es el punto para migrar a Postgres — el ORM
(Prisma) hace ese cambio de datasource relativamente mecánico.

## Decisiones técnicas clave

### 1. Next.js 16 en vez de "14+"

El spec pedía Next 14+; `create-next-app@latest` instaló la 16.2.10 (la última
estable disponible al momento del scaffold). Se mantiene porque cumple el
requisito ("14+") y evita fijar una versión con EOL de soporte más próximo.
Turbopack viene habilitado por defecto en `next build`/`next dev` en esta
versión — no se desactivó porque no dio problemas en el build de este scaffold.

### 2. Prisma 7 + SQLite: driver adapters obligatorios

Prisma 7 cambió el modelo de configuración respecto a versiones anteriores:

- `datasource.url` **ya no se define en `schema.prisma`**. La URL de conexión
  vive en `prisma.config.ts` (leída por el CLI: `db push`, `studio`, futuras
  `migrate`) y se pasa explícitamente al `PrismaClient` en runtime vía un
  **driver adapter**.
- El generator por defecto ya no es `prisma-client-js` sino `prisma-client`
  (cliente ESM, con `output` configurable). Se dejó tal cual lo generó
  `prisma init` (`output = "../lib/generated/prisma"`), que es el patrón
  soportado nativamente en esta versión.
- Para SQLite, el adapter oficial es `@prisma/adapter-better-sqlite3` (usa
  `better-sqlite3`, un módulo nativo). Se instaló sin problemas en este
  entorno Windows/Node 22.

Esto afecta a quien escriba código de backend sobre este scaffold:
- El singleton de Prisma Client vive en `lib/db.ts` y ya incluye el adapter
  configurado — importar `prisma` desde ahí, nunca instanciar `PrismaClient`
  directamente en otro archivo.
- `prisma.config.ts` tiene su propia `datasource.url` (para el CLI) que debe
  mantenerse en sync con `.env` (`DATABASE_URL`).
- No hay migraciones (`prisma migrate`) configuradas todavía en esta fase; se
  usó `prisma db push` para crear `prisma/dev.db` a partir del schema. Cuando
  el proyecto necesite historial de migraciones versionado, correr
  `prisma migrate dev` en vez de `db push` a partir de ese punto.

### 3. shadcn/ui sobre Base UI, no Radix

La versión actual del CLI de shadcn (4.12) genera componentes sobre
`@base-ui/react` (la librería de primitivos sin estilo de Radix pivotó/fue
reemplazada por Base UI en el registry por defecto), no sobre
`@radix-ui/react-*` como en generaciones anteriores de shadcn. Esto tiene una
consecuencia práctica: **`Button` no soporta la prop `asChild`** de la forma
clásica de Radix (Base UI resuelve composición distinto). El placeholder en
`app/page.tsx` evita ese patrón (usa `<Link><Button>...</Button></Link>` en
vez de `<Button asChild><Link>...</Link></Button>`). Diseño/Fullstack deben
tenerlo presente al construir componentes compuestos.

Componentes instalados: `button, card, input, label, select, textarea, badge,
tabs, dialog, table, sonner, separator, switch, slider`. El spec pedía
"toast/sonner" — shadcn deprecó su componente `toast` clásico a favor de
`sonner` (es la recomendación activa del proyecto), así que se instaló
`sonner` únicamente. `sonner` trae como dependencia implícita `next-themes`,
ya agregada.

### 4. PWA: configuración manual, no next-pwa

Se evaluó `next-pwa` (última versión publicada: 5.6.0) y se descartó:

- No tiene evidencia de mantenimiento activo ni compatibilidad confirmada con
  Next.js App Router en versiones recientes (15/16) ni con Turbopack.
- Su mecanismo de inyección de service worker se basa en un plugin de
  Webpack; con Turbopack como bundler por defecto en este proyecto, el riesgo
  de romper el build o de un comportamiento de caching impredecible es alto
  para un beneficio que se puede lograr manualmente con ~80 líneas de código.

En su lugar se implementó PWA manual:
- `public/manifest.json` — metadata de instalación (nombre, colores del theme
  dark, iconos placeholder en `public/icons/`, pendientes de que Diseño
  entregue los assets reales).
- `public/sw.js` — service worker simple: cache-first para el app shell
  (`/`, manifest), network-first sin cache para todo lo demás, y **nunca
  cachea `/api/*`** porque los datos de inventario/cotizaciones deben ser
  siempre frescos.
- `components/pwa-register.tsx` — client component que registra el SW, sólo
  en producción (`NODE_ENV === "production"`) para no interferir con HMR en
  desarrollo.
- `app/layout.tsx` referencia el manifest y agrega meta tags de `appleWebApp`.

Si más adelante se necesitan estrategias de cache más sofisticadas (precarga
de assets de producción, sync en background), se puede migrar a Workbox
manualmente sin next-pwa de por medio.

### 5. Tailwind CSS v4: el theme vive en CSS, no en `tailwind.config.ts`

Tailwind v4 movió la configuración de theme a `@theme` dentro de CSS
(`app/globals.css`) y auto-detecta archivos de proyecto sin necesidad de un
array `content: []`. Se mantiene `tailwind.config.ts` porque el spec lo pide
explícitamente y porque es un punto de extensión útil y documentado para
Diseño (breakpoints custom, alias de color), pero **la fuente de verdad real
de la paleta es `app/globals.css`**.

### 6. Theme dark/futurista forzado

La app corre siempre en modo oscuro (`<html class="dark">` fijo en
`app/layout.tsx`) — no hay light mode, es una herramienta de piso de
producción pensada para verse junto a la cortadora. Paleta en
`app/globals.css`:
- Fondo casi negro (`oklch(0.09 ...)`, no negro puro, para dar profundidad).
- `--primary` cian (acciones principales).
- `--accent` / `--sidebar-primary` violeta (marca, elementos destacados).
- `--chart-3` y variables `--neon-pink` rosa neón (alertas, badges de bajo
  stock, urgencia).
- Variables custom `--neon-cyan`, `--neon-violet`, `--neon-pink` expuestas
  también como utilidades Tailwind (`bg-neon-cyan`, etc.) vía
  `tailwind.config.ts`.

No se construyeron pantallas de producto sobre este theme — solo el layout
placeholder del dashboard (`app/(dashboard)/layout.tsx`) para probar que la
navegación y el theme conviven correctamente.

## Estructura de carpetas

```
VinylOps/
├── ARCHITECTURE.md
├── app/
│   ├── (dashboard)/            # route group con layout de navegación lateral
│   │   ├── layout.tsx          # sidebar placeholder — Diseño construye la UI real
│   │   ├── materiales/page.tsx
│   │   ├── cotizaciones/page.tsx
│   │   └── configuracion/page.tsx
│   ├── api/
│   │   └── health/route.ts     # healthcheck de ejemplo, patrón para futuros endpoints
│   ├── globals.css             # theme dark/futurista (fuente de verdad de colores)
│   ├── layout.tsx              # root layout: fonts, metadata PWA, Toaster, SW register
│   └── page.tsx                # home placeholder
├── components/
│   ├── ui/                     # shadcn/ui (button, card, input, label, select,
│   │                           #   textarea, badge, tabs, dialog, table, sonner,
│   │                           #   separator, switch, slider)
│   └── pwa-register.tsx        # registra public/sw.js en producción
├── lib/
│   ├── generated/prisma/       # cliente Prisma generado (gitignored)
│   ├── pricing/README.md       # placeholder — motor de pricing, NO implementado aún
│   ├── smartQuote/README.md    # placeholder — parser de texto libre, NO implementado aún
│   ├── db.ts                   # singleton de PrismaClient con adapter SQLite
│   └── utils.ts                # helper `cn()` de shadcn
├── prisma/
│   ├── schema.prisma           # los 6 modelos del spec (Material, Purchase, Quote,
│   │                           #   QuoteMaterialUsage, InventoryConsumption, Settings)
│   ├── seed.ts                 # placeholder vacío
│   └── dev.db                  # SQLite (gitignored)
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── icons/                  # placeholder, pendiente de assets reales de Diseño
├── prisma.config.ts             # config de conexión para el CLI de Prisma 7
├── tailwind.config.ts           # extensión de Tailwind v4 (colores neon)
└── package.json
```

## Qué falta (fuera de scope de esta fase)

- Motor de pricing en `lib/pricing/` (funciones puras).
- Parser de cotización inteligente en `lib/smartQuote/`.
- Pantallas reales de materiales, cotizaciones, configuración (Diseño + Fullstack).
- `prisma/seed.ts` con datos de ejemplo.
- Iconos PWA reales en `public/icons/` (192, 512, maskable-512).
- Decisión sobre `prisma migrate` vs `db push` continuo una vez el schema
  empiece a evolucionar con datos reales en la base.

## Validación realizada en esta fase

- `npx prisma generate` — OK, cliente generado en `lib/generated/prisma`.
- `npx prisma db push` — OK, `prisma/dev.db` creado y sincronizado con el schema.
- `npm run build` (`next build`, con Turbopack) — OK, compila, type-checks y
  genera las 6 rutas (`/`, `/materiales`, `/cotizaciones`, `/configuracion`,
  `/api/health`, `/_not-found`) sin errores.
- `npm run dev` — levantado brevemente, `/` respondió 200 y `/api/health`
  respondió `{"status":"ok","service":"vinylops-pricing-studio"}`.
