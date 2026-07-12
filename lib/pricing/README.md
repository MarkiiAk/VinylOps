# Pricing Engine — placeholder

Aqui vivira el motor de pricing de VinylOps como funciones puras (sin efectos
secundarios, sin llamadas a Prisma directamente) que reciban datos de
`Material`, `Quote` y `Settings` y devuelvan los calculos de:

- `calculatedPrice`, `minimumAcceptablePrice`, `recommendedPrice`, `premiumPrice`
- Costo ponderado de materiales por cotizacion (via `QuoteMaterialUsage`)
- Reglas de redondeo (`Settings.roundingRule`) y multiplicadores
  (`premiumMultiplier`, `minimumAcceptableMultiplier`)

No implementado en esta fase (scaffold de arquitectura). Lo construye
Ingenieria Fullstack en el siguiente sprint.
