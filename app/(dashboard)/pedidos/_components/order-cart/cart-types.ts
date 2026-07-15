// Tipos compartidos del carrito de "Nuevo pedido". El carrito vive
// enteramente en estado local del cliente (ver order-cart-client.tsx) hasta
// que se guarda de una sola vez con createOrder.

export interface CatalogItemLite {
  id: string;
  name: string;
  unitPrice: number;
}

export interface MaterialLite {
  id: string;
  name: string;
  sheetWidthCm: number | null;
  sheetHeightCm: number | null;
  unit: string;
}

export interface CartLine {
  /** Id local (crypto.randomUUID) solo para key de React y remover la línea; no se persiste. */
  localId: string;
  catalogItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  otherMaterialId?: string;
  otherMaterialName?: string;
  /** Área total (cm2) para TODA la línea, ya multiplicada por quantity. */
  otherMaterialAreaCm2?: number;
  // FASE 2 (V1): costos granulares POR UNIDAD para líneas "Otro" (manuales).
  // Las líneas de catálogo no los usan aquí — se toman del CatalogItem
  // vigente al congelar el snapshot en createOrder (lib/actions/orders.ts).
  unitInkCost?: number;
  unitElectricityCost?: number;
  unitWearCost?: number;
  unitWasteCost?: number;
  unitBagCost?: number;
  unitLabelCost?: number;
  estimatedUnitLabor?: number;
}

export function lineTotal(line: CartLine): number {
  return line.quantity * line.unitPrice;
}
