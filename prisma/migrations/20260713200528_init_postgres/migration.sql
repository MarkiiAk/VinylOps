-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT,
    "finish" TEXT,
    "brand" TEXT,
    "supplierDefault" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'cm2',
    "totalAreaCm2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weightedAverageCostPerCm2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weightedAverageCostPerM2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lowStockThresholdCm2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isInventoryTracked" BOOLEAN NOT NULL DEFAULT true,
    "sheetWidthCm" DOUBLE PRECISION,
    "sheetHeightCm" DOUBLE PRECISION,
    "purchaseUrl" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplier" TEXT,
    "widthCm" DOUBLE PRECISION NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "grossPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalPrice" DOUBLE PRECISION NOT NULL,
    "totalAreaCm2" DOUBLE PRECISION NOT NULL,
    "costPerCm2" DOUBLE PRECISION NOT NULL,
    "costPerM2" DOUBLE PRECISION NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "interest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Disenando',
    "notes" TEXT,
    "designApprovedAt" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "deliveryDateIsManual" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NonWorkingDay" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NonWorkingDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concept" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "beneficiary" TEXT,
    "notes" TEXT,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,
    "otherMaterialId" TEXT,
    "otherMaterialAreaCm2" DOUBLE PRECISION,
    "unitMaterialCost" DOUBLE PRECISION,
    "unitInkCost" DOUBLE PRECISION,
    "unitElectricityCost" DOUBLE PRECISION,
    "unitWearCost" DOUBLE PRECISION,
    "unitWasteCost" DOUBLE PRECISION,
    "unitBagCost" DOUBLE PRECISION,
    "unitLabelCost" DOUBLE PRECISION,
    "unitDirectCost" DOUBLE PRECISION,
    "totalDirectCost" DOUBLE PRECISION,
    "estimatedUnitLabor" DOUBLE PRECISION,
    "totalLabor" DOUBLE PRECISION,
    "lineGrossProfit" DOUBLE PRECISION,
    "lineGrossMargin" DOUBLE PRECISION,
    "profitAfterLabor" DOUBLE PRECISION,
    "marginAfterLabor" DOUBLE PRECISION,
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryConsumption" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "catalogSaleId" TEXT,
    "materialId" TEXT NOT NULL,
    "areaConsumedCm2" DOUBLE PRECISION NOT NULL,
    "costConsumed" DOUBLE PRECISION NOT NULL,
    "costPerCm2Snapshot" DOUBLE PRECISION NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "InventoryConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isKit" BOOLEAN NOT NULL DEFAULT false,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "otherCostPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "materialCostPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inkCostPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "electricityCostPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wearCostPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wasteCostPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bagCostPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "labelCostPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "laborCostPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItemComponent" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "componentItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogItemComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItemMaterial" (
    "id" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "areaCm2PerUnit" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CatalogItemMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSale" (
    "id" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceSnapshot" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "customerName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Contacto',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "businessName" TEXT NOT NULL DEFAULT 'VinylOps',
    "ownerName" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAccount" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NonWorkingDay_date_key" ON "NonWorkingDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AdminAccount_username_key" ON "AdminAccount"("username");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_otherMaterialId_fkey" FOREIGN KEY ("otherMaterialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryConsumption" ADD CONSTRAINT "InventoryConsumption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryConsumption" ADD CONSTRAINT "InventoryConsumption_catalogSaleId_fkey" FOREIGN KEY ("catalogSaleId") REFERENCES "CatalogSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryConsumption" ADD CONSTRAINT "InventoryConsumption_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemComponent" ADD CONSTRAINT "CatalogItemComponent_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemComponent" ADD CONSTRAINT "CatalogItemComponent_componentItemId_fkey" FOREIGN KEY ("componentItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemMaterial" ADD CONSTRAINT "CatalogItemMaterial_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemMaterial" ADD CONSTRAINT "CatalogItemMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSale" ADD CONSTRAINT "CatalogSale_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
