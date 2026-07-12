# Auditoría técnica de VinylOps Pricing Studio — para diseño de V1

> Documento generado por auditoría directa del repositorio en `c:\Proyectos\VinylOps` el 2026-07-08. Todo lo aquí descrito fue verificado leyendo el código real (schema, server actions, componentes de página) — no se infiere funcionalidad a partir de nombres de archivo o comentarios. Donde no se pudo verificar en tiempo de ejecución (ej. comportamiento exacto bajo carga concurrente), se marca explícitamente como **no verificado**.
>
> Objetivo del documento: que otro arquitecto de software pueda diseñar el recorte a una V1 operativa sin tener que volver a leer el repo desde cero.

---

## 1. Resumen ejecutivo

**Qué hace el sistema hoy.** VinylOps Pricing Studio es una herramienta web interna (sin login, sin multi-tenant) para un negocio real de un solo dueño (marca de cara al cliente: "By Lilo Studio") que vende etiquetas/vinil/DTF impreso. Cubre: catálogo de productos de precio fijo con receta de materiales y margen calculado; un CRM simple de leads (contactos de WhatsApp); un tablero Kanban de pedidos de producción ligados a esos leads; registro de pagos (anticipo/liquidación) por pedido; inventario de materiales con costeo por promedio ponderado; y un calendario de fechas de entrega.

**Qué problema intenta resolver.** El dueño necesita, en un solo lugar: saber cuánto le cuesta producir cada cosa que vende, cobrar un precio que le deje margen, no perder el hilo de con quién está hablando por WhatsApp y en qué fase va cada pedido, y no quedarse sin material sin darse cuenta.

**Módulos que existen** (rutas reales, ver sección 6 para detalle):
`/catalogo`, `/leads`, `/leads/[id]`, `/leads/[id]/nuevo-pedido`, `/pedidos`, `/pedidos/[id]`, `/materiales`, `/materiales/[id]`, `/inventario`, `/calendario`, `/`(Dashboard), `/configuracion`.

**Qué está terminado, incompleto o sobredimensionado:**
- **Terminado y coherente:** Catálogo (CRUD completo), Materiales/Inventario (separación conceptual clara, costeo por promedio ponderado real), Leads (CRUD + status simplificado), Pedidos/Kanban (creación de carrito, cambio de fase, descuento de inventario), Calendario de entregas (vista mensual básica).
- **Incompleto / a medio construir:** no existe ningún cálculo de **costo ni margen a nivel de pedido/venta real** (solo existe a nivel de definición de producto de catálogo, en abstracto). No existe reporte financiero agregado (ingresos, costos, utilidad) en ningún periodo. "Ganancia del mes" en el Dashboard es en realidad *dinero recibido*, no utilidad.
- **Sobredimensionado / muerto:** existe un motor de pricing completo por área+complejidad (`lib/pricing`, ~7 archivos, con tests) que ya NO se usa desde ningún flujo de UI — se construyó para una "V0" del producto (cotizaciones custom calculadas) que fue reemplazada por el sistema de Leads+Pedidos actual. `Settings` conserva 7 campos de configuración de ese motor muerto, y `/configuracion` los sigue mostrando y permitiendo editar sin que tengan ningún efecto real. Existen también 2 componentes de UI huérfanos (`quote-status-badge.tsx`, `price-tier-card.tsx`) y una dependencia instalada sin uso (`zustand`).
- **Simulado/no implementado:** no hay autenticación de ningún tipo (por diseño, ver sección 2). No hay exportación de reportes. No hay reporte semanal de contabilidad (el modelo de datos ya lo permite vía `Payment.paidAt`, pero no hay ninguna consulta/pantalla que lo arme).

**Qué tan cerca está de producción.** Funcionalmente, para un solo usuario sin necesidad de reportes financieros agregados, **ya es usable hoy** — de hecho el dueño ya lo está usando y auditando activamente. Para el objetivo explícito de una "V1 operativa" con reporte financiero (ingresos/costos/utilidad/margen, ver sección 8), falta una pieza central que hoy no existe en ninguna parte del sistema: **vincular costo real a cada venta/pedido**, no solo a la definición teórica de un producto de catálogo.

---

## 2. Arquitectura actual

- **Frontend:** Next.js 16.2.10 (App Router), React 19.2.4, TypeScript 5.x. Sin router de terceros (usa el App Router nativo). Server Components por defecto; los componentes interactivos están marcados `"use client"` explícitamente y siguen un patrón consistente: estado local (`useState`/`useTransition`) → llamada a una server action → `toast` de sonner → `router.refresh()`.
- **Backend:** No hay una capa de API separada — todo pasa por **Next.js Server Actions** (`'use server'` en cada archivo de `lib/actions/*.ts`), invocadas directamente desde Server/Client Components. No hay una sola ruta bajo `app/api/` con lógica de negocio real (ver más abajo).
- **Base de datos:** SQLite, un solo archivo (`prisma/dev.db`), vía Prisma 7.8.0 con el adapter oficial `@prisma/adapter-better-sqlite3` (Prisma 7 requiere un driver adapter explícito, ya no basta `datasource.url` en el schema). Cliente Prisma generado con el generator `prisma-client` (ESM), no el clásico `prisma-client-js`.
- **Autenticación:** **No existe.** Se verificó explícitamente: no hay `next-auth`, `clerk`, `passport`, `bcrypt`, `jsonwebtoken`, ni ningún concepto de sesión/usuario/rol en el código ni en el schema. No hay `middleware.ts`. Esto es una decisión de diseño explícita documentada en `ARCHITECTURE.md`: "app privada de uso interno... no hay login de clientes, no hay multi-tenant". Cualquiera con acceso a la URL/servidor tiene acceso total a todo.
- **APIs:** Solo existe `app/api/health/route.ts` (healthcheck, no verificado su contenido en esta pasada pero por convención de nombre es un endpoint trivial de status). No hay APIs REST/GraphQL propias para integraciones externas.
- **Servicios externos:** Ninguno integrado en código (no hay llamadas a pasarelas de pago, WhatsApp Business API, email, SMS, etc.). El negocio opera "por fuera" (WhatsApp manual) y la app solo lleva el registro.
- **Librerías principales:**
  - UI: Tailwind CSS v4 (config vive en `app/globals.css` vía `@theme`, no en `tailwind.config.ts` — así es Tailwind v4), shadcn/ui generado sobre `@base-ui/react` (no Radix — la versión del CLI de shadcn usada migró de Radix a Base UI), `lucide-react` (iconos), `framer-motion` (animaciones de nav y stat cards), `recharts` (una sola gráfica: evolución de costo de material), `sonner` (toasts), `next-themes` (toggle claro/oscuro).
  - Datos: Prisma 7, `better-sqlite3` vía adapter.
  - **Instalado pero sin uso verificado:** `zustand` (0 imports en todo el repo). `sharp` (solo usado por un script de generación de íconos PWA fuera del runtime, `scripts/generate-icons.mjs`, no verificado si aún se ejecuta o quedó como herramienta de un solo uso).
- **Flujo de datos:** Server Component (`page.tsx`) llama una función `async` de `lib/actions/*.ts` en tiempo de render → esa función usa el singleton `prisma` de `lib/db.ts` → devuelve datos ya tipados por Prisma al componente → el componente pasa esos datos (serializados a JSON-friendly, ej. `Date` → ISO string) a un Client Component para la parte interactiva.
- **Cómo se comunican los módulos:** No hay bus de eventos ni cola de mensajes — todo es llamada directa de función dentro del mismo proceso Node. La única forma en que un módulo "avisa" a otro es a través de relaciones de base de datos (FKs) y `revalidatePath()` de Next (invalida el caché de una ruta para forzar refetch).

---

## 3. Estructura funcional

| Funcionalidad | Objetivo | Archivos principales | Modelos usados | Estado | Dependencias | Complejidad | Riesgos |
|---|---|---|---|---|---|---|---|
| Catálogo de productos (CRUD) | Definir productos/kits de precio fijo con receta de materiales | `lib/actions/catalog.ts`, `app/(dashboard)/catalogo/*` | `CatalogItem`, `CatalogItemMaterial`, `Material` | **Funcional**, verificado con pruebas manuales (crear, editar, archivar) | Materiales ya deben existir | Media | Ninguno grave; `otherCostPerUnit` (costo manual de tinta/luz/tiempo) es fácil de olvidar llenar |
| Venta directa de catálogo (`sellCatalogItem`, `CatalogSale`) | Vender un ítem de catálogo sin pasar por un Lead/Pedido | `lib/actions/catalog.ts` (función `sellCatalogItem`, modelo `CatalogSale`) | `CatalogSale`, `InventoryConsumption` | **Código presente pero sin UI que lo invoque** — el botón que lo llamaba fue removido a propósito (ver sección 10). La función y el modelo siguen vivos, solo alcanzables por script/consola | Ninguna | Baja | **Confuso**: hay dos mecanismos distintos de "venta" en el sistema (`CatalogSale` y `Order`+`Payment`) y ya no está claro cuál es la fuente de verdad de ingresos |
| Leads (CRM simple) | Registrar contactos de WhatsApp y su status comercial | `lib/actions/leads.ts`, `app/(dashboard)/leads/*` | `Lead` | **Funcional** | Ninguna | Baja | `deleteLead` hace `prisma.lead.delete` (borrado físico) — si el lead tiene `Order`s, esto **debería fallar** por constraint de FK (Prisma/SQLite por default no cascadea desde `Order.leadId`), pero no hay manejo de error amigable para ese caso — **no verificado en runtime**, solo por lectura de schema |
| Detalle de lead + historial de pedidos | Ver todos los pedidos de un mismo contacto a través del tiempo | `lib/actions/leads.ts` (`getLeadWithOrders`), `app/(dashboard)/leads/[id]/page.tsx` | `Lead`, `Order`, `QuoteLineItem`, `Payment` | **Funcional** | Depende de Leads y Pedidos | Baja | Ninguno |
| Nuevo pedido (carrito) | Armar un pedido con líneas de catálogo y/o líneas manuales ("Otro") | `lib/actions/orders.ts` (`createOrder`), `app/(dashboard)/leads/[id]/nuevo-pedido/*` | `Order`, `QuoteLineItem`, `CatalogItem`, `Material` | **Funcional** | Requiere un Lead existente | Alta (es la lógica de negocio más compleja del sistema: snapshot de precio, líneas mixtas catálogo/manual, declaración opcional de material en líneas "Otro") | Las líneas "Otro" no calculan costo — solo declaran cuánto material se usó, pero **no calculan cuánto costó ese material** en el momento de crear el pedido (ver sección 7) |
| Tablero Kanban de pedidos | Ver y avanzar todos los pedidos activos por fase de producción | `lib/actions/orders.ts` (`listOrders`, `updateOrderStatus`), `app/(dashboard)/pedidos/*` | `Order`, `Lead`, `QuoteLineItem` | **Funcional** | Ninguna | Media | Sin drag-and-drop (cambio de fase es un `<Select>`, decisión deliberada, no un bug) |
| Descuento de inventario al completar pedido | Restar del stock los materiales usados al marcar un pedido Completado/Entregado | `lib/actions/orders.ts` (`updateOrderStatus` + `consumeMaterial`) | `Order`, `QuoteLineItem`, `CatalogItemMaterial`, `Material`, `InventoryConsumption` | **Funcional pero verificado con un efecto secundario peligroso** (ver sección 10: probar este flujo en desarrollo corrompió datos reales de costo) | `Material.totalAreaCm2` debe estar cargado correctamente | Alta | **Riesgo real de corrupción de datos**: si `totalAreaCm2` de un material llega a 0 por consumo, su `weightedAverageCostPerCm2` se resetea a 0 automáticamente (regla de negocio intencional para no arrastrar un costo fantasma), pero esto ya causó un bug real donde el costo de un producto de catálogo se mostró en $0 |
| Registro de pagos | Registrar anticipos/liquidaciones con fecha real de cobro | `lib/actions/payments.ts`, `app/(dashboard)/pedidos/[id]/_components/register-payment-dialog.tsx` | `Payment`, `Order` | **Funcional** | Requiere un Order existente | Baja | Ningún control de que la suma de pagos no exceda el total del pedido (no hay validación de sobre-pago) |
| Calendario de entregas | Ver en qué día debe entregarse cada pedido | `lib/actions/orders.ts` (`listOrdersWithDeliveryDate`), `app/(dashboard)/calendario/*` | `Order` | **Funcional** | `Order.deliveryDate` debe capturarse al crear/editar el pedido (es opcional) | Media (grilla de calendario construida a mano, sin librería) | Ninguno grave; sin recordatorios/notificaciones, es solo una vista |
| Materiales (catálogo de costo) | Definir tipos de material, su costo de referencia y proveedor | `lib/actions/materials.ts`, `app/(dashboard)/materiales/*` | `Material` | **Funcional** | Ninguna | Media | Ninguno |
| Inventario (stock real) | Ver/gestionar solo los materiales que sí se compran y se gastan | `lib/actions/materials.ts` (filtro `isInventoryTracked`), `app/(dashboard)/inventario/*` | `Material` | **Funcional** | Depende de que cada material tenga `isInventoryTracked` bien clasificado | Baja | Es un **flag booleano en cada material**, no una tabla separada — riesgo de que alguien lo clasifique mal al crear un material nuevo |
| Registro de compras de material | Registrar una compra y recalcular costo promedio ponderado | `lib/actions/purchases.ts`, `app/(dashboard)/materiales/_components/purchase-form.tsx` | `Purchase`, `Material` | **Funcional**, con fórmula de costeo real (ver sección 7) | `lib/pricing` (área.ts, cost.ts — únicas partes vivas de ese módulo) | Media | Ninguno |
| Dashboard / resumen | Ver de un vistazo inventario, stock bajo, compras/pedidos recientes, "ganancia del mes" | `lib/actions/dashboard.ts`, `app/(dashboard)/page.tsx` | Casi todos los modelos | **Funcional pero con una métrica financiera engañosa** (ver sección 7) | Todos los módulos | Media | "Ganancia del mes" no es utilidad real, es dinero cobrado — riesgo de que el dueño tome decisiones creyendo que es profit neto |
| Configuración | Nombre del negocio + "valores por defecto" de un motor de pricing que ya no existe | `lib/actions/settings.ts`, `app/(dashboard)/configuracion/*` | `Settings` | **Parcialmente muerta**: el nombre del negocio sí se usa (aparece en el sidebar); los 7 campos de "márgenes por defecto"/"precios mínimos y redondeo" no los lee ningún flujo activo | Ninguna | Baja | **Confunde al usuario**: parece una pantalla de configuración de precios funcional, pero no hace nada |
| Motor de pricing por área+complejidad | Calcular precio de una cotización custom a partir de dimensiones y complejidad | `lib/pricing/*` (7 archivos + 1 test) | Ninguno (funciones puras, no toca DB) | **Código muerto** — sin ningún caller desde UI o server actions activas, salvo `engine.test.ts` que se testea a sí mismo | N/A | Alta (el motor en sí es sofisticado: tiers de precio, redondeo, factor de complejidad) | Mantenerlo sin usarlo es deuda muerta; borrarlo sin confirmar que nadie lo necesita es un riesgo de producto |
| PWA (manifest + service worker) | Permitir "instalar" la app como PWA | `public/manifest.json`, `public/sw.js`, `components/pwa-register.tsx` | N/A | **Funcional, no verificado a fondo en esta pasada** (no se probó instalación real) | Ninguna | Baja | Bajo impacto para una herramienta interna de escritorio/laptop |

---

## 4. Base de datos

10 modelos en `prisma/schema.prisma`. Sin migraciones versionadas (ver sección 11) — todo el ciclo de vida del schema se ha manejado con `prisma db push` (incluyendo al menos un `--force-reset` durante esta misma sesión de desarrollo).

### `Material`
Para qué sirve: catálogo maestro de todo tipo de material/insumo, sea inventario real o "costo de referencia" (maquilado bajo demanda).
Campos clave: `category` (string libre, sin enum real pese al comentario que sugiere valores), `weightedAverageCostPerCm2`/`weightedAverageCostPerM2` (costo promedio ponderado, la fuente de verdad de costo), `isInventoryTracked` (bool: `true`=inventario real que se compra y gasta, `false`=costo de referencia sin stock), `sheetWidthCm`/`sheetHeightCm` (opcionales, si el material se vende por hoja de tamaño fijo, para mostrar "N hojas" en vez de cm² en la UI), `purchaseUrl` (link de dónde se compra).
Relaciones: `Purchase[]`, `InventoryConsumption[]`, `CatalogItemMaterial[]` (recetas de catálogo), `QuoteLineItem[]` (uso declarado en líneas "Otro" de pedidos).
Vigente/redundante: vigente y central. El flag `isInventoryTracked` reemplazó lo que en un diseño más limpio podrían ser dos tablas distintas ("Materiales" vs "Inventario") — hoy es una sola tabla con dos vistas de UI filtradas por ese flag.

### `Purchase`
Para qué sirve: historial inmutable de cada compra de un material — de aquí se deriva el costo promedio ponderado.
Campos clave: `widthCm`/`heightCm`/`quantity` (de aquí se deriva `totalAreaCm2`), `grossPrice`/`discount`/`finalPrice`, `costPerCm2`/`costPerM2` (snapshot del costo de ESA compra específica, no el promedio acumulado).
Relaciones: pertenece a `Material`.
Vigente: sí, usado activamente por `createPurchase`.

### `Order` (llamado "Pedido" en la UI)
Para qué sirve: cada ciclo de venta/trabajo de un Lead — el equivalente a una "orden de venta" o "tarjeta de Kanban".
Campos clave: `leadId` (requerido — todo pedido pertenece a un lead), `interest` (qué se vendió/trabajó en este pedido específico), `status` (5 valores: `Disenando`|`DisenoAprobado`|`Maquilando`|`Completado`|`Entregado` — el pipeline de PRODUCCIÓN, independiente del status del Lead), `deliveryDate` (opcional, alimenta el calendario).
Relaciones: `Lead` (padre), `QuoteLineItem[]` (líneas del carrito), `Payment[]`, `InventoryConsumption[]`.
Vigente: sí, es el modelo central del sistema hoy. **Nombre histórico confuso**: el modelo se llama `Order` pero sus líneas se llaman `QuoteLineItem` — vestigio de un rename de un modelo anterior llamado `Quote` que nunca se completó del todo a nivel de nombres (ver sección 10).

### `QuoteLineItem` (línea de un `Order`)
Para qué sirve: cada renglón del carrito de un pedido — puede venir del catálogo de precio fijo (`catalogItemId` presente, snapshot de nombre/precio) o ser una línea "Otro" 100% manual (`catalogItemId` nulo, descripción y precio escritos a mano).
Campos clave: `unitPrice`/`lineTotal` (snapshot congelado al crear, no se recalcula si el `CatalogItem` cambia de precio después), `otherMaterialId`/`otherMaterialAreaCm2` (solo para líneas "Otro": declaración manual de qué material y cuánta área se usó, para poder descontar inventario sin receta automática).
Relaciones: pertenece a `Order` (cascade on delete), opcionalmente a `CatalogItem`, opcionalmente a `Material` (vía `otherMaterialId`).
Vigente: sí. **Nombre debería ser `OrderLineItem`** para ser consistente con el resto del sistema — es puramente cosmético pero confunde a cualquiera que lea el schema por primera vez.

### `Payment`
Para qué sirve: registrar cada anticipo/liquidación recibida sobre un `Order`, con su **fecha real de cobro** (`paidAt`), distinta de `createdAt` (cuándo se capturó el registro en el sistema) — para poder hacer contabilidad por semana de cobro real en el futuro.
Campos clave: `amount`, `type` (`"Anticipo"` | `"Liquidacion"`, string libre sin enum real), `paidAt`.
Relaciones: pertenece a `Order` (cascade on delete).
Vigente: sí, pero **subutilizado** — hoy solo se usa para sumar "Pagado"/"Saldo pendiente" en el detalle de un pedido y para la métrica (engañosa) de "Ganancia del mes" del Dashboard. No existe ningún reporte que agrupe por semana/mes de verdad.

### `InventoryConsumption`
Para qué sirve: registro inmutable de cada descuento real de inventario, ya sea disparado por una venta de catálogo (`catalogSaleId`) o por completar un pedido (`orderId`) — ambos campos son opcionales y mutuamente excluyentes en la práctica.
Campos clave: `areaConsumedCm2`, `costConsumed` (congelado al momento de consumir), `costPerCm2Snapshot`.
Vigente: sí, es el libro mayor de movimientos de inventario. Es la única tabla que unifica los dos caminos de venta (`CatalogSale` y `Order`).

### `CatalogItem`
Para qué sirve: definición de un producto o kit de precio fijo (nombre, precio de venta, si es kit, costo adicional manual de tinta/luz/tiempo).
Campos clave: `unitPrice`, `otherCostPerUnit` (costo que NO viene de receta de materiales — mano de obra/insumos menores), `isActive` (soft-delete vía archivado, nunca borrado físico porque `CatalogSale`/`QuoteLineItem` lo referencian).
Relaciones: `CatalogItemMaterial[]` (receta), `CatalogSale[]`, `QuoteLineItem[]` (uso en pedidos).
Vigente: sí, central para la línea de negocio de catálogo.

### `CatalogItemMaterial`
Para qué sirve: receta — qué material y cuánta área (`areaCm2PerUnit`) consume UNA unidad vendida de un `CatalogItem`.
Vigente: sí.

### `CatalogSale`
Para qué sirve: registro histórico de una venta directa de catálogo (sin pasar por Lead/Order).
Campos clave: `unitPriceSnapshot`, `totalPrice`, `customerName` (texto libre, sin relación a `Lead`).
Vigente: **parcialmente redundante** — el mecanismo de venta que la alimentaba (`sellCatalogItem`) ya no tiene botón en la UI (se removió a propósito por violar el principio de responsabilidad única del módulo Catálogo, ver sección 10). Quedan 3 filas históricas de ejemplo/reales en el seed. Con el sistema de `Order`+`Payment` ya cubriendo "vender algo del catálogo" (una línea de `QuoteLineItem` con `catalogItemId`), esta tabla es un segundo camino de ingreso que ya no está expuesto en la UI y que el Dashboard **no suma** en ninguna métrica.

### `Lead`
Para qué sirve: catálogo de clientes/contactos — cada uno con su propio historial de `Order`s.
Campos clave: `status` (5 valores: `Contacto`|`Pendiente`|`Ganado`|`Cliente`|`Perdido`, string libre sin enum real), `name`/`phone` (ambos opcionales — se puede tener un lead completamente anónimo).
Relaciones: `Order[]`.
Vigente: sí, central.

### `Settings`
Para qué sirve: fila única de configuración global.
Campos clave: `businessName`/`ownerName`/`currency`/`theme` (**vigentes**, `businessName` se usa en el sidebar); `defaultComplexityFactor`, `defaultMinimumPricePerPiece`, `defaultMinimumJobPrice`, `defaultWastePercentage`, `premiumMultiplier`, `minimumAcceptableMultiplier`, `roundingRule` (**muertos** — solo los lee `lib/pricing`, que ya no se invoca desde ningún flujo activo).
Vigente: mixto, ver arriba.

### Cobertura de las entidades pedidas explícitamente
- **Productos:** `CatalogItem`. ✅ Existe, con CRUD completo.
- **Categorías:** no existe una tabla de categorías — `Material.category` es un string libre; `CatalogItem` no tiene categoría en absoluto.
- **Kits/paquetes:** `CatalogItem.isKit` (booleano) + su propia receta de `CatalogItemMaterial` como cualquier otro producto — no hay una tabla `Kit` separada, un kit es un `CatalogItem` más con `isKit: true`.
- **Ventas:** dos caminos, `CatalogSale` (sin UI activa) y `Order`+`QuoteLineItem` (activo). **No unificados.**
- **Detalle de ventas:** `QuoteLineItem` (líneas de un `Order`); `CatalogSale` no tiene líneas, es una venta de un solo ítem.
- **Clientes:** `Lead` cumple ese rol, aunque conceptualmente está pensado como "contacto antes de convertirse en cliente", no como un maestro de clientes puro.
- **Compras:** `Purchase`. ✅.
- **Proveedores:** **no existe una tabla `Supplier`** — es un campo de texto libre (`Material.supplierDefault`, `Purchase.supplier`), sin catálogo normalizado, sin datos de contacto del proveedor.
- **Gastos:** **no existe ningún modelo de gastos operativos** (renta, luz, gasolina, etc. — de hecho, el propio dueño mencionó explícitamente durante el desarrollo que el costo de transporte a un proveedor es "variable" y decidió NO modelarlo como costo de ningún producto, solo como regla operativa fuera del sistema).
- **Inventario:** `Material` (con el flag `isInventoryTracked`). ✅.
- **Costos:** `Material.weightedAverageCostPerCm2` (costo de material) + `CatalogItem.otherCostPerUnit` (costo manual). **No existe costo a nivel de `Order`/venta real** (ver sección 7 — es el hallazgo más importante del documento).
- **Pagos:** `Payment`. ✅, pero solo ligado a `Order`, no a `CatalogSale`.
- **Caja:** no existe ningún concepto de caja/flujo de efectivo consolidado.
- **Reportes:** no existe ninguna pantalla ni server action de reporte agregado (financiero, de ventas, de inventario). Todo lo que hoy se ve es "lista de registros" o "resumen del Dashboard", nunca un reporte con filtros de fecha.

---

## 5. Flujos actuales

- **Crear productos:** `/catalogo` → botón "Agregar producto" → dialog con nombre, precio, otros costos, es-kit, y receta (agregar líneas material+cantidad, en hojas o piezas según el material). ✅ Existe.
- **Editar productos:** mismo dialog, modo edición, botón "Editar" en cada tarjeta. Reemplaza toda la receta al guardar (no hace diff línea por línea). ✅ Existe.
- **Registrar ventas:** **Depende de qué se entiende por "venta".** No existe un flujo de "registrar una venta" aislado y directo. Lo más cercano es: crear un `Order` (vía `/leads/[id]/nuevo-pedido`) con líneas de catálogo y/o manuales, y luego (opcionalmente, en otro momento) registrar uno o más `Payment` sobre ese pedido. El camino viejo y más directo (`sellCatalogItem`) sigue en el código pero **sin botón en la UI**.
- **Registrar compras:** `/materiales` o `/materiales/[id]` o `/inventario` → botón "Agregar compra" → formulario con ancho/alto/cantidad/precio/descuento → recalcula costo promedio ponderado del material. ✅ Existe y está bien probado.
- **Registrar gastos:** **No existe.** No hay ningún flujo para capturar un gasto operativo que no sea la compra de un material específico.
- **Manejar inventario:** ver stock, alertas de stock bajo, agregar compras — todo en `/inventario`. El descuento de stock es automático al completar un pedido o (código muerto) al vender del catálogo directo. No hay ajuste manual de inventario (ej. "se me rompió una hoja", "conteo físico distinto al sistema") — **no existe ningún flujo de ajuste/merma**.
- **Consultar reportes:** **No existe ningún flujo de reporte.** Lo más cercano es el Dashboard (resumen del mes actual, sin selector de rango de fechas) y las listas/historiales de cada módulo (sin agregación).
- **Autenticarse:** **No existe.** No hay pantalla de login, no hay usuarios.
- **Configurar el negocio:** `/configuracion` → nombre del negocio, dueño (ambos funcionales) + 7 campos de un motor de pricing muerto (sin efecto real).

---

## 6. Interfaz actual

| Ruta | Objetivo | Datos que muestra | Acciones | Estado real | Componentes reutilizados | Problemas detectados |
|---|---|---|---|---|---|---|
| `/` (Dashboard) | Resumen general | Valor inventario, materiales activos, "ganancia del mes", pedidos completados, stock bajo, compras recientes, pedidos recientes | Link a agregar compra, link a nuevo lead | Funcional | `StatCard`, `EmptyState`, `OrderStatusBadge` | "Ganancia del mes" es dinero cobrado, no utilidad (ver sección 7) |
| `/catalogo` | Catálogo de productos | Grid de tarjetas: nombre, precio, costo, margen, receta expandible ("Qué necesita", en hojas/piezas, no cm²) | Crear, editar, archivar/reactivar, ver archivados | Funcional | `CatalogItemFormDialog`, `Badge`, `Switch` | Ninguno grave tras las correcciones de esta sesión |
| `/leads` | Catálogo de clientes | Tarjetas: nombre, teléfono, status, notas | Crear, editar, cambiar status inline, eliminar, ir al detalle | Funcional | `LeadStatusBadge`, `Select` | Sin búsqueda/filtro (aceptable mientras el volumen sea bajo) |
| `/leads/[id]` | Detalle de un lead | Datos de contacto + historial de todos sus pedidos | Editar lead, crear nuevo pedido, ir al detalle de un pedido | Funcional | `LeadStatusBadge`, `OrderStatusBadge`, `EmptyState` | Ninguno |
| `/leads/[id]/nuevo-pedido` | Armar un pedido nuevo | Catálogo disponible + materiales disponibles | Agregar línea de catálogo, agregar línea "Otro" (con material+cantidad opcional), guardar | Funcional, **no se pudo verificar 100% el click-through de "Agregar del catálogo" con Playwright automatizado en esta sesión** (un componente Select de Base UI no cooperó con el script de prueba) — verificado en cambio con pruebas de servidor directas | `OrderCartClient`, `AddCatalogItemDialog`, `AddOtherItemDialog` | Complejidad alta concentrada en un solo componente cliente |
| `/pedidos` | Tablero Kanban | 5 columnas (Diseñando..Entregado), tarjetas con lead, interés, total, fecha de entrega | Cambiar fase (Select), registrar pago | Funcional, verificado visualmente | `OrdersBoardClient`, `OrderStatusSelect`, `RegisterPaymentDialog` | Sin drag-and-drop (decisión, no bug) |
| `/pedidos/[id]` | Detalle de un pedido | Lead, líneas del carrito, total/pagado/saldo, fecha de entrega editable, historial de pagos | Cambiar status, editar fecha de entrega, registrar pago | Funcional | `OrderStatusSelect`, `RegisterPaymentDialog`, `OrderDeliveryDateEditor` | **No muestra costo ni margen de este pedido en ningún lado** — solo precio de venta |
| `/materiales` | Catálogo de tipos de material | Todos los materiales (inventario + costo de referencia), costo, proveedor, link de compra | Crear, editar, archivar, "Actualizar costo" (para los de solo-costo) | Funcional | `MaterialFormDialog`, filtros | Ninguno |
| `/materiales/[id]` | Detalle de un material | Costo/cm²/m², área/valor disponible, gráfica de evolución de costo, historial de compras, historial de uso en pedidos | Editar, agregar compra | Funcional | `MaterialCostChart` (recharts), `Table` | Sigue mostrando cm²/m² en vez de "hojas" para materiales que sí tienen `sheetWidthCm` — **inconsistente** con `/inventario` y `/catalogo`, que ya muestran hojas |
| `/inventario` | Stock real | Solo materiales `isInventoryTracked=true`: hojas o cm² disponibles, valor, alerta de stock bajo | Agregar compra, archivar | Funcional | `InventoryListClient` | Ninguno |
| `/calendario` | Calendario de entregas | Grilla mensual, pedidos con fecha de entrega ese día | Navegar mes anterior/siguiente, click a un pedido | Funcional | `DeliveryCalendarGrid`, `MonthNav` | Sin recordatorios/notificaciones (fuera de alcance actual) |
| `/configuracion` | Configuración global | Nombre/dueño del negocio + 7 campos de motor de pricing muerto | Guardar cambios | **Parcialmente muerta** (ver arriba) | `SettingsForm` | La mitad de la pantalla no tiene ningún efecto |
| `/api/health` | Healthcheck | N/A | N/A | No verificado el contenido exacto en esta pasada | N/A | N/A |

---

## 7. Lógica financiera actual

Esta es la sección más importante para decidir el alcance de V1. Fórmulas exactas y archivo donde viven:

**Costo de material (costo promedio ponderado):**
```
// lib/pricing/cost.ts (llamado desde lib/actions/purchases.ts)
costPerCm2 = finalPrice / totalAreaCm2                    // de ESTA compra
newWeightedAverageCostPerCm2 =
  (currentTotalValue + finalPrice) / (currentTotalArea + newArea)
```
Al **consumir** inventario (`lib/actions/orders.ts: consumeMaterial`, `lib/actions/catalog.ts: sellCatalogItem`): el costo promedio ponderado **no cambia** al consumir (solo al comprar) — **excepto** que si el área total llega a 0, se resetea `weightedAverageCostPerCm2` y `weightedAverageCostPerM2` a 0 (para no arrastrar un "costo fantasma"). Esta regla, aunque intencional, ya causó un bug real: una prueba automatizada que consumió todo el stock de un material de costo dejó su costo en $0, lo cual rompió el margen mostrado en `/catalogo` hasta que se re-sembró la base de datos.

**Costo de producción de un producto de catálogo:**
```
// lib/actions/catalog.ts: computeUnitCost()
productionCost = Σ(areaCm2PerUnit_i * weightedAverageCostPerCm2_material_i) + otherCostPerUnit
margin = unitPrice - productionCost
```
Esto se calcula **al vuelo, en cada lectura** (no se persiste) usando el costo VIGENTE de cada material — si el costo de un material cambia, el margen mostrado en `/catalogo` cambia retroactivamente para todos los productos que lo usan, incluso para ventas ya realizadas en el pasado. **Esto es correcto para "¿cuánto me costaría hacer esto HOY?", pero significa que no hay un registro histórico de cuánto costó realmente producir algo que ya se vendió.**

**Costo de una línea "Otro" en un pedido:** **No se calcula ningún costo.** `QuoteLineItem.otherMaterialAreaCm2` solo guarda cuánta área de qué material se declaró — el costo de esa área nunca se multiplica por el costo del material y nunca se guarda en ningún campo del pedido. El único lugar donde ese consumo "cuesta" algo es en el registro de `InventoryConsumption` que se crea al completar el pedido (`costConsumed`), pero **eso no se agrega ni se muestra en el detalle del pedido** (`/pedidos/[id]` solo suma `lineTotal`, que es precio de venta, no costo).

**Utilidad/margen de un pedido real:** **No existe ningún cálculo.** `/pedidos/[id]` muestra Total (suma de `lineTotal` = ingresos), Pagado (suma de `Payment.amount`), Saldo pendiente (resta) — nunca un costo ni una utilidad.

**"Ganancia del mes" del Dashboard:**
```
// lib/actions/dashboard.ts
estimatedProfitThisMonth = Σ Payment.amount WHERE paidAt está en el mes actual
```
Esto es **dinero cobrado en el mes, no utilidad**. No resta ningún costo. El nombre de la métrica ("Ganancia") es engañoso — un mes con mucho volumen de ventas de bajo margen se vería "mejor" que un mes con menos ventas pero de alto margen, aunque la utilidad real sea menor. Además, **no incluye ingresos de `CatalogSale`** (el camino de venta directa de catálogo, sin `Order`/`Payment`) — si alguien reactivara ese flujo, esos ingresos nunca aparecerían en esta métrica.

**Ventas, compras, gastos, kits, descuentos, impuestos:** compras ya cubiertas arriba (costeo de `Purchase`). Kits no tienen lógica de precio especial — un kit es un `CatalogItem` más, con su propia receta y precio fijo (no se calcula como "suma de sus componentes con descuento", es un precio independiente que el dueño define a mano). **No hay descuentos** en ningún flujo (ni por producto ni por cliente). **No hay impuestos** (ni IVA ni ningún otro) en ningún cálculo — todos los precios se tratan como precio final.

---

## 8. Qué falta para una V1 operativa

Evaluando contra la lista pedida:

1. **Catálogo de productos** — ✅ ya existe, completo.
2. **Productos individuales y kits** — ✅ ya existe (`isKit` boolean).
3. **Costos granulares por producto** — ✅ ya existe (receta de materiales + costo adicional manual), pero **solo a nivel de definición**, no de venta real (ver arriba).
4. **Registro de ventas** — ⚠️ existe, pero repartido en dos mecanismos no unificados (`CatalogSale` sin UI, `Order` activo). Hay que decidir UNO.
5. **Detalle de productos vendidos** — ✅ `QuoteLineItem` ya lo cubre para el camino de `Order`.
6. **Registro de compras y gastos** — ⚠️ compras sí (`Purchase`); **gastos operativos, no existe nada, hay que construirlo desde cero**.
7. **Clientes opcionales** — ✅ `Lead` ya permite nombre/teléfono nulos.
8. **Reporte financiero sencillo** — ❌ no existe, hay que construirlo desde cero.
9. **Resumen de ingresos, costos, utilidad y margen** — ❌ el pedazo que falta es **costo real por venta** — sin eso, cualquier reporte de utilidad será aproximado o falso.
10. **Filtros por fecha** — ❌ no existe en ningún listado hoy (todo es "los N más recientes" o "el mes actual", sin selector).
11. **Exportación básica** — ❌ no hay ningún mecanismo de exportación (CSV/Excel/PDF) en ningún módulo.

**Qué se puede reutilizar:** el 100% del modelo de Catálogo, Materiales/Inventario, Leads, y el esqueleto de `Order`/`Payment` (con un ajuste: agregar costo calculado a cada línea al momento de vender, no solo al momento de leer el catálogo).

**Qué debería ocultarse en V1:** `/configuracion` (la mitad de campos muertos), el botón/flujo de venta directa de catálogo si se decide no usarlo (o reactivarlo formalmente y borrar el camino de `Order` para ítems de catálogo puro — hay que decidir UNO de los dos caminos, no mantener ambos).

**Qué debería eliminarse de V1:** `lib/pricing` completo (motor de área+complejidad) si se confirma que el negocio no va a volver a cotizar por esa vía; los 7 campos muertos de `Settings`; los componentes huérfanos `quote-status-badge.tsx` y `price-tier-card.tsx`; la dependencia `zustand`.

**Qué está bloqueando el lanzamiento:** nada bloquea usar el sistema como está hoy para operación día a día (de hecho ya se usa). Lo que bloquea un **reporte financiero confiable** es la ausencia de costo a nivel de venta real.

**Qué sería peligroso mantener:** la regla de "resetear costo a 0 cuando el stock llega a 0" sin un mecanismo de alerta/protección — ya causó un incidente real de datos corruptos en esta misma sesión de desarrollo. Mantener dos caminos de venta (`CatalogSale` y `Order`) sin unificar es peligroso porque cualquier reporte futuro que solo mire uno de los dos estará incompleto sin que sea obvio.

---

## 9. Alcance recomendado para recortar

### Debe estar en V1
- Catálogo de productos/kits con receta y costo (ya existe).
- Un único mecanismo de venta (recomendado: `Order`+`Payment`, ya que es el que tiene UI activa y descuenta inventario correctamente) con **costo calculado y guardado en cada línea al momento de vender** (no solo el precio).
- Inventario/Materiales (ya existe).
- Reporte financiero mínimo: ingresos - costos = utilidad, por rango de fecha, sumando TODAS las ventas del mecanismo unificado.
- Filtro de fecha en ese reporte.

### Puede esperar
- Leads/CRM completo (ya es útil pero no es indispensable para "vender y llevar control" — podría simplificarse a solo un campo de texto de cliente en V1 si se quiere recortar más agresivo, aunque hoy ya funciona bien y quitarlo sería retroceder).
- Calendario de entregas.
- Kanban de producción con 5 fases (podría reducirse a un status más simple: Pendiente/En proceso/Entregado).
- Gráfica de evolución de costo por material.

### Debe ocultarse
- `/configuracion`, hasta limpiar los campos muertos.
- Cualquier UI relacionada a `CatalogSale`/`sellCatalogItem` si no se va a usar.

### Debería eliminarse o rehacerse
- `lib/pricing` completo + `engine.test.ts` (motor de área+complejidad, sin uso).
- 7 campos de `Settings` relacionados a ese motor.
- `components/quote-status-badge.tsx`, `components/price-tier-card.tsx` (huérfanos).
- Dependencia `zustand`.
- Decidir entre `CatalogSale` y `Order` para venta de catálogo — no mantener los dos.
- Renombrar `QuoteLineItem` → `OrderLineItem` (cosmético pero reduce confusión futura).

---

## 10. Deuda técnica y riesgos

- **Código muerto significativo:** `lib/pricing` (7 archivos + 1 test), `quote-status-badge.tsx`, `price-tier-card.tsx`, `zustand` como dependencia, 7 campos de `Settings`, media pantalla de `/configuracion`, el modelo `CatalogSale` + función `sellCatalogItem` sin UI activa.
- **Flujos incompletos:** ningún reporte financiero agregado; sin ajuste manual de inventario (mermas); líneas "Otro" no calculan costo, solo declaran material.
- **Datos mock:** ninguno detectado en el código de producción — el `prisma/seed.ts` contiene datos REALES del negocio (precios, materiales, proveedores confirmados directamente por el dueño), no datos ficticios (esto es una particularidad de este proyecto: el seed es la fuente de verdad operativa, no un fixture de desarrollo).
- **Hardcodes:** `DATABASE_URL` tiene un fallback hardcodeado a `file:./prisma/dev.db` en dos lugares (`lib/db.ts`, `prisma.config.ts`) — funciona para desarrollo local, sería un riesgo si se despliega sin definir la variable de entorno explícitamente (apuntaría silenciosamente a un archivo local en vez de fallar ruidosamente).
- **Problemas de seguridad:** sin autenticación, por diseño (herramienta interna de un solo usuario). Si se expone a internet sin una capa de auth/VPN, cualquiera con la URL tiene control total (crear, editar, borrar todo, incluyendo borrado físico de `Lead`s).
- **Inconsistencias de tipos:** no se detectaron errores de TypeScript en la última verificación (`tsc --noEmit` limpio al cierre de la sesión de desarrollo) — **no verificado de nuevo en esta auditoría puntual**, se recomienda re-correr antes de cualquier cambio.
- **Cálculos financieros dudosos:** "Ganancia del mes" del Dashboard (dinero cobrado, no utilidad) es el hallazgo más importante de todo el documento — ver sección 7.
- **Migraciones faltantes:** no existe `prisma/migrations/` — todo el schema se ha aplicado con `db push`, que no deja historial versionado y en algún punto de este mismo desarrollo requirió un `--force-reset` (pérdida total de datos, con backup manual hecho por fuera de Prisma) para poder aplicar un cambio de columna requerida. **Esto es un riesgo real para cualquier entorno que no sea desarrollo local.**
- **Componentes desconectados:** `quote-status-badge.tsx`, `price-tier-card.tsx` (ver arriba).
- **Riesgos de pérdida/corrupción de datos:** confirmado en esta misma sesión — probar un flujo que consume inventario real (`consumeInventory: true`) contra la base de datos de desarrollo, y luego "limpiar" solo borrando los registros de prueba, dejó un material con costo en $0 porque el efecto secundario sobre `Material.weightedAverageCostPerCm2` no se revierte al borrar el pedido de prueba. Cualquier prueba futura de este flujo debe re-sembrar la base completa al terminar, no solo borrar filas.
- **Riesgos al desplegar:** SQLite como archivo único no es apto para más de un proceso/usuario concurrente escribiendo — un despliegue real con más de un dispositivo accediendo simultáneamente necesitaría migrar a Postgres/MySQL (el uso de Prisma con adapter facilita ese cambio, pero no es trivial: hay que re-generar el cliente con otro provider, ajustar `prisma.config.ts`, y sobre todo, generar una migración real en vez de seguir con `db push`).

---

## 11. Ejecución y despliegue

- **Cómo ejecutar:** `npm install` → `npm run db:seed` (crea/repuebla `prisma/dev.db` con TODOS los datos reales del negocio, no es un seed de fixtures — ver sección 10) → `npm run dev` (Next.js con Turbopack, puerto 3000 por defecto).
- **Variables de entorno:** solo `DATABASE_URL` (ver `.env.example`: `DATABASE_URL="file:./prisma/dev.db"`). No hay ninguna otra variable de entorno en uso (no hay claves de API externas, no hay secretos).
- **Cómo crear la base de datos:** `npx prisma db push` (sincroniza el schema contra el archivo SQLite, lo crea si no existe). **No hay comando de migración** (`prisma migrate dev`) configurado/usado — `prisma.config.ts` declara `migrations.path` pero la carpeta no existe, nunca se ha usado.
- **Cómo aplicar cambios de schema:** `npx prisma db push` (y `npx prisma generate` para regenerar el cliente TypeScript). Si el cambio requiere una columna NOT NULL sin default sobre una tabla con filas existentes, `db push` fallará y pedirá `--force-reset --accept-data-loss` (borra TODO). Nota operativa real: Prisma tiene un guardrail que detecta si el comando lo está corriendo un agente de IA y exige la variable de entorno `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` con el texto exacto del consentimiento del usuario — esto ya se disparó y se resolvió durante este desarrollo.
- **Cómo cargar datos iniciales:** `npm run db:seed` (ejecuta `tsx prisma/seed.ts`). Es idempotente (borra todo en el orden correcto de FKs y vuelve a crear) — pero, importante, **borra TODOS los `Lead`/`Order`/`Payment` reales que el dueño haya capturado a mano usando la app**, porque el seed no los incluye a propósito (decisión explícita del dueño: "no quiero tener nada de data ahí", los leads/pedidos de ejemplo se quitaron del seed). Correr `db:seed` en cualquier ambiente donde ya haya operación real capturada por el usuario **destruiría esos datos**.
- **Cómo desplegar:** **No hay ninguna configuración de despliegue en el repo** — no hay `Dockerfile`, no hay configuración de Vercel/Railway/etc., no hay CI/CD. `npm run build` + `npm run start` funcionan localmente (Next.js standalone), pero llevarlo a un servidor real requiere decidir dónde vive el archivo SQLite (persistencia de disco) o migrar a una base de datos gestionada.
- **Dependencias externas que necesita:** ninguna en tiempo de ejecución más allá de un sistema de archivos donde persista `dev.db`. `better-sqlite3` es un módulo nativo (requiere compilación en la plataforma destino — **riesgo si se despliega en un contenedor/OS distinto al de desarrollo sin rebuild de dependencias nativas**).

---

## 12. Archivos clave

En orden de prioridad para entender/modificar el sistema:

1. `prisma/schema.prisma` — la fuente de verdad de todo el modelo de datos.
2. `prisma/seed.ts` — contiene TODOS los datos reales del negocio (precios, materiales, proveedores) tal como el dueño los confirmó; también documenta en sus comentarios buena parte de la historia de decisiones de negocio.
3. `lib/actions/orders.ts` — la lógica de negocio más compleja y central (carrito, descuento de inventario, snapshot de precios).
4. `lib/actions/catalog.ts` — CRUD de catálogo + cálculo de costo/margen por producto.
5. `lib/actions/materials.ts` + `lib/actions/purchases.ts` — costeo por promedio ponderado, la base de todo cálculo de costo del sistema.
6. `lib/actions/dashboard.ts` — de aquí sale la métrica financiera engañosa que hay que corregir primero.
7. `lib/actions/leads.ts` / `lib/actions/payments.ts` — CRM y pagos.
8. `lib/db.ts` — singleton de Prisma, patrón de conexión.
9. `app/(dashboard)/leads/[id]/nuevo-pedido/_components/order-cart-client.tsx` — el componente de UI más complejo (armado del carrito).
10. `README.md` / `ARCHITECTURE.md` — **ambos están muy desactualizados** (ARCHITECTURE.md describe todavía la fase de scaffold inicial; README.md menciona rutas que ya no existen como `/cotizaciones` y `/catalogo/historial`) — no confiar en ellos para entender el estado actual, usar este documento y el código en su lugar.

---

## 13. Conclusión

**¿Puede convertirse en una V1 operativa sin reescribirlo?** Sí. La arquitectura de datos (Materiales con costeo real, Catálogo con receta y margen, Order/Payment como registro de venta) es sólida y ya cubre la mayoría de lo pedido. No hace falta reescribir — hace falta **completar una pieza faltante** (costo por línea de venta real) y **limpiar deuda muerta** que activamente confunde (motor de pricing viejo, doble camino de venta, métrica financiera mal etiquetada).

**¿Qué porcentaje puede reutilizarse?** Estimado **~80-85%** del código de producto (Catálogo, Materiales, Inventario, Leads, Pedidos, Pagos, Calendario) es directamente reutilizable tal cual. El ~15-20% restante es deuda a eliminar (`lib/pricing`, campos muertos de `Settings`, componentes huérfanos) o lógica a agregar (costo por venta, reporte financiero).

**Los cinco cambios más importantes:**
1. Calcular y persistir el **costo real** de cada línea vendida (catálogo y "Otro") en el momento de la venta, no solo el precio — es el requisito previo de cualquier reporte de utilidad confiable.
2. Construir un **reporte financiero** (ingresos, costos, utilidad, margen) con filtro de fecha, alimentado por lo anterior.
3. Decidir y unificar **un solo mecanismo de venta** (`Order`+`Payment` recomendado) — eliminar o formalizar `CatalogSale`.
4. Eliminar `lib/pricing` y los campos muertos de `Settings`/`/configuracion` asociados, para que lo que se ve en la app sea 100% lo que hace la app.
5. Reemplazar `db push` por migraciones versionadas (`prisma migrate`) antes de cualquier despliegue fuera de la laptop de desarrollo — el riesgo de pérdida de datos real ya se materializó una vez en esta misma sesión.

**Camino más corto a producción:** dado que ya se usa en operación real hoy, el "camino más corto" ya se recorrió para el día a día operativo. El camino más corto específicamente hacia el **reporte financiero confiable** pedido en el alcance de V1 es: (a) agregar un campo de costo calculado a `QuoteLineItem` al momento de crear el `Order`, (b) sumar ese costo en `/pedidos/[id]` junto al total ya existente, (c) construir una sola pantalla nueva de reporte que sume ingresos/costos/utilidad de todos los `Order` en un rango de fecha dado. Eso, más la limpieza de deuda muerta de la sección 9, es realista en un esfuerzo acotado sin tocar el resto del sistema.
