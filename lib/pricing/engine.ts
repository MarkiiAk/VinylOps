// Motor de pricing de VinylOps.
//
// El engine esta dividido en varios archivos por responsabilidad
// (area.ts, cost.ts, complexity.ts, rounding.ts, quote.ts) en vez de un solo
// archivo monolitico, pero este modulo re-exporta todo para que se pueda
// importar como un unico punto de entrada: `import { ... } from '@/lib/pricing/engine'`
// o preferentemente `from '@/lib/pricing'` (ver index.ts).
//
// Decisiones de redondeo / puntos medios usadas para que el caso de prueba
// del spec (65 etiquetas XV Regina) cuadre con los numeros esperados estan
// documentadas en quote.ts (calculateQuotePrices) y complexity.ts
// (suggestComplexityFactor) junto a cada regla, no repetidas aqui.
//
// Todas las funciones de este modulo son puras: no importan Prisma, no
// tocan la base de datos, no dependen de React ni de Next.js. Reciben datos
// primitivos/DTOs y devuelven datos primitivos/DTOs.

export * from './area'
export * from './cost'
export * from './complexity'
export * from './rounding'
export * from './quote'
export * from './types'
