"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Archive, ArchiveRestore, Layers, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { archiveMaterial, unarchiveMaterial } from "@/lib/actions/materials";
import { MaterialFilterBar } from "../../materiales/_components/material-filter-bar";
import { PurchaseForm } from "../../materiales/_components/purchase-form";
import { useMaterialFilters } from "../../materiales/_components/use-material-filters";
import type { Material } from "@/lib/generated/prisma/client";

interface InventoryListClientProps {
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

/** Material "de hoja" (papel/vinil imprimible en hojas de tamaño fijo, ej. carta) en vez de rollo por area. */
function isSheetMaterial(material: Material): material is Material & { sheetWidthCm: number; sheetHeightCm: number } {
  return material.sheetWidthCm != null && material.sheetHeightCm != null && material.sheetWidthCm > 0 && material.sheetHeightCm > 0;
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
 * Listado de inventario real: solo materiales con isInventoryTracked=true.
 * A diferencia del catalogo de /materiales, aqui SI se muestran area
 * disponible, valor de inventario y alerta de stock bajo, y "Agregar compra"
 * es la accion principal (repone stock real).
 *
 * La pagina (Server Component) ya filtra por isInventoryTracked=true antes
 * de pasar los materiales aqui, asi que este componente no necesita
 * volver a filtrar por ese campo.
 */
export function InventoryListClient({ materials }: InventoryListClientProps) {
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
        searchPlaceholder="Buscar en inventario por nombre..."
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
          icon={Package}
          title={filters.showArchived ? "No hay materiales archivados" : "No hay materiales en inventario"}
          description={
            filters.showArchived
              ? "Los materiales que archives apareceran aqui."
              : "Ajusta la busqueda o los filtros, o agrega un material con inventario desde el catalogo de Materiales."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filters.filtered.map((material) => (
            <InventoryMaterialCard
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

function InventoryMaterialCard({
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
        {isLowStock(material) ? (
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
        {isSheetMaterial(material) ? (
          <>
            <span className="text-muted-foreground">Hojas disponibles</span>
            <span className="text-right tabular-nums text-foreground">{formatSheets(sheetsAvailable(material))}</span>
            <span className="text-muted-foreground">Valor inventario</span>
            <span className="text-right tabular-nums font-medium text-foreground">
              {formatMXN(material.totalValue)}
            </span>
            <span className="text-muted-foreground">Costo / hoja</span>
            <span className="text-right tabular-nums text-foreground">
              {formatMXN(material.weightedAverageCostPerCm2 * sheetAreaCm2(material), 2)}
            </span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">Area disponible</span>
            <span className="text-right tabular-nums text-foreground">{formatM2(material.totalAreaCm2)}</span>
            <span className="text-muted-foreground">Valor inventario</span>
            <span className="text-right tabular-nums font-medium text-foreground">
              {formatMXN(material.totalValue)}
            </span>
            <span className="text-muted-foreground">Costo / cm2</span>
            <span className="text-right tabular-nums text-foreground">
              {formatMXN(material.weightedAverageCostPerCm2, 4)}
            </span>
            <span className="text-muted-foreground">Costo / m2</span>
            <span className="text-right tabular-nums text-foreground">
              {formatMXN(material.weightedAverageCostPerM2)}
            </span>
          </>
        )}
      </div>

      <div className="mt-1 flex flex-wrap gap-2">
        <PurchaseForm material={material} />
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
