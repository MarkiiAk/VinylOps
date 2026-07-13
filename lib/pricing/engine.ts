// Motor de costeo de compras de VinylOps.
//
// FASE 6 (V1, limpieza): el motor original de pricing por área+complejidad
// (calculateQuotePrices, suggestComplexityFactor, roundPrice — vivían en
// quote.ts/complexity.ts/rounding.ts) se retiró: cero consumidores reales
// desde que el flujo de precio fijo (Catálogo) y el modelo financiero
// granular (lib/costing.ts) reemplazaron ese enfoque. Lo único que sigue
// vivo y en uso real (lib/actions/purchases.ts, purchase-form.tsx) es el
// cálculo de área y costo promedio ponderado de una compra de material —
// eso es lo que queda aquí.
//
// Todas las funciones de este módulo son puras: no importan Prisma, no
// tocan la base de datos, no dependen de React ni de Next.js.

export * from './area'
export * from './cost'
