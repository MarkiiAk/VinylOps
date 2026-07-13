// Seed de datos de ejemplo para VinylOps Pricing Studio.
//
// Idempotente: borra los datos existentes (en orden que respeta FKs) antes de
// volver a crearlos, así se puede correr `npm run db:seed` cuantas veces se
// quiera sin duplicar filas.
//
// Todos los valores derivados (áreas, costos, precios de cotización) se
// calculan con el motor real de `lib/pricing` — no se hardcodean números que
// el motor debería producir, para que el seed quede consistente si alguien
// ajusta las reglas de redondeo/complejidad más adelante.

import { prisma } from "../lib/db";
import {
  calculateAreaCm2,
  calculatePurchaseCostPerCm2,
  calculateWeightedAverageCost,
} from "../lib/pricing";

// GUARDA DE SEGURIDAD (V1, Fase 1): este script BORRA TODO antes de volver a
// sembrar. Eso es aceptable mientras Leads/Order/Payment esten vacios (asi
// se ha usado durante el desarrollo), pero seria catastrofico correrlo una
// vez que el negocio tenga pedidos/pagos reales capturados a mano desde la
// app. Antes de borrar nada, se cuenta cuanta data operativa real existe; si
// hay algo, el script se detiene y exige una confirmacion explicita por
// variable de entorno.
async function guardAgainstRealDataLoss() {
  const [leadCount, orderCount, paymentCount] = await Promise.all([
    prisma.lead.count(),
    prisma.order.count(),
    prisma.payment.count(),
  ]);

  const hasRealOperationalData = leadCount > 0 || orderCount > 0 || paymentCount > 0;

  if (hasRealOperationalData && process.env.I_UNDERSTAND_THIS_DELETES_REAL_DATA !== "yes") {
    console.error(`
############################################################
# PELIGRO: este comando (npm run db:seed) va a BORRAR TODO. #
############################################################

Se detectó data operativa real en la base de datos:
  - Leads:    ${leadCount}
  - Pedidos:  ${orderCount}
  - Pagos:    ${paymentCount}

Este script re-siembra el catálogo/materiales/inventario DESDE CERO, lo cual
borra TAMBIÉN todos los Leads, Pedidos y Pagos reales que el negocio haya
capturado desde la app.

Si de verdad quieres borrar esto (por ejemplo, en un ambiente de desarrollo
nuevo, nunca contra la base real del negocio en uso), vuelve a correr:

  I_UNDERSTAND_THIS_DELETES_REAL_DATA=yes npm run db:seed

Antes de eso, considera hacer un respaldo con: npm run db:backup
`);
    process.exit(1);
  }
}

async function clearData() {
  // Orden: hijos antes que padres.
  await prisma.inventoryConsumption.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderLineItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.catalogSale.deleteMany();
  await prisma.catalogItemMaterial.deleteMany();
  await prisma.catalogItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.material.deleteMany();
  await prisma.settings.deleteMany();
  // Lead va despues de Order (que lo referencia via leadId).
  await prisma.lead.deleteMany();
}

async function seedSettings() {
  return prisma.settings.create({
    data: {
      currency: "MXN",
      defaultComplexityFactor: 3.5,
      defaultMinimumPricePerPiece: 8,
      defaultMinimumJobPrice: 300,
      defaultWastePercentage: 0,
      premiumMultiplier: 1.1,
      minimumAcceptableMultiplier: 0.9,
      roundingRule: "nearest10",
      businessName: "By Lilo Studio",
      ownerName: "Marco Candiani",
    },
  });
}

/** Crea un material en 0 y le aplica una compra inicial, actualizando sus acumulados. */
async function seedMaterialWithPurchase(params: {
  name: string;
  category: string;
  color?: string;
  finish?: string;
  brand?: string;
  supplierDefault?: string;
  lowStockThresholdCm2?: number;
  isInventoryTracked?: boolean;
  sheetWidthCm?: number;
  sheetHeightCm?: number;
  purchase: {
    widthCm: number;
    heightCm: number;
    quantity: number;
    grossPrice: number;
    discount: number;
    finalPrice: number;
    daysAgo?: number;
  };
}) {
  const material = await prisma.material.create({
    data: {
      name: params.name,
      category: params.category,
      color: params.color,
      finish: params.finish,
      brand: params.brand,
      supplierDefault: params.supplierDefault,
      lowStockThresholdCm2: params.lowStockThresholdCm2 ?? 0,
      isInventoryTracked: params.isInventoryTracked ?? true,
      sheetWidthCm: params.sheetWidthCm,
      sheetHeightCm: params.sheetHeightCm,
      totalAreaCm2: 0,
      totalValue: 0,
      weightedAverageCostPerCm2: 0,
      weightedAverageCostPerM2: 0,
    },
  });

  const { widthCm, heightCm, quantity, grossPrice, discount, finalPrice, daysAgo } = params.purchase;
  const totalAreaCm2 = calculateAreaCm2(widthCm, heightCm, quantity);
  const costPerCm2 = calculatePurchaseCostPerCm2(finalPrice, totalAreaCm2);
  const costPerM2 = costPerCm2 * 10_000;

  const purchaseDate = new Date();
  if (daysAgo) purchaseDate.setDate(purchaseDate.getDate() - daysAgo);

  await prisma.purchase.create({
    data: {
      materialId: material.id,
      supplier: params.supplierDefault,
      widthCm,
      heightCm,
      quantity,
      grossPrice,
      discount,
      finalPrice,
      totalAreaCm2,
      costPerCm2,
      costPerM2,
      purchaseDate,
    },
  });

  const weighted = calculateWeightedAverageCost(0, 0, totalAreaCm2, finalPrice);

  const updated = await prisma.material.update({
    where: { id: material.id },
    data: {
      totalAreaCm2: weighted.newTotalArea,
      totalValue: weighted.newTotalValue,
      weightedAverageCostPerCm2: weighted.newWeightedAverageCostPerCm2,
      weightedAverageCostPerM2: weighted.newWeightedAverageCostPerCm2 * 10_000,
    },
  });

  return updated;
}

async function main() {
  await guardAgainstRealDataLoss();
  await clearData();

  await seedSettings();

  // Corregido 2026-07-07: NO es "vinil textil" (nombre viejo, mal), es
  // "vinil imprimible" — hojas tamaño carta (21.6x27.9cm), paquete de 100
  // por $288.26 = $2.8826/hoja, comprado en Mercado Libre. Todavía no está
  // asignado a ningún item del catálogo — Marco solo confirmó que lo tiene
  // en existencia real.
  await seedMaterialWithPurchase({
    name: "Vinil imprimible",
    category: "Vinyl",
    supplierDefault: "Mercado Libre",
    lowStockThresholdCm2: 2000,
    sheetWidthCm: 21.6,
    sheetHeightCm: 27.9,
    purchase: {
      widthCm: 21.6,
      heightCm: 27.9,
      quantity: 100,
      grossPrice: 288.26,
      discount: 0,
      finalPrice: 288.26,
      daysAgo: 5,
    },
  });

  // Costo real que da Marco: lote de 100 hojas carta (21.6x27.9cm) por $384
  // = $3.84/hoja, comprado en Mercado Libre. Se usa para las 6 plantillas del
  // catálogo (cuadernos, lápices, útiles, textiles, agua, siluetas).
  await seedMaterialWithPurchase({
    name: "Papel fotográfico adhesivo",
    category: "StickerPaper",
    color: "Blanco",
    finish: "Glossy",
    brand: "Avery",
    supplierDefault: "Mercado Libre",
    lowStockThresholdCm2: 2000,
    sheetWidthCm: 21.6,
    sheetHeightCm: 27.9,
    purchase: {
      widthCm: 21.6,
      heightCm: 27.9,
      quantity: 100,
      grossPrice: 384,
      discount: 0,
      finalPrice: 384,
      daysAgo: 5,
    },
  });

  // Blancos de identificador (el sustrato físico antes de estampar DTF UV),
  // comprados por pieza, no por área — se modelan con un "pseudo-cm2" de 1x1
  // por pieza (areaCm2PerUnit: 1 en la receta = "1 pieza") para poder
  // reusar el mismo mecanismo de costeo/inventario basado en área que el
  // resto de materiales, sin rediseñar el modelo de datos para esto.
  // Proveedor confirmado por Marco: Mercado Libre (igual que el resto de
  // materiales que él compra directo, salvo DTF/DTF UV que surte Rulán).
  // isInventoryTracked: false a propósito en este material y en los 3 de
  // abajo (identificador circular, DTF, DTF UV): son costo de referencia
  // para calcular margen, NO inventario que Marco tenga guardado y se vaya
  // gastando — no tiene sentido alertar "se está acabando" en algo que se
  // pide/maquila por pedido. Confirmado por Marco 2026-07-07: "el DTF y el
  // DTF UV no deberían ser parte de nuestro inventario, sí de materiales
  // pero no de inventario". lowStockThresholdCm2 se deja en 0 por costumbre
  // pero ya no es lo que los excluye de la alerta — isInventoryTracked es
  // la fuente de verdad real (ver dashboard.ts).
  const identificadorRectBlanco = await seedMaterialWithPurchase({
    name: "Tags rectangular acrílico transparente 3mm 11x6cm (maleta)",
    category: "Other",
    supplierDefault: "Mercado Libre",
    lowStockThresholdCm2: 0,
    isInventoryTracked: false,
    purchase: {
      widthCm: 1,
      heightCm: 1,
      quantity: 30,
      grossPrice: 404.04, // lote real de 30 piezas x $13.468/pieza
      discount: 0,
      finalPrice: 404.04,
      daysAgo: 5,
    },
  });

  // Marco confirmó que este pedido TODAVÍA NO LLEGA (2026-07-07) — el costo
  // de referencia ($24.5/pieza) es real, pero el stock físico disponible hoy
  // es 0, no las 10 piezas del lote pedido. Se corrige totalAreaCm2/
  // totalValue a 0 justo después de crear el material (sin tocar
  // weightedAverageCostPerCm2, que sigue siendo el costo real por pieza).
  const identificadorCircBlancoRaw = await seedMaterialWithPurchase({
    name: "Identificador circular blanco (sin imprimir)",
    category: "Other",
    supplierDefault: "Mercado Libre",
    lowStockThresholdCm2: 0,
    isInventoryTracked: false,
    purchase: {
      widthCm: 1,
      heightCm: 1,
      quantity: 10,
      grossPrice: 245, // lote de 10 piezas x $24.5/pieza, TODAVÍA NO LLEGA
      discount: 0,
      finalPrice: 245,
      daysAgo: 5,
    },
  });
  const identificadorCircBlanco = await prisma.material.update({
    where: { id: identificadorCircBlancoRaw.id },
    data: { totalAreaCm2: 0, totalValue: 0 },
  });

  // Rulán es el proveedor real de la impresión DTF / DTF UV que usa el
  // catálogo. Confirmado por Marco: la plantilla de "Etiquetas textiles
  // planchables" usa DTF (no UV) en una hoja de 58x25cm por $35, maquilada
  // por Rulán (tamaño distinto al "hoja carta" que usan las demás plantillas).
  const dtf = await seedMaterialWithPurchase({
    name: "DTF impreso",
    category: "DTF",
    supplierDefault: "Rulán",
    lowStockThresholdCm2: 0,
    isInventoryTracked: false,
    sheetWidthCm: 58,
    sheetHeightCm: 25,
    purchase: {
      widthCm: 58,
      heightCm: 25,
      quantity: 1,
      grossPrice: 35,
      discount: 0,
      finalPrice: 35,
      daysAgo: 5,
    },
  });

  const dtfUv = await seedMaterialWithPurchase({
    name: "DTF UV resistente al agua",
    category: "DTF",
    supplierDefault: "Rulán",
    lowStockThresholdCm2: 0,
    isInventoryTracked: false,
    sheetWidthCm: 21.6,
    sheetHeightCm: 27.9,
    purchase: {
      widthCm: 21.6,
      heightCm: 27.9,
      quantity: 1,
      grossPrice: 70,
      discount: 0,
      finalPrice: 70,
      daysAgo: 5,
    },
  });

  // Sin cotizaciones custom de ejemplo: el negocio todavía no ha hecho
  // trabajos de corte de vinil reales, así que no hay nada honesto que
  // sembrar aquí todavía (antes había 4 Quotes 100% ficticias del MVP
  // original — XV Regina, Playeras, Tarjetas, Stickers — se quitaron a
  // pedido de Marco: "veo mucha basura... deja solo lo real").

  // Catálogo de precio fijo (etiquetas escolares + kits) — segunda línea de
  // venta del negocio, precios reales tomados del PDF de precios 2026. Las
  // recetas (CatalogItemMaterial) usan los materiales que ya existen arriba;
  // el área por unidad es una estimación honesta (no tenemos medidas exactas
  // de corte todavía), marcada con TODO para que el dueño la ajuste desde la UI.
  const stickerPaperRaw = await prisma.material.findFirstOrThrow({
    where: { name: "Papel fotográfico adhesivo" },
  });

  // Marco reportó que ya se usaron 3 hojas reales de las 100 compradas
  // (fuera del flujo de catálogo, uso manual) — se restan sin tocar
  // weightedAverageCostPerCm2, mismo patrón que el ajuste de
  // "Identificador circular blanco" de arriba.
  const stickerPaperHojasUsadas = 3;
  const stickerPaper = await prisma.material.update({
    where: { id: stickerPaperRaw.id },
    data: {
      totalAreaCm2: stickerPaperRaw.totalAreaCm2 - stickerPaperHojasUsadas * calculateAreaCm2(21.6, 27.9, 1),
      totalValue: stickerPaperRaw.totalValue - stickerPaperHojasUsadas * 3.84,
    },
  });

  // 1 hoja carta completa (21.6x27.9cm) por unidad vendida, costo real dado
  // por el dueño: $3.8 la hoja (ya reflejado en el costo del material) + $3
  // de tinta/luz/tiempo (otherCostPerUnit) = $6.8 de costo total por unidad,
  // igual para las 6 plantillas de abajo (salvo identificadores).
  const hojaCartaCm2 = calculateAreaCm2(21.6, 27.9, 1);

  // 1 hoja de DTF (no UV) = 58x25cm, $35 (ver material "DTF impreso" arriba).
  const dtfHojaCm2 = calculateAreaCm2(58, 25, 1);

  // Identificador circular: Marco confirmó que caben 12 piezas por hoja de
  // DTF UV (una sola cara) -> $70/12 = $5.83/pieza por cara. Se modela en
  // "peor caso" (impreso en ambas caras) duplicando el área consumida, para
  // que el costo de material refleje 2 x $5.83 = $11.67 si aplica.
  const identificadorCircDtfUvAreaUnaCaraCm2 = hojaCartaCm2 / 12;
  const identificadorCircDtfUvAreaPeorCasoCm2 = identificadorCircDtfUvAreaUnaCaraCm2 * 2;

  // Identificador rectangular: caben 6 piezas por hoja de DTF UV (una sola
  // cara) -> $70/6 = $11.67/pieza por cara, peor caso doble cara = $23.33.
  // Rulán maquila la impresión — Marco no mete costo extra de tiempo/luz
  // aquí (a diferencia de las plantillas, que sí las hace él con su propio
  // equipo), así que el costo total sale solo de blanco + impresión.
  const identificadorRectDtfUvAreaUnaCaraCm2 = hojaCartaCm2 / 6;
  const identificadorRectDtfUvAreaPeorCasoCm2 = identificadorRectDtfUvAreaUnaCaraCm2 * 2;

  const plantillaOtherCost = 3; // $1 tinta + $1 luz + $1 tiempo, dato real del dueño

  const catalogItemsData = [
    {
      name: "Etiquetas para cuadernos",
      unitPrice: 39,
      description: "Set de etiquetas personalizadas para cuadernos escolares.",
      otherCostPerUnit: plantillaOtherCost,
      recipe: [{ material: stickerPaper, areaCm2PerUnit: hojaCartaCm2 }],
    },
    {
      name: "Etiquetas para lápices",
      unitPrice: 39,
      description: "Set de etiquetas personalizadas para lápices y plumas.",
      otherCostPerUnit: plantillaOtherCost,
      recipe: [{ material: stickerPaper, areaCm2PerUnit: hojaCartaCm2 }],
    },
    {
      name: "Etiquetas para útiles",
      unitPrice: 39,
      description: "Set de etiquetas para útiles escolares en general.",
      otherCostPerUnit: plantillaOtherCost,
      recipe: [{ material: stickerPaper, areaCm2PerUnit: hojaCartaCm2 }],
    },
    {
      // Corregido por Marco: es DTF (no papel glossy), 1 hoja de 58x25cm =
      // $35, maquilada por Rulán -> sin costo de tinta/luz/tiempo (mismo
      // motivo que los identificadores: no lo imprime Marco).
      name: "Etiquetas textiles planchables",
      unitPrice: 99,
      description: "Set de etiquetas planchables en DTF para ropa y uniformes, maquilado por Rulán.",
      recipe: [{ material: dtf, areaCm2PerUnit: calculateAreaCm2(58, 25, 1) }],
    },
    {
      // Corregido por Marco: es DTF UV (no papel glossy), 1 hoja carta
      // (21.6x27.9cm) = $70, maquilada por Rulán -> sin costo de
      // tinta/luz/tiempo.
      name: "Etiquetas a prueba de agua",
      unitPrice: 129, // subido de $99 -> $129 (2026-07-07) para emparejar margen con el resto del catálogo
      description: "Set de etiquetas resistentes al agua en DTF UV, maquilado por Rulán.",
      recipe: [{ material: dtfUv, areaCm2PerUnit: hojaCartaCm2 }],
    },
    {
      name: "Etiquetas siluetas",
      unitPrice: 39,
      description: "Set de etiquetas troqueladas en silueta personalizada.",
      otherCostPerUnit: plantillaOtherCost,
      recipe: [{ material: stickerPaper, areaCm2PerUnit: hojaCartaCm2 }],
    },
    {
      // Costo 100% real: 12 piezas por hoja DTF UV ($5.83/cara, peor caso
      // doble cara $11.67) + blanco $24.5/pieza. Rulán maquila la impresión,
      // así que no se le mete costo de tiempo/luz (confirmado por Marco:
      // "ahí no gasto mucho más que tiempo porque me lo maquila Rulán").
      // Precio ajustado 2026-07-07: $59 para quedar en ~40% de margen (pidió
      // que terminara en 9).
      name: "Identificador circular 6.5cm (UV DTF resistente al agua)",
      unitPrice: 59,
      description: "Identificador circular UV DTF, resistente al agua, 6.5cm de diámetro.",
      recipe: [
        { material: dtfUv, areaCm2PerUnit: identificadorCircDtfUvAreaPeorCasoCm2 },
        { material: identificadorCircBlanco, areaCm2PerUnit: 1 }, // "1" = 1 pieza (ver nota de pseudo-cm2 arriba)
      ],
    },
    {
      // Costo 100% real: 6 piezas por hoja DTF UV ($11.67/cara, peor caso
      // doble cara $23.33) + blanco (acrílico transparente 3mm, $13.468/
      // pieza, lote real de 30 x $404.04). Sin costo de tiempo/luz, mismo
      // motivo que el circular (lo maquila Rulán). Precio ajustado
      // 2026-07-07: $79 (antes $70) para subir margen a ~53%.
      name: "Identificador rectangular 11x6cm (UV DTF resistente al agua)",
      unitPrice: 79,
      description: "Identificador rectangular UV DTF, resistente al agua, 11cm x 6cm.",
      recipe: [
        { material: dtfUv, areaCm2PerUnit: identificadorRectDtfUvAreaPeorCasoCm2 },
        { material: identificadorRectBlanco, areaCm2PerUnit: 1 }, // "1" = 1 pieza
      ],
    },
    {
      name: "Kit Básico",
      unitPrice: 349,
      isKit: true,
      description: "Kit básico de etiquetas escolares: cuadernos, lápices y útiles.",
      // Composición real confirmada por Marco (2026-07-07): 2 hojas
      // fotográfico (cuadernos) + 2 (lápices) + 2 (útiles) = 6 hojas, 1 hoja
      // DTF y 1 hoja DTF UV. $3/hoja de tinta+luz+tiempo SOLO en las hojas
      // de fotográfico (las de DTF/DTF UV las maquila Rulán, sin ese costo).
      otherCostPerUnit: 6 * plantillaOtherCost, // 6 hojas fotográfico x $3
      recipe: [
        { material: stickerPaper, areaCm2PerUnit: 6 * hojaCartaCm2 }, // 2 cuadernos + 2 lápices + 2 útiles
        { material: dtf, areaCm2PerUnit: dtfHojaCm2 }, // 1 hoja DTF
        { material: dtfUv, areaCm2PerUnit: hojaCartaCm2 }, // 1 hoja DTF UV
      ],
    },
    {
      name: "Kit Premium",
      unitPrice: 449,
      isKit: true,
      description: "Kit premium: incluye etiquetas escolares, textiles planchables e identificador de agua.",
      // Composición real confirmada por Marco (2026-07-07): 2 hojas
      // fotográfico (cuadernos) + 3 (lápices) + 2 (útiles) + 1 (siluetas) = 8
      // hojas, 2 hojas DTF y 2 hojas DTF UV. Mismo criterio de costo que
      // Kit Básico.
      otherCostPerUnit: 8 * plantillaOtherCost, // 8 hojas fotográfico x $3
      recipe: [
        { material: stickerPaper, areaCm2PerUnit: 8 * hojaCartaCm2 }, // 2 cuadernos + 3 lápices + 2 útiles + 1 siluetas
        { material: dtf, areaCm2PerUnit: 2 * dtfHojaCm2 }, // 2 hojas DTF
        { material: dtfUv, areaCm2PerUnit: 2 * hojaCartaCm2 }, // 2 hojas DTF UV
      ],
    },
  ];

  const createdCatalogItems = [];
  for (const itemData of catalogItemsData) {
    const created = await prisma.catalogItem.create({
      data: {
        name: itemData.name,
        unitPrice: itemData.unitPrice,
        isKit: itemData.isKit ?? false,
        otherCostPerUnit: itemData.otherCostPerUnit ?? 0,
        description: itemData.description,
      },
    });

    for (const line of itemData.recipe) {
      await prisma.catalogItemMaterial.create({
        data: {
          catalogItemId: created.id,
          materialId: line.material.id,
          areaCm2PerUnit: line.areaCm2PerUnit,
        },
      });
    }

    createdCatalogItems.push({ ...created, recipe: itemData.recipe });
  }

  // Ventas de catálogo de ejemplo, con su consumo de inventario, para que el
  // historial no se vea vacío (mismo criterio que las Quotes de ejemplo).
  const etiquetasCuadernos = createdCatalogItems.find((i) => i.name === "Etiquetas para cuadernos")!;
  const saleQuantity1 = 3;
  const sale1 = await prisma.catalogSale.create({
    data: {
      catalogItemId: etiquetasCuadernos.id,
      quantity: saleQuantity1,
      unitPriceSnapshot: etiquetasCuadernos.unitPrice,
      totalPrice: etiquetasCuadernos.unitPrice * saleQuantity1,
      customerName: "Mamá de Regina",
    },
  });
  for (const line of etiquetasCuadernos.recipe) {
    const areaConsumedCm2 = line.areaCm2PerUnit * saleQuantity1;
    await prisma.inventoryConsumption.create({
      data: {
        catalogSaleId: sale1.id,
        materialId: line.material.id,
        areaConsumedCm2,
        costConsumed: areaConsumedCm2 * line.material.weightedAverageCostPerCm2,
        costPerCm2Snapshot: line.material.weightedAverageCostPerCm2,
      },
    });
  }

  const kitPremium = createdCatalogItems.find((i) => i.name === "Kit Premium")!;
  const saleQuantity2 = 1;
  const sale2 = await prisma.catalogSale.create({
    data: {
      catalogItemId: kitPremium.id,
      quantity: saleQuantity2,
      unitPriceSnapshot: kitPremium.unitPrice,
      totalPrice: kitPremium.unitPrice * saleQuantity2,
      customerName: "Familia Torres",
      notes: "Entregado en punto de venta.",
    },
  });
  for (const line of kitPremium.recipe) {
    const areaConsumedCm2 = line.areaCm2PerUnit * saleQuantity2;
    await prisma.inventoryConsumption.create({
      data: {
        catalogSaleId: sale2.id,
        materialId: line.material.id,
        areaConsumedCm2,
        costConsumed: areaConsumedCm2 * line.material.weightedAverageCostPerCm2,
        costPerCm2Snapshot: line.material.weightedAverageCostPerCm2,
      },
    });
  }

  // Venta histórica real: 2 identificadores rectangulares, ya depositados/
  // pagados por la clienta (lead #3 de abajo), maquilado pendiente. Se
  // vendieron a $65/pieza, el precio VIEJO del identificador rectangular
  // (antes de subir a $79) — por eso se crea el CatalogSale directo con
  // Prisma en vez de usar sellCatalogItem(), que siempre usa el precio
  // vigente del CatalogItem. Se descuenta inventario igual que sale1/sale2
  // (blanco acrílico + DTF UV, x2).
  const identificadorRect = createdCatalogItems.find(
    (i) => i.name === "Identificador rectangular 11x6cm (UV DTF resistente al agua)"
  )!;
  const saleQuantity3 = 2;
  const historicalUnitPrice = 65;
  const sale3 = await prisma.catalogSale.create({
    data: {
      catalogItemId: identificadorRect.id,
      quantity: saleQuantity3,
      unitPriceSnapshot: historicalUnitPrice,
      totalPrice: historicalUnitPrice * saleQuantity3,
      notes: "Venta histórica al precio viejo ($65/pieza, antes de subir a $79). Ya depositado, falta maquilar.",
    },
  });
  for (const line of identificadorRect.recipe) {
    const areaConsumedCm2 = line.areaCm2PerUnit * saleQuantity3;
    await prisma.inventoryConsumption.create({
      data: {
        catalogSaleId: sale3.id,
        materialId: line.material.id,
        areaConsumedCm2,
        costConsumed: areaConsumedCm2 * line.material.weightedAverageCostPerCm2,
        costPerCm2Snapshot: line.material.weightedAverageCostPerCm2,
      },
    });
  }

  // A propósito, sin leads/pedidos/pagos de ejemplo: Marco pidió
  // explícitamente (2026-07-07) "no quiero tener nada de data ahí" — el
  // catálogo/materiales/inventario sí llevan datos reales sembrados, pero
  // Leads y Pedidos arrancan vacíos y él los va llenando conforme le
  // escriben de verdad por WhatsApp, no con datos de ejemplo/históricos
  // precargados por este script.

  const materialsCount = await prisma.material.count();
  const purchasesCount = await prisma.purchase.count();
  const ordersCount = await prisma.order.count();
  const paymentsCount = await prisma.payment.count();
  const catalogItemsCount = await prisma.catalogItem.count();
  const catalogSalesCount = await prisma.catalogSale.count();
  const leadsCount = await prisma.lead.count();

  console.log(
    `Seed completo: ${materialsCount} materiales, ${purchasesCount} compras, ${ordersCount} pedidos, ${paymentsCount} pagos, ${catalogItemsCount} items de catalogo, ${catalogSalesCount} ventas de catalogo, ${leadsCount} leads.`
  );
}

main()
  .catch((error) => {
    console.error("Error corriendo el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
