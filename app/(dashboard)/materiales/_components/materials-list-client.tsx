"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Archive, ArchiveRestore, ExternalLink, Layers, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { archiveMaterial, unarchiveMaterial } from "@/lib/actions/materials";
import { costPerSheet, hasFixedSheet } from "@/lib/sheet-units";
import { MaterialFilterBar } from "./material-filter-bar";
import { MaterialFormDialog } from "./material-form-dialog";
import { PurchaseForm } from "./purchase-form";
import { useMaterialFilters } from "./use-material-filters";
import type { Material } from "@/lib/generated/prisma/client";

interface MaterialsListClientProps {
  materials: Material[];
}

function formatMXN(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits,
  }).format(value);
}

function formatM2(cm2: number) {
  return `${(cm2 / 10_000).toFixed(2)} m2`;
}

function isLowStock(material: Material) {
  return material.lowStockThresholdCm2 > 0 && material.totalAreaCm2 <= material.lowStockThresholdCm2;
}

function sheetAreaCm2(material: { sheetWidthCm: number; sheetHeightCm: number }) {
  return material.sheetWidthCm * material.sheetHeightCm;
}

/** Hojas disponibles, redondeado a 1 decimal — Marco quiere ver "97 hojas", no un area en cm2/m2. */
function sheetsAvailable(material: Material & { sheetWidthCm: number; sheetHeightCm: number }) {
  return Math.round((material.totalAreaCm2 / sheetAreaCm2(material)) * 10) / 10;
}

function formatSheets(count: number) {
  const rounded = Math.round(count * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} hoja${rounded === 1 ? "" : "s"}`;
}

/**
 * Catalogo + inventario de materiales en una sola pantalla (antes eran dos
 * rutas separadas sobre la misma tabla, distinguidas solo por
 * isInventoryTracked). Cada tarjeta muestra siempre el costo de referencia;
 * si el material lleva inventario real, ademas muestra hojas/area
 * disponible, valor de inventario y alerta de stock bajo, y el boton de
 * accion es "Agregar compra" (repone stock). Si es de costo de referencia
 * (se maquila o se pide bajo demanda, sin stock propio), el boton es
 * "Actualizar costo" (mismo dialog, solo recalcula el promedio ponderado sin
 * sumar stock).
 */
export function MaterialsListClient({ materials }: MaterialsListClientProps) {
  const router = useRouter();
  const filters = useMaterialFilters(materials);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  async function handleArchiveToggle(material: Material) {
    if (!material.isArchived) {
      const confirmed = window.confirm(`Archivar "${material.name}"? Podras verlo de nuevo activando el filtro de archivados.`);
      if (!confirmed) return;
    }
    setArchivingId(material.id);
    try {
      if (material.isArchived) {
        await unarchiveMaterial(material.id);
        toast.success("Material restaurado", { description: material.name });
      } else {
        await archiveMaterial(material.id);
        toast.success("Material archivado", { description: material.name });
      }
      router.refresh();
    } catch (error) {
      toast.error("No se pudo actualizar el material", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <MaterialFilterBar
        search={filters.search}
        onSearchChange={filters.setSearch}
        searchPlaceholder="Buscar material por nombre..."
        category={filters.category}
        onCategoryChange={filters.setCategory}
        categories={filters.categories}
        color={filters.color}
        onColorChange={filters.setColor}
        colors={filters.colors}
        brand={filters.brand}
        onBrandChange={filters.setBrand}
        brands={filters.brands}
        supplier={filters.supplier}
        onSupplierChange={filters.setSupplier}
        suppliers={filters.suppliers}
        showArchived={filters.showArchived}
        onShowArchivedChange={filters.setShowArchived}
      />

      {filters.filtered.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={filters.showArchived ? "No hay materiales archivados" : "No hay materiales que coincidan"}
          description={
            filters.showArchived
              ? "Los materiales que archives apareceran aqui."
              : "Ajusta la busqueda o los filtros, o agrega un material nuevo."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filters.filtered.map((material) => (
            <CatalogMaterialCard
              key={material.id}
              material={material}
              archivingId={archivingId}
              onArchiveToggle={handleArchiveToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogMaterialCard({
  material,
  archivingId,
  onArchiveToggle,
}: {
  material: Material;
  archivingId: string | null;
  onArchiveToggle: (material: Material) => void;
}) {
  return (
    <div className="glass-panel flex flex-col gap-3 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/materiales/${material.id}`}
            className="font-heading text-base font-medium text-foreground hover:text-primary"
          >
            {material.name}
          </Link>
          <p className="text-xs text-muted-foreground">
            {material.category}
            {material.color ? ` · ${material.color}` : ""}
            {material.finish ? ` · ${material.finish}` : ""}
          </p>
        </div>
        {!material.isInventoryTracked ? (
          <Badge variant="outline" className="shrink-0 gap-1 text-muted-foreground">
            Costo de referencia
          </Badge>
        ) : isLowStock(material) ? (
          <Badge className="shrink-0 gap-1 bg-warning/15 text-warning">
            <AlertTriangle className="size-3" />
            Stock bajo
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 gap-1 text-success">
            <Layers className="size-3" />
            OK
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {material.isInventoryTracked ? (
          <>
            <span className="text-muted-foreground">
              {hasFixedSheet(material) ? "Hojas disponibles" : "Area disponible"}
            </span>
            <span className="text-right tabular-nums text-foreground">
              {hasFixedSheet(material)
                ? formatSheets(sheetsAvailable(material as Material & { sheetWidthCm: number; sheetHeightCm: number }))
                : formatM2(material.totalAreaCm2)}
            </span>
            <span className="text-muted-foreground">Valor inventario</span>
            <span className="text-right tabular-nums font-medium text-foreground">
              {formatMXN(material.totalValue)}
            </span>
          </>
        ) : null}
        {hasFixedSheet(material) ? (
          <>
            <span className="text-muted-foreground">Costo / hoja</span>
            <span className="text-right tabular-nums text-foreground">
              {formatMXN(costPerSheet(material.weightedAverageCostPerCm2, material), 2)}
            </span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">Costo / cm2</span>
            <span className="text-right tabular-nums text-foreground">
              {formatMXN(material.weightedAverageCostPerCm2, 4)}
            </span>
            <span className="text-muted-foreground">Costo / m2</span>
            <span className="text-right tabular-nums text-foreground">{formatMXN(material.weightedAverageCostPerM2)}</span>
          </>
        )}
      </div>

      {(material.brand || material.supplierDefault || material.purchaseUrl) && (
        <p className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
          <span>
            {material.brand ? `Marca: ${material.brand}` : ""}
            {material.brand && material.supplierDefault ? " · " : ""}
            {material.supplierDefault ? `Proveedor: ${material.supplierDefault}` : ""}
          </span>
          {material.purchaseUrl ? (
            <a
              href={material.purchaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-primary hover:underline"
              title="Ver link de compra"
            >
              <ExternalLink className="size-3" />
            </a>
          ) : null}
        </p>
      )}

      <div className="mt-1 flex flex-wrap gap-2">
        <MaterialFormDialog
          material={{
            id: material.id,
            name: material.name,
            category: material.category,
            color: material.color,
            finish: material.finish,
            brand: material.brand,
            supplierDefault: material.supplierDefault,
            lowStockThresholdCm2: material.lowStockThresholdCm2,
            isInventoryTracked: material.isInventoryTracked,
            purchaseUrl: material.purchaseUrl,
            sheetWidthCm: material.sheetWidthCm,
            sheetHeightCm: material.sheetHeightCm,
          }}
          trigger={
            <Button size="sm" variant="ghost">
              Editar
            </Button>
          }
        />
        {material.isInventoryTracked ? (
          <PurchaseForm material={material} />
        ) : (
          <PurchaseForm
            material={material}
            trigger={
              <Button size="sm" variant="ghost" className="gap-1.5">
                <RefreshCw className="size-3.5" />
                Actualizar costo
              </Button>
            }
          />
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto gap-1.5 text-muted-foreground"
          disabled={archivingId === material.id}
          onClick={() => onArchiveToggle(material)}
        >
          {material.isArchived ? (
            <>
              <ArchiveRestore className="size-3.5" />
              Restaurar
            </>
          ) : (
            <>
              <Archive className="size-3.5" />
              Archivar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
