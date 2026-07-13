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
