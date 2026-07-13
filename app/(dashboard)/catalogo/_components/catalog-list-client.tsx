"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Package, PackageOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/empty-state";
import { archiveCatalogItem, unarchiveCatalogItem } from "@/lib/actions/catalog";
import { CatalogItemFormDialog, type CatalogMaterialOption } from "./catalog-item-form-dialog";

export interface CatalogItemRow {
  id: string;
  name: string;
  description: string | null;
  isKit: boolean;
  isActive: boolean;
  unitPrice: number;
  otherCostPerUnit: number;
  materialCostPerUnit: number;
  inkCostPerUnit: number;
  electricityCostPerUnit: number;
  wearCostPerUnit: number;
  wasteCostPerUnit: number;
  bagCostPerUnit: number;
  labelCostPerUnit: number;
  laborCostPerUnit: number;
  productionCost: number;
  margin: number;
  unitDirectCost: number;
  grossProfit: number;
  grossMargin: number;
  profitAfterLabor: number;
  marginAfterLabor: number;
  kitSavings: { equivalentPrice: number; savingsAbsolute: number; savingsPercentage: number } | null;
  kitComponents: { componentItemId: string; quantity: number; componentItem: { name: string; unitPrice: number } }[];
  materials: {
    id: string;
    materialId: string;
    areaCm2PerUnit: number;
    material: {
      name: string;
      supplierDefault: string | null;
      sheetWidthCm: number | null;
      sheetHeightCm: number | null;
    };
  }[];
}

/**
 * Todo en este negocio está estandarizado a hojas de tamaño fijo (carta,
 * 58x25cm, etc.) — Marco no quiere ver cm2 en ningún lado, solo "cuántas
 * hojas". Si el material tiene sheetWidthCm/sheetHeightCm, se muestra en
 * hojas (redondeando a 2 decimales si no es un número entero de hojas);
 * si no, cae de vuelta a cm2 como último recurso.
 */
function formatMaterialQuantity(
  areaCm2PerUnit: number,
  sheetWidthCm: number | null,
  sheetHeightCm: number | null
) {
  if (!sheetWidthCm || !sheetHeightCm) {
    return `${areaCm2PerUnit.toFixed(1)} cm²`;
  }

  const sheetAreaCm2 = sheetWidthCm * sheetHeightCm;
  const sheets = areaCm2PerUnit / sheetAreaCm2;
  const isCarta = Math.abs(sheetWidthCm - 21.6) < 0.05 && Math.abs(sheetHeightCm - 27.9) < 0.05;
  const roundedSheets = Math.round(sheets * 100) / 100;
  const sheetWord = roundedSheets === 1 ? "hoja" : "hojas";
  const descriptor = isCarta ? "tamaño carta" : `de ${sheetWidthCm}x${sheetHeightCm}cm`;
  const sheetsLabel = Number.isInteger(roundedSheets) ? roundedSheets.toString() : roundedSheets.toFixed(2);

  return `${sheetsLabel} ${sheetWord} ${descriptor}`;
}

function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Grid de items de catálogo. Server component (page.tsx) ya trae el
 * costo/margen calculado y la lista completa (activos + archivados); aquí se
 * maneja el expandible de la receta, el toggle "Ver archivados" (filtro en
 * memoria, mismo criterio que MaterialsListClient) y los dialogs de
 * crear/editar/archivar por card.
 */
export function CatalogListClient({
  items,
  materials,
}: {
  items: CatalogItemRow[];
  materials: CatalogMaterialOption[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const filtered = useMemo(
    () => items.filter((item) => (showArchived ? !item.isActive : item.isActive)),
    [items, showArchived]
  );

  async function handleArchiveToggle(item: CatalogItemRow) {
    if (item.isActive) {
      const confirmed = window.confirm(
        `Archivar "${item.name}"? Dejará de aparecer en el catálogo activo, pero podrás verlo con "Ver archivados".`
      );
      if (!confirmed) return;
    }
    setArchivingId(item.id);
    try {
      if (item.isActive) {
        await archiveCatalogItem(item.id);
        toast.success("Producto archivado", { description: item.name });
      } else {
        await unarchiveCatalogItem(item.id);
        toast.success("Producto reactivado", { description: item.name });
      }
      router.refresh();
    } catch (error) {
      toast.error("No se pudo actualizar el producto", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Label htmlFor="catalog-show-archived" className="text-xs text-muted-foreground">
          Ver archivados
        </Label>
        <Switch id="catalog-show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={showArchived ? "No hay productos archivados" : "No hay items de catálogo activos"}
          description={
            showArchived
              ? "Los productos que archives aparecerán aquí."
              : "Los productos de precio fijo (etiquetas, kits) aparecerán aquí."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const expanded = expandedId === item.id;
            return (
              <div key={item.id} className="glass-panel flex flex-col gap-3 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-heading text-base font-medium text-foreground">{item.name}</p>
                    {item.description ? (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    ) : null}
                  </div>
                  {item.isKit ? (
                    <Badge className="shrink-0 gap-1 bg-accent/15 text-accent">
                      <PackageOpen className="size-3" />
                      Kit
                    </Badge>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">Precio</span>
                  <span className="text-right tabular-nums font-medium text-foreground">
                    {formatMXN(item.unitPrice)}
                  </span>
                  <span className="text-muted-foreground">Costo directo</span>
                  <span className="text-right tabular-nums text-foreground">
                    {formatMXN(item.unitDirectCost)}
                  </span>
                  <span className="text-muted-foreground">Ganancia bruta</span>
                  <span className="text-right tabular-nums font-medium text-success">
                    {formatMXN(item.grossProfit)} ({(item.grossMargin * 100).toFixed(0)}%)
                  </span>
                  <span className="text-muted-foreground">Ganancia c/mano de obra</span>
                  <span className="text-right tabular-nums font-medium text-foreground">
                    {formatMXN(item.profitAfterLabor)} ({(item.marginAfterLabor * 100).toFixed(0)}%)
                  </span>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="justify-start gap-1.5 self-start text-xs text-muted-foreground"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                >
                  {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  Qué necesita
                </Button>

                {expanded && item.isKit && item.kitComponents.length > 0 ? (
                  <ul className="space-y-1 rounded-lg bg-muted/40 p-2.5 text-xs">
                    {item.kitComponents.map((c) => (
                      <li key={c.componentItemId} className="flex items-center justify-between gap-2">
                        <span className="text-foreground">{c.componentItem.name}</span>
                        <span className="text-right text-muted-foreground">× {c.quantity}</span>
                      </li>
                    ))}
                    {item.kitSavings ? (
                      <li className="flex items-center justify-between gap-2 border-t border-border pt-1.5 font-medium">
                        <span className="text-foreground">Ahorro vs. comprar separado</span>
                        <span className="text-right text-success">
                          {formatMXN(item.kitSavings.savingsAbsolute)} ({(item.kitSavings.savingsPercentage * 100).toFixed(0)}%)
                        </span>
                      </li>
                    ) : null}
                  </ul>
                ) : null}

                {expanded ? (
                  <ul className="space-y-1 rounded-lg bg-muted/40 p-2.5 text-xs">
                    {item.materials.length === 0 ? (
                      <li className="text-muted-foreground">Sin receta de materiales.</li>
                    ) : (
                      item.materials.map((line) => (
                        <li key={line.id} className="flex items-center justify-between gap-2">
                          <span className="text-foreground">{line.material.name}</span>
                          <span className="text-right text-muted-foreground">
                            {formatMaterialQuantity(
                              line.areaCm2PerUnit,
                              line.material.sheetWidthCm,
                              line.material.sheetHeightCm
                            )}
                            {line.material.supplierDefault ? ` · ${line.material.supplierDefault}` : ""}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}

                <div className="mt-1 flex flex-wrap gap-2">
                  <CatalogItemFormDialog
                    materials={materials}
                    componentOptions={items}
                    item={{
                      id: item.id,
                      name: item.name,
                      isKit: item.isKit,
                      unitPrice: item.unitPrice,
                      otherCostPerUnit: item.otherCostPerUnit,
                      materialCostPerUnit: item.materialCostPerUnit,
                      inkCostPerUnit: item.inkCostPerUnit,
                      electricityCostPerUnit: item.electricityCostPerUnit,
                      wearCostPerUnit: item.wearCostPerUnit,
                      wasteCostPerUnit: item.wasteCostPerUnit,
                      bagCostPerUnit: item.bagCostPerUnit,
                      labelCostPerUnit: item.labelCostPerUnit,
                      laborCostPerUnit: item.laborCostPerUnit,
                      description: item.description,
                      materials: item.materials.map((line) => ({
                        materialId: line.materialId,
                        areaCm2PerUnit: line.areaCm2PerUnit,
                      })),
                      kitComponents: item.kitComponents.map((c) => ({
                        componentItemId: c.componentItemId,
                        quantity: c.quantity,
                      })),
                    }}
                    trigger={
                      <Button size="sm" variant="ghost">
                        Editar
                      </Button>
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto gap-1.5 text-muted-foreground"
                    disabled={archivingId === item.id}
                    onClick={() => handleArchiveToggle(item)}
                  >
                    {item.isActive ? (
                      <>
                        <Archive className="size-3.5" />
                        Archivar
                      </>
                    ) : (
                      <>
                        <ArchiveRestore className="size-3.5" />
                        Reactivar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
