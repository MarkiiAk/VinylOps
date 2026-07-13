# V1 Implementation Report — VinylOps Pricing Studio ("By Lilo Studio")

Fecha: 2026-07-13
Alcance: construcción de la V1 operativa sobre el sistema existente, siguiendo el plan de 7 fases dictado por el dueño del negocio (Marco Candiani). Este documento es el entregable final de esa V1 — resume qué se hizo, qué cambió en la base de datos, qué se probó, qué riesgos quedan abiertos y cómo operar el sistema día a día.

---

## 1. Resumen ejecutivo

VinylOps pasó de ser una herramienta de catálogo/inventario sin cálculo de costo real por venta, a un sistema con:

- Un **modelo financiero granular** por producto (material, tinta, luz, desgaste, merma, bolsa, etiquetita, mano de obra) que se **congela** en cada línea de pedido al momento de venderse — el histórico nunca cambia aunque el catálogo cambie después.
- **Kits** cuyo costo se deriva automáticamente de sus componentes (nunca se captura a mano), con precio equivalente y ahorro real calculado.
- Un **único flujo de ventas** (Lead → Order → OrderLineItem → Payment) — se retiró el mecanismo paralelo de `CatalogSale`.
- La **regla de negocio de 3 días hábiles** para la fecha de entrega, calculada automáticamente al aprobar un diseño, con protección contra sobrescritura silenciosa.
- Un módulo de **gastos operativos**, separado de las compras de material.
- Un **reporte financiero** con selector de periodo, desglose completo (ventas/cobranza/producción/rentabilidad/gastos/resultado) y exportación CSV.
- Un **dashboard corregido** — ya no muestra "Ganancia del mes" (que en realidad era dinero cobrado).
- **Autenticación mínima** de un solo usuario administrador, con todas las rutas y acciones que mutan datos protegidas.
- **Limpieza**: se retiró código muerto (motor de precio por área+complejidad, componentes huérfanos, dependencia `zustand`, 7 campos muertos de `Settings`) y se corrigieron los 8 errores de lint preexistentes.

Todo el trabajo se hizo **sin perder ni un registro real**: cada cambio de schema pasó por una migración versionada, precedida de un backup verificado. El repositorio quedó bajo Git (`https://github.com/MarkiiAk/VinylOps`) con un commit por fase.

---

## 2. Funcionalidades terminadas (por fase)

**Fase 1 — Protección de datos**
- Historial de migraciones Prisma establecido (antes no existía ninguna).
- Bug corregido: el costo promedio ponderado de un material ya no se resetea a $0 cuando el inventario llega a 0 (causaba costos/márgenes falsos en catálogo).
- Guarda en `prisma/seed.ts`: rehúsa borrar datos si detecta Leads/Pedidos/Pagos reales, salvo confirmación explícita por variable de entorno.
- Scripts `db:backup` y `db:check` (integridad + conteo de filas).

**Fase 2 — Modelo financiero**
- Costos granulares por producto (material, tinta, luz, desgaste, merma, bolsa, etiquetita, mano de obra).
- Snapshot financiero inmutable por línea de pedido (`OrderLineItem`, antes `QuoteLineItem`).
- Costeo de líneas manuales ("Otro"), con material opcional.
- Kits modelados por componentes reales (no por receta de materiales editada a mano).
- Población de los datos reales de Kit Básico y Kit Premium.

**Fase 3 — Ventas y pedidos**
- Flujo único de ventas — se retiraron `sellCatalogItem`/`listCatalogSales` (sin consumidores).
- Pagos con método (Efectivo/Transferencia/Tarjeta/Otro), tipo "Otro", y protección contra sobrepago con confirmación explícita.
- Regla de 3 días hábiles después de aprobar diseño, con configuración de días no laborables.

**Fase 4 — Gastos**
- Módulo `Expense` completo (fecha, concepto, categoría, importe, método, proveedor, nota, comprobante).
- Listado con filtro de periodo/categoría y total, alta/edición/eliminación con confirmación.
- **Corrección de datos real**: las cantidades de Kit Básico estaban mal (0.5 en vez de 1 para dos componentes) — detectado por el dueño, corregido y verificado exacto contra su cálculo manual.

**Fase 5 — Reporte financiero**
- `/reportes/financiero`: Ventas, Cobranza, Producción, Rentabilidad, Gastos, Resultado — por periodo (Hoy/Semana/Mes/Mes anterior/Personalizado/Todo).
- Tablas de detalle exportables a CSV.
- Dashboard corregido: 8 métricas honestas reemplazan "Ganancia del mes".

**Fase 6 — Limpieza**
- Código muerto retirado (motor de pricing por área+complejidad, componentes huérfanos, dependencia `zustand`).
- 7 campos muertos de `Settings` eliminados.
- Nombre inconsistente corregido (`QuoteLineItemInput` → `OrderLineItemInput`).
- Los 8 errores de lint preexistentes corregidos (sin deshabilitar reglas, salvo 1 excepción documentada del patrón oficial de `next-themes`).

**Fase 7 — Seguridad y entrega**
- Autenticación de un solo usuario administrador (hash con `crypto.scrypt`, sesión firmada con HMAC).
- Todas las rutas del dashboard protegidas (proxy + verificación en el layout).
- 23 server actions mutantes protegidas explícitamente con `requireSession()`.
- Login/logout mínimos.

---

## 3. Cambios de schema y migraciones aplicadas

| Migración | Qué cambió | Riesgo |
|---|---|---|
| `0_init` | Baseline del schema existente antes de la V1 (sin cambios reales) | Ninguno |
| `20260712192540_financial_model_v1` | Costos granulares en `CatalogItem`, nuevo `CatalogItemComponent`, rename `QuoteLineItem`→`OrderLineItem` con snapshot financiero | Ninguno (0 filas en la tabla renombrada) |
| `20260713014901_catalog_material_cost_direct` | Nuevo `materialCostPerUnit` en `CatalogItem` | Ninguno (columna aditiva) |
| `20260713020028_business_day_rule_and_payments` | `designApprovedAt`/`deliveryDateIsManual`/`deliveredAt` en `Order`, nuevo `NonWorkingDay`, `method` en `Payment` | Ninguno (0 filas en `Payment`/`Order` al momento) |
| `20260713021433_expenses` | Nuevo modelo `Expense` | Ninguno |
| `20260713024348_settings_cleanup` | Se eliminaron 7 columnas muertas de `Settings` | Se perdieron 7 valores de configuración del motor de pricing ya retirado (eran los defaults del schema, nadie los había editado con datos reales) |
| `20260713031628_admin_account` | Nuevo modelo `AdminAccount` | Ninguno |

Cada migración fue precedida de un backup verificado (`prisma/backups/`) y seguida de `npm run db:check` confirmando integridad y conteo de filas.

## 4. Datos migrados/corregidos manualmente

- **Kit Básico / Kit Premium**: se poblaron sus componentes reales (Fase 2) y se corrigió la cantidad de 2 componentes de Kit Básico (Fase 4, de 0.5 a 1 — "media carta" es la presentación propia del producto, no una fracción).
- **10 productos del catálogo**: se cargaron los costos granulares exactos dictados por el dueño (material, tinta, luz, desgaste, merma, bolsa, etiquetita, mano de obra).
- **2 productos nuevos**: "Identificador circular — dos caras" ($89) e "Identificador rectangular — dos caras" ($109), que no existían en el catálogo.
- **3 cambios de precio**: Etiquetas siluetas 39→49, Etiquetas a prueba de agua 129→119, Identificador circular una cara 59→69.
- **Datos preexistentes conservados sin tocar**: `CatalogSale` (3 filas históricas, archivadas de solo lectura), `Purchase` (6 filas), `Material` (6 filas).

## 5. Fórmulas implementadas (verbatim, `lib/costing.ts`)

```
Costo directo unitario = Material + Tinta + Luz + Desgaste + Merma + Bolsa + Etiquetita
Costo directo total    = Costo directo unitario × Cantidad
Ganancia bruta         = Total vendido − Costo directo total
Margen bruto           = Ganancia bruta / Total vendido
Ganancia después de mano de obra = Ganancia bruta − Mano de obra total
Margen después de mano de obra   = Ganancia después de mano de obra / Total vendido
```

Reglas: todas las divisiones están protegidas contra cero (devuelven 0, no `NaN`/`Infinity`). Persistencia redondeada a 6 decimales para evitar arrastre de error de punto flotante; el redondeo a 2 decimales es solo de visualización. Para kits: material/tinta/luz/desgaste/merma/mano de obra se **derivan** sumando esos mismos campos de cada componente × su cantidad (nunca se capturan a mano en el kit); bolsa/etiquetita son propias del kit (compartidas una vez).

## 6. Regla de 3 días hábiles (`lib/business-days.ts`)

Al aprobar diseño por primera vez: `designApprovedAt = ahora`, `deliveryDate` se calcula sola como 3 días hábiles después (el día de aprobación no cuenta, sábados/domingos y días no laborables configurados tampoco). Si ya existía una fecha (manual o de una aprobación anterior), **nunca se sobrescribe sin que la UI confirme explícitamente**. Cubierto por 12 tests: lunes/jueves/viernes, fin de semana en medio, días no laborables consecutivos, re-aprobación, fecha manual preexistente.

## 7. Código eliminado (con búsqueda global previa, cero consumidores confirmados)

- `lib/pricing/complexity.ts`, `quote.ts`, `rounding.ts` — motor de precio por área+complejidad.
- `components/quote-status-badge.tsx`, `price-tier-card.tsx` — huérfanos.
- Dependencia `zustand`.
- 7 campos de `Settings` del motor retirado.
- `sellCatalogItem`/`listCatalogSales` (Fase 3) — la tabla `CatalogSale` y sus 3 filas históricas **no se borraron**, quedan archivadas de solo lectura.

## 8. Riesgos y decisiones pendientes

1. **Kit Básico no genera ahorro real para el cliente** con los precios oficiales actuales: cuesta lo mismo ($349) que comprar sus componentes por separado menos ~nada de descuento real relevante — documentado en Fase 4, es una decisión de negocio pendiente (subir el precio percibido del combo, bajar el precio del kit, o aceptarlo como está).
2. **"Descuentos" en el reporte financiero siempre es $0** — el modelo de datos de este V1 no tiene un campo de descuento por pedido/línea (no estaba en el alcance original de la Fase 3 de crear pedidos). Si se necesita, es un cambio de schema pendiente.
3. **Server actions de solo lectura no tienen `requireSession()` explícito** — quedan protegidas transitivamente porque solo son alcanzables desde páginas ya protegidas por el layout del dashboard. Si en el futuro se expone alguna de estas funciones vía una API pública separada, necesitaría su propio guard.
4. **No hay UI para cambiar el password del administrador** — para cambiarlo hoy habría que editar la base de datos directamente o borrar el `AdminAccount` y volver a definir `ADMIN_USERNAME`/`ADMIN_PASSWORD` en `.env` antes del siguiente primer-login.
5. **Persistencia 100% local (SQLite)** — si se despliega a un hosting con filesystem efímero (ej. Vercel), la base de datos no persistiría. Se evitó deliberadamente acoplar la lógica de negocio a nada específico de SQLite (el uso de `better-sqlite3` queda aislado en `scripts/db-backup.mjs`/`db-check.mjs`) para que migrar a una base hosteada (Postgres, Turso, etc.) sea un cambio de proveedor en Prisma, no una reescritura.

## 9. Cómo ejecutar, respaldar, restaurar y desplegar

```bash
npm install
npm run dev          # servidor de desarrollo
npm run build        # build de producción
npm start             # servir el build

npm run db:backup     # respaldo verificado en prisma/backups/
npm run db:check      # integridad + conteo de filas
npm run db:migrate    # aplicar migraciones nuevas (prisma migrate dev)
npm run db:seed       # solo en un ambiente NUEVO sin datos reales — se rehúsa si detecta Leads/Pedidos/Pagos
```

**Restaurar desde un backup**: detener la app, copiar el archivo de `prisma/backups/dev.db.backup-<fecha>` sobre `prisma/dev.db`, correr `npm run db:check` para confirmar integridad antes de reiniciar.

**Antes de cualquier cambio de schema futuro**: `npm run db:backup` primero, siempre. Nunca `prisma db push --force-reset`.

## 10. Configuración inicial (sin exponer secretos)

Variables de entorno requeridas (ver `.env.example`):
- `DATABASE_URL` — ya configurada.
- `SESSION_SECRET` — cadena aleatoria de 32+ bytes que firma las sesiones. La app no arranca sin esto.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — credenciales del **primer** login únicamente; después de ese primer login quedan guardadas (hasheadas) en la base y las variables ya no se vuelven a leer.

El primer login con estas credenciales ya se probó exitosamente en este ambiente de desarrollo (crea automáticamente el `AdminAccount`).

## 11. Fuera de alcance de esta V1 (deliberadamente)

- Multi-tenant, roles múltiples, recuperación de password.
- Mecanismo de descuento por pedido/línea.
- Exportación a PDF (solo CSV).
- Integración a calendario externo para días no laborables (solo lista de configuración manual).
- Reporte semanal automático de contabilidad.
- UI de cambio de password del administrador.

**No se agregaron funciones nuevas después de cumplir estos criterios** — el objetivo era una V1 confiable y operativa, no seguir expandiendo el producto.
