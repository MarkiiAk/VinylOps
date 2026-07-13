# Costeo de compras (antes "Pricing Engine")

El motor original de pricing por área+complejidad (`calculateQuotePrices`,
`suggestComplexityFactor`, `roundPrice`) se retiró en Fase 6 (V1, limpieza):
cero consumidores reales desde que el negocio pasó a precio fijo por
catálogo (ver `lib/costing.ts` para el modelo financiero granular actual).

Lo único que sigue vivo aquí es el cálculo de área y costo promedio
ponderado usado por una compra de material (`lib/actions/purchases.ts`):

- `calculateAreaCm2` — área de una pieza/lote.
- `calculatePurchaseCostPerCm2` / `calculateWeightedAverageCost` — costo
  puntual de una compra y actualización del costo promedio ponderado del
  material.
