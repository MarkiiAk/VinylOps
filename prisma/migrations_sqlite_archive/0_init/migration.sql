-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT,
    "finish" TEXT,
    "brand" TEXT,
    "supplierDefault" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'cm2',
    "totalAreaCm2" REAL NOT NULL DEFAULT 0,
    "totalValue" REAL NOT NULL DEFAULT 0,
    "weightedAverageCostPerCm2" REAL NOT NULL DEFAULT 0,
    "weightedAverageCostPerM2" REAL NOT NULL DEFAULT 0,
    "lowStockThresholdCm2" REAL NOT NULL DEFAULT 0,
    "isInventoryTracked" BOOLEAN NOT NULL DEFAULT true,
    "sheetWidthCm" REAL,
    "sheetHeightCm" REAL,
    "purchaseUrl" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "supplier" TEXT,
    "widthCm" REAL NOT NULL,
    "heightCm" REAL NOT NULL,
    "quantity" REAL NOT NULL,
    "grossPrice" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "finalPrice" REAL NOT NULL,
    "totalAreaCm2" REAL NOT NULL,
    "costPerCm2" REAL NOT NULL,
    "costPerM2" REAL NOT NULL,
    "purchaseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "interest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Disenando',
    "notes" TEXT,
    "deliveryDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "lineTotal" REAL NOT NULL,
    "otherMaterialId" TEXT,
    "otherMaterialAreaCm2" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteLineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteLineItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuoteLineItem_otherMaterialId_fkey" FOREIGN KEY ("otherMaterialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryConsumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT,
    "catalogSaleId" TEXT,
    "materialId" TEXT NOT NULL,
    "areaConsumedCm2" REAL NOT NULL,
    "costConsumed" REAL NOT NULL,
    "costPerCm2Snapshot" REAL NOT NULL,
    "consumedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "InventoryConsumption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryConsumption_catalogSaleId_fkey" FOREIGN KEY ("catalogSaleId") REFERENCES "CatalogSale" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryConsumption_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isKit" BOOLEAN NOT NULL DEFAULT false,
    "unitPrice" REAL NOT NULL,
    "otherCostPerUnit" REAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CatalogItemMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "catalogItemId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "areaCm2PerUnit" REAL NOT NULL,
    CONSTRAINT "CatalogItemMaterial_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatalogItemMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CatalogSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "catalogItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceSnapshot" REAL NOT NULL,
    "totalPrice" REAL NOT NULL,
    "customerName" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogSale_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Contacto',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "defaultComplexityFactor" REAL NOT NULL DEFAULT 3.5,
    "defaultMinimumPricePerPiece" REAL NOT NULL DEFAULT 8,
    "defaultMinimumJobPrice" REAL NOT NULL DEFAULT 300,
    "defaultWastePercentage" REAL NOT NULL DEFAULT 0,
    "premiumMultiplier" REAL NOT NULL DEFAULT 1.10,
    "minimumAcceptableMultiplier" REAL NOT NULL DEFAULT 0.90,
    "roundingRule" TEXT NOT NULL DEFAULT 'nearest10',
    "businessName" TEXT NOT NULL DEFAULT 'VinylOps',
    "ownerName" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

