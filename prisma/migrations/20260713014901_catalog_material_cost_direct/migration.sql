-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isKit" BOOLEAN NOT NULL DEFAULT false,
    "unitPrice" REAL NOT NULL,
    "otherCostPerUnit" REAL NOT NULL DEFAULT 0,
    "materialCostPerUnit" REAL NOT NULL DEFAULT 0,
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
INSERT INTO "new_CatalogItem" ("bagCostPerUnit", "createdAt", "description", "electricityCostPerUnit", "id", "inkCostPerUnit", "isActive", "isKit", "labelCostPerUnit", "laborCostPerUnit", "name", "otherCostPerUnit", "unitPrice", "updatedAt", "wasteCostPerUnit", "wearCostPerUnit") SELECT "bagCostPerUnit", "createdAt", "description", "electricityCostPerUnit", "id", "inkCostPerUnit", "isActive", "isKit", "labelCostPerUnit", "laborCostPerUnit", "name", "otherCostPerUnit", "unitPrice", "updatedAt", "wasteCostPerUnit", "wearCostPerUnit" FROM "CatalogItem";
DROP TABLE "CatalogItem";
ALTER TABLE "new_CatalogItem" RENAME TO "CatalogItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
