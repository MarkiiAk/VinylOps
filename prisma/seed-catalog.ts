// Seed de CATÁLOGO Y RECETA — solo Material + CatalogItem +
// CatalogItemMaterial + CatalogItemComponent, con los datos y costos REALES
// del negocio (dictados por el dueño, verificados exacto contra su propio
// cálculo del Kit Básico: $452 equivalente, $103 de ahorro, 22.79%).
//
// A propósito NO toca Lead/Order/Payment/Purchase/Expense/CatalogSale — a
// diferencia de prisma/seed.ts (que es solo para desarrollo/demo), este
// script es seguro para correr UNA VEZ contra una base de producción recién
// creada (Vercel), para dejarla operativa con el catálogo real sin
// necesidad de capturarlo todo a mano desde la UI.
//
// Los materiales se crean con stock en CERO (totalAreaCm2/totalValue/
// weightedAverageCostPerCm2 = 0) a propósito — el inventario real se
// construye con las compras reales que el dueño registre desde /materiales,
// no con datos inventados aquí.
//
// Idempotente por seguridad: si ya existe algún CatalogItem, se detiene sin
// tocar nada (evita duplicar si alguien lo corre dos veces por error).

import "dotenv/config";
import { prisma } from "../lib/db";
import { deriveKitMaterialRecipe } from "../lib/costing";

async function main() {
  const existingCount = await prisma.catalogItem.count();
  if (existingCount > 0) {
    console.error(
      `Ya existen ${existingCount} items de catálogo en esta base — este script no corre dos veces para evitar ` +
        `duplicar datos. Si de verdad quieres re-sembrar el catálogo, borra los CatalogItem/Material relacionados ` +
        `a mano primero (o pide ayuda antes de hacerlo).`
    );
    process.exit(1);
  }

  // --- Materiales (stock en 0, solo estructura/costo de referencia) ---
  const materialDefs = [
    {
      name: "Papel fotográfico adhesivo",
      category: "StickerPaper",
      color: "Blanco",
      finish: "Glossy",
      brand: "Avery",
      supplierDefault: "Mercado Libre",
      isInventoryTracked: true,
      sheetWidthCm: 21.6,
      sheetHeightCm: 27.9,
      lowStockThresholdCm2: 2000,
    },
    {
      name: "DTF impreso",
      category: "DTF",
      supplierDefault: "Rulán",
      isInventoryTracked: false,
      sheetWidthCm: 58,
      sheetHeightCm: 25,
    },
    {
      name: "DTF UV resistente al agua",
      category: "DTF",
      supplierDefault: "Rulán",
      isInventoryTracked: false,
      sheetWidthCm: 21.6,
      sheetHeightCm: 27.9,
    },
    {
      name: "Identificador circular blanco (sin imprimir)",
      category: "Other",
      supplierDefault: "Mercado Libre",
      isInventoryTracked: false,
    },
    {
      name: "Tags rectangular acrílico transparente 3mm 11x6cm (maleta)",
      category: "Other",
      supplierDefault: "Mercado Libre",
      isInventoryTracked: false,
    },
  ] as const;

  const materials = new Map<string, { id: string }>();
  for (const def of materialDefs) {
    const material = await prisma.material.create({
      data: {
        name: def.name,
        category: def.category,
        color: "color" in def ? def.color : undefined,
        finish: "finish" in def ? def.finish : undefined,
        brand: "brand" in def ? def.brand : undefined,
        supplierDefault: def.supplierDefault,
        isInventoryTracked: def.isInventoryTracked,
        sheetWidthCm: "sheetWidthCm" in def ? def.sheetWidthCm : undefined,
        sheetHeightCm: "sheetHeightCm" in def ? def.sheetHeightCm : undefined,
        lowStockThresholdCm2: "lowStockThresholdCm2" in def ? def.lowStockThresholdCm2 : 0,
      },
    });
    materials.set(def.name, material);
    console.log(`Material: ${def.name}`);
  }

  const papel = materials.get("Papel fotográfico adhesivo")!.id;
  const dtfImpreso = materials.get("DTF impreso")!.id;
  const dtfUv = materials.get("DTF UV resistente al agua")!.id;
  const identificadorBlanco = materials.get("Identificador circular blanco (sin imprimir)")!.id;
  const tagRectangular = materials.get("Tags rectangular acrílico transparente 3mm 11x6cm (maleta)")!.id;

  // --- Costos granulares reales por producto (2026-07, dictados por el dueño) ---
  const cuadernosLapicesUtiles = {
    materialCostPerUnit: 3.84,
    inkCostPerUnit: 1.0,
    electricityCostPerUnit: 0.25,
    wearCostPerUnit: 1.0,
    wasteCostPerUnit: 0.75,
    bagCostPerUnit: 0.49,
    labelCostPerUnit: 0.21,
  };

  const productDefs = [
    {
      name: "Etiquetas para cuadernos",
      unitPrice: 39,
      ...cuadernosLapicesUtiles,
      laborCostPerUnit: 4.0,
      description: "Set de etiquetas personalizadas para cuadernos escolares.",
      recipe: [{ materialId: papel, areaCm2PerUnit: 602.64 }],
    },
    {
      name: "Etiquetas para lápices",
      unitPrice: 39,
      ...cuadernosLapicesUtiles,
      laborCostPerUnit: 4.0,
      description: "Set de etiquetas personalizadas para lápices y plumas.",
      recipe: [{ materialId: papel, areaCm2PerUnit: 602.64 }],
    },
    {
      name: "Etiquetas para útiles",
      unitPrice: 39,
      ...cuadernosLapicesUtiles,
      laborCostPerUnit: 4.0,
      description: "Set de etiquetas para útiles escolares en general.",
      recipe: [{ materialId: papel, areaCm2PerUnit: 602.64 }],
    },
    {
      name: "Etiquetas siluetas",
      unitPrice: 49,
      ...cuadernosLapicesUtiles,
      laborCostPerUnit: 5.0,
      description: "Set de etiquetas troqueladas en silueta personalizada.",
      recipe: [{ materialId: papel, areaCm2PerUnit: 602.64 }],
    },
    {
      name: "Etiquetas textiles planchables",
      unitPrice: 99,
      materialCostPerUnit: 17.5,
      inkCostPerUnit: 0,
      electricityCostPerUnit: 0,
      wearCostPerUnit: 0,
      wasteCostPerUnit: 1.0,
      bagCostPerUnit: 0.49,
      labelCostPerUnit: 0.21,
      laborCostPerUnit: 4.0,
      description: "Set de etiquetas planchables en DTF para ropa y uniformes, maquilado por Rulán. Presentación: media carta.",
      recipe: [{ materialId: dtfImpreso, areaCm2PerUnit: 1450 }],
    },
    {
      name: "Etiquetas a prueba de agua",
      unitPrice: 119,
      materialCostPerUnit: 35.0,
      inkCostPerUnit: 0,
      electricityCostPerUnit: 0,
      wearCostPerUnit: 0,
      wasteCostPerUnit: 1.0,
      bagCostPerUnit: 0.49,
      labelCostPerUnit: 0.21,
      laborCostPerUnit: 4.0,
      description: "Set de etiquetas resistentes al agua en DTF UV, maquilado por Rulán. Presentación: media carta.",
      recipe: [{ materialId: dtfUv, areaCm2PerUnit: 602.64 }],
    },
    {
      name: "Identificador circular 6.5cm (UV DTF resistente al agua) — una cara",
      unitPrice: 69,
      materialCostPerUnit: 17.42,
      inkCostPerUnit: 0,
      electricityCostPerUnit: 0.1,
      wearCostPerUnit: 0.4,
      wasteCostPerUnit: 1.5,
      bagCostPerUnit: 0.49,
      labelCostPerUnit: 0.21,
      laborCostPerUnit: 6.0,
      description: "Identificador circular UV DTF, resistente al agua, 6.5cm de diámetro, impresión a una cara.",
      recipe: [
        { materialId: dtfUv, areaCm2PerUnit: 100.44 },
        { materialId: identificadorBlanco, areaCm2PerUnit: 1 },
      ],
    },
    {
      name: "Identificador circular 6.5cm (UV DTF resistente al agua) — dos caras",
      unitPrice: 89,
      materialCostPerUnit: 23.86,
      inkCostPerUnit: 0,
      electricityCostPerUnit: 0.1,
      wearCostPerUnit: 0.4,
      wasteCostPerUnit: 1.5,
      bagCostPerUnit: 0.49,
      labelCostPerUnit: 0.21,
      laborCostPerUnit: 8.0,
      description: "Identificador circular UV DTF, resistente al agua, 6.5cm de diámetro, impresión a dos caras.",
      recipe: [] as { materialId: string; areaCm2PerUnit: number }[],
    },
    {
      name: "Identificador rectangular 11x6cm (UV DTF resistente al agua) — una cara",
      unitPrice: 79,
      materialCostPerUnit: 21.69,
      inkCostPerUnit: 0,
      electricityCostPerUnit: 0.1,
      wearCostPerUnit: 0.4,
      wasteCostPerUnit: 1.5,
      bagCostPerUnit: 0.49,
      labelCostPerUnit: 0.21,
      laborCostPerUnit: 6.0,
      description: "Identificador rectangular UV DTF, resistente al agua, 11cm x 6cm, impresión a una cara.",
      recipe: [
        { materialId: dtfUv, areaCm2PerUnit: 200.88 },
        { materialId: tagRectangular, areaCm2PerUnit: 1 },
      ],
    },
    {
      name: "Identificador rectangular 11x6cm (UV DTF resistente al agua) — dos caras",
      unitPrice: 109,
      materialCostPerUnit: 31.33,
      inkCostPerUnit: 0,
      electricityCostPerUnit: 0.1,
      wearCostPerUnit: 0.4,
      wasteCostPerUnit: 1.5,
      bagCostPerUnit: 0.49,
      labelCostPerUnit: 0.21,
      laborCostPerUnit: 8.0,
      description: "Identificador rectangular UV DTF, resistente al agua, 11cm x 6cm, impresión a dos caras.",
      recipe: [] as { materialId: string; areaCm2PerUnit: number }[],
    },
  ];

  const items = new Map<string, { id: string }>();
  for (const def of productDefs) {
    const created = await prisma.catalogItem.create({
      data: {
        name: def.name,
        isKit: false,
        unitPrice: def.unitPrice,
        materialCostPerUnit: def.materialCostPerUnit,
        inkCostPerUnit: def.inkCostPerUnit,
        electricityCostPerUnit: def.electricityCostPerUnit,
        wearCostPerUnit: def.wearCostPerUnit,
        wasteCostPerUnit: def.wasteCostPerUnit,
        bagCostPerUnit: def.bagCostPerUnit,
        labelCostPerUnit: def.labelCostPerUnit,
        laborCostPerUnit: def.laborCostPerUnit,
        description: def.description,
      },
    });
    items.set(def.name, created);
    for (const line of def.recipe) {
      await prisma.catalogItemMaterial.create({
        data: { catalogItemId: created.id, materialId: line.materialId, areaCm2PerUnit: line.areaCm2PerUnit },
      });
    }
    console.log(`Producto: ${def.name} ($${def.unitPrice})`);
  }

  // --- Kits: precio + empaque compartido (bolsa/etiquetita); el resto se deriva de los componentes ---
  const kitDefs = [
    {
      name: "Kit Básico",
      unitPrice: 349,
      description: "Kit básico de etiquetas escolares: cuadernos, lápices y útiles.",
      components: [
        { name: "Etiquetas para cuadernos", quantity: 3 },
        { name: "Etiquetas para lápices", quantity: 2 },
        { name: "Etiquetas para útiles", quantity: 1 },
        { name: "Etiquetas textiles planchables", quantity: 1 },
        { name: "Etiquetas a prueba de agua", quantity: 1 },
      ],
    },
    {
      name: "Kit Premium",
      unitPrice: 449,
      description: "Kit premium: incluye etiquetas escolares, textiles planchables e identificador de agua.",
      components: [
        { name: "Etiquetas para cuadernos", quantity: 4 },
        { name: "Etiquetas para lápices", quantity: 3 },
        { name: "Etiquetas para útiles", quantity: 1 },
        { name: "Etiquetas siluetas", quantity: 1 },
        { name: "Etiquetas textiles planchables", quantity: 1 },
        { name: "Etiquetas a prueba de agua", quantity: 1 },
        { name: "Identificador rectangular 11x6cm (UV DTF resistente al agua) — una cara", quantity: 1 },
      ],
    },
  ];

  for (const kitDef of kitDefs) {
    const kit = await prisma.catalogItem.create({
      data: {
        name: kitDef.name,
        isKit: true,
        unitPrice: kitDef.unitPrice,
        bagCostPerUnit: 0.49,
        labelCostPerUnit: 0.21,
        description: kitDef.description,
      },
    });

    const componentsWithRecipes = await Promise.all(
      kitDef.components.map(async (c) => {
        const componentItem = items.get(c.name);
        if (!componentItem) throw new Error(`Componente no encontrado: ${c.name}`);
        const materialsForRecipe = await prisma.catalogItemMaterial.findMany({ where: { catalogItemId: componentItem.id } });
        return { quantity: c.quantity, componentItemId: componentItem.id, componentItem: { materials: materialsForRecipe } };
      })
    );

    for (const c of componentsWithRecipes) {
      await prisma.catalogItemComponent.create({
        data: { kitId: kit.id, componentItemId: c.componentItemId, quantity: c.quantity },
      });
    }

    const derivedRecipe = deriveKitMaterialRecipe(componentsWithRecipes);
    for (const line of derivedRecipe) {
      await prisma.catalogItemMaterial.create({
        data: { catalogItemId: kit.id, materialId: line.materialId, areaCm2PerUnit: line.areaCm2PerUnit },
      });
    }

    console.log(`Kit: ${kitDef.name} ($${kitDef.unitPrice}) — ${componentsWithRecipes.length} componentes`);
  }

  console.log("\nCatálogo real sembrado correctamente.");
}

main().finally(() => prisma.$disconnect());
