/*
  Warnings:

  - You are about to drop the `QuoteLineItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "QuoteLineItem";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "OrderLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "lineTotal" REAL NOT NULL,
    "otherMaterialId" TEXT,
    "otherMaterialAreaCm2" REAL,
    "unitMaterialCost" REAL,
    "unitInkCost" REAL,
    "unitElectricityCost" REAL,
    "unitWearCost" REAL,
    "unitWasteCost" REAL,
    "unitBagCost" REAL,
    "unitLabelCost" REAL,
    "unitDirectCost" REAL,
    "totalDirectCost" REAL,
    "estimatedUnitLabor" REAL,
    "totalLabor" REAL,
    "lineGrossProfit" REAL,
    "lineGrossMargin" REAL,
    "profitAfterLabor" REAL,
    "marginAfterLabor" REAL,
    "frozenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderLineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderLineItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderLineItem_otherMaterialId_fkey" FOREIGN KEY ("otherMaterialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CatalogItemComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kitId" TEXT NOT NULL,
    "componentItemId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogItemComponent_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "CatalogItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatalogItemComponent_componentItemId_fkey" FOREIGN KEY ("componentItemId") REFERENCES "CatalogItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isKit" BOOLEAN NOT NULL DEFAULT false,
    "unitPrice" REAL NOT NULL,
    "otherCostPerUnit" REAL NOT NULL DEFAULT 0,
    "inkCostPerUnit" REAL NOT NULL DEFAULT 0,
    "electricityCostPerUnit" REAL NOT NULL DEFAULT 0,
    "wearCostPerUnit" REAL NOT NULL DEFAULT 0,
    "wasteCostPerUnit" REAL NOT NULL DEFAULT 0,
    "bagCostPerUnit" REAL NOT NULL DEFAULT 0,
    "labelCostPerUnit" REAL NOT NULL DEFAULT 0,
    "laborCostPerUnit" REAL NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CatalogItem" ("createdAt", "description", "id", "isActive", "isKit", "name", "otherCostPerUnit", "unitPrice", "updatedAt") SELECT "createdAt", "description", "id", "isActive", "isKit", "name", "otherCostPerUnit", "unitPrice", "updatedAt" FROM "CatalogItem";
DROP TABLE "CatalogItem";
ALTER TABLE "new_CatalogItem" RENAME TO "CatalogItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
