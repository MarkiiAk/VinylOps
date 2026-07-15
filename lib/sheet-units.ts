// Conversion cm2 <-> hojas para materiales que se compran/usan en hojas de
// tamano fijo (ej. tamano carta) — la unidad real con la que este negocio
// piensa, en vez de cm2/m2 (ver feedback del dueño: "manejamos solo hojas
// tamaño carta we y listo, esa es nuestra medida estandar").

export interface SheetDimensions {
  sheetWidthCm: number | null
  sheetHeightCm: number | null
}

export function hasFixedSheet(material: SheetDimensions): boolean {
  return Boolean(material.sheetWidthCm && material.sheetHeightCm)
}

/**
 * Material que se compra/vende por PIEZA (ej. bolsas de Pringles para
 * reempaquetar, tags de acrílico) — no tiene sentido medirlo por cm2 ni por
 * hoja, se cuenta directo (compras 40 piezas, vendes 1, quedan 39). Se marca
 * con `unit: "pieza"` en vez de inventar dimensiones falsas — ver
 * purchase-form.tsx, que para este caso manda ancho=alto=1 por dentro para
 * reusar el mismo motor de costeo por área sin tocarlo.
 */
export function isPieceUnit(material: { unit: string }): boolean {
  return material.unit === 'pieza'
}

export function sheetAreaCm2(material: SheetDimensions): number {
  return (material.sheetWidthCm ?? 0) * (material.sheetHeightCm ?? 0)
}

/** Costo por hoja = costo por cm2 * area de una hoja. */
export function costPerSheet(costPerCm2: number, material: SheetDimensions): number {
  return costPerCm2 * sheetAreaCm2(material)
}

/** Cuantas hojas representa un area en cm2 (puede ser fraccionario, ej. media hoja). */
export function areaToSheets(areaCm2: number, material: SheetDimensions): number {
  const area = sheetAreaCm2(material)
  return area > 0 ? areaCm2 / area : 0
}

/**
 * Texto legible de una cantidad de "area" interna (siempre guardada en
 * totalAreaCm2/areaCm2PerUnit) en la unidad real con la que piensa el
 * dueño — hojas, piezas, o cm2 crudo. Usado en mensajes de error/aviso
 * (ver createOrder en lib/actions/orders.ts) para no filtrar el detalle
 * interno de implementación ("cm2") a materiales que en realidad son piezas.
 */
export function formatMaterialQuantity(areaCm2: number, material: SheetDimensions & { unit: string }): string {
  if (hasFixedSheet(material)) {
    const sheets = Math.round(areaToSheets(areaCm2, material) * 100) / 100
    return `${sheets} hoja${sheets === 1 ? '' : 's'}`
  }
  if (isPieceUnit(material)) {
    const pieces = Math.round(areaCm2 * 100) / 100
    return `${pieces} pieza${pieces === 1 ? '' : 's'}`
  }
  return `${areaCm2.toFixed(2)} cm²`
}
