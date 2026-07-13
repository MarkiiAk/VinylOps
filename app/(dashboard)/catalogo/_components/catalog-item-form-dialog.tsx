"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCatalogItem, updateCatalogItem, setKitComponents } from "@/lib/actions/catalog";

export interface CatalogMaterialOption {
  id: string;
  name: string;
  sheetWidthCm: number | null;
  sheetHeightCm: number | null;
}

/** Item de catálogo candidato a componente de un kit (todo lo que no sea el propio kit en edición). */
export interface CatalogComponentOption {
  id: string;
  name: string;
  unitPrice: number;
  isKit: boolean;
}

export interface CatalogItemFormValues {
  id: string;
  name: string;
  isKit: boolean;
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
  description: string | null;
  materials: {
    materialId: string;
    areaCm2PerUnit: number;
  }[];
  kitComponents?: {
    componentItemId: string;
    quantity: number;
  }[];
}

interface CatalogItemFormDialogProps {
  /** Lista completa de materiales (inventario + costo) para armar la receta. */
  materials: CatalogMaterialOption[];
  /** Todo el catálogo activo, para el selector de componentes de kit. */
  componentOptions?: CatalogComponentOption[];
  /** Si se pasa, el dialog opera en modo edición, precargado con su receta actual. */
  item?: CatalogItemFormValues;
  trigger?: React.ReactNode;
}

/** Una línea de componente de kit en edición dentro del formulario. */
interface KitComponentDraftLine {
  localId: string;
  componentItemId: string;
  quantity: string;
}

function newKitComponentLine(componentItemId = ""): KitComponentDraftLine {
  return { localId: crypto.randomUUID(), componentItemId, quantity: "1" };
}

/** Una línea de receta en edición dentro del formulario, antes de convertirla a areaCm2PerUnit. */
interface RecipeDraftLine {
  localId: string;
  materialId: string;
  /** Cantidad tal como la captura el usuario: hojas si el material tiene tamaño fijo, piezas si no. */
  quantity: string;
}

function newDraftLine(materialId = ""): RecipeDraftLine {
  return { localId: crypto.randomUUID(), materialId, quantity: "1" };
}

const emptyForm = {
  name: "",
  isKit: false,
  unitPrice: "",
  otherCostPerUnit: "0",
  materialCostPerUnit: "0",
  inkCostPerUnit: "0",
  electricityCostPerUnit: "0",
  wearCostPerUnit: "0",
  wasteCostPerUnit: "0",
  bagCostPerUnit: "0",
  labelCostPerUnit: "0",
  laborCostPerUnit: "0",
  description: "",
};

/**
 * Dialog reutilizable para crear o editar un item de catálogo (producto/kit
 * de precio fijo), mismo patrón que MaterialFormDialog: estado local, server
 * action, toast, router.refresh(). Incluye el constructor de receta: por
 * cada línea se elige un material y se captura la cantidad en HOJAS (si el
 * material tiene sheetWidthCm/sheetHeightCm) o en PIEZAS (si no, ej. blancos
 * comprados por unidad) — nunca se pide cm2 directo, mismo criterio que
 * seed.ts y add-other-item-dialog.tsx.
 */
export function CatalogItemFormDialog({ materials, componentOptions = [], item, trigger }: CatalogItemFormDialogProps) {
  const router = useRouter();
  const isEdit = !!item;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lines, setLines] = useState<RecipeDraftLine[]>([]);
  const [kitLines, setKitLines] = useState<KitComponentDraftLine[]>([]);

  // Un kit no puede incluirse a sí mismo ni a otro kit (los kits solo
  // combinan productos individuales, ver setKitComponents en catalog.ts).
  const pickableComponents = useMemo(
    () => componentOptions.filter((c) => !c.isKit && c.id !== item?.id),
    [componentOptions, item?.id]
  );
  const componentSelectItems = useMemo(
    () => Object.fromEntries(pickableComponents.map((c) => [c.id, c.name])),
    [pickableComponents]
  );

  // Record id -> nombre para que <Select items={...}> pueda resolver el
  // label del material seleccionado en <SelectValue>. Sin esto, Base UI
  // muestra el value crudo (el id/cuid) en vez del nombre cuando el popup no
  // está montado — ver SelectRoot.d.ts: "When specified, <Select.Value>
  // renders the label of the selected item instead of the raw value."
  const materialItems = useMemo(
    () => Object.fromEntries(materials.map((m) => [m.id, m.name])),
    [materials]
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;

    if (item) {
      setForm({
        name: item.name,
        isKit: item.isKit,
        unitPrice: String(item.unitPrice),
        otherCostPerUnit: String(item.otherCostPerUnit),
        materialCostPerUnit: String(item.materialCostPerUnit),
        inkCostPerUnit: String(item.inkCostPerUnit),
        electricityCostPerUnit: String(item.electricityCostPerUnit),
        wearCostPerUnit: String(item.wearCostPerUnit),
        wasteCostPerUnit: String(item.wasteCostPerUnit),
        bagCostPerUnit: String(item.bagCostPerUnit),
        labelCostPerUnit: String(item.labelCostPerUnit),
        laborCostPerUnit: String(item.laborCostPerUnit),
        description: item.description ?? "",
      });
      setKitLines(
        (item.kitComponents ?? []).map((c) => ({
          localId: crypto.randomUUID(),
          componentItemId: c.componentItemId,
          quantity: String(c.quantity),
        }))
      );
      setLines(
        item.materials.map((line) => {
          const material = materials.find((m) => m.id === line.materialId);
          const hasFixedSheet = Boolean(material?.sheetWidthCm && material?.sheetHeightCm);
          const quantity = hasFixedSheet
            ? line.areaCm2PerUnit / ((material!.sheetWidthCm as number) * (material!.sheetHeightCm as number))
            : line.areaCm2PerUnit;
          return {
            localId: crypto.randomUUID(),
            materialId: line.materialId,
            quantity: String(Math.round(quantity * 100) / 100),
          };
        })
      );
    } else {
      setForm(emptyForm);
      setLines([]);
      setKitLines([]);
    }
  }

  function addLine() {
    setLines((prev) => [...prev, newDraftLine(materials[0]?.id ?? "")]);
  }

  function removeLine(localId: string) {
    setLines((prev) => prev.filter((l) => l.localId !== localId));
  }

  function updateLine(localId: string, patch: Partial<RecipeDraftLine>) {
    setLines((prev) => prev.map((l) => (l.localId === localId ? { ...l, ...patch } : l)));
  }

  function addKitLine() {
    setKitLines((prev) => [...prev, newKitComponentLine(pickableComponents[0]?.id ?? "")]);
  }

  function removeKitLine(localId: string) {
    setKitLines((prev) => prev.filter((l) => l.localId !== localId));
  }

  function updateKitLine(localId: string, patch: Partial<KitComponentDraftLine>) {
    setKitLines((prev) => prev.map((l) => (l.localId === localId ? { ...l, ...patch } : l)));
  }

  function buildKitComponents() {
    return kitLines
      .filter((line) => line.componentItemId && Number(line.quantity) > 0)
      .map((line) => ({ componentItemId: line.componentItemId, quantity: Number(line.quantity) || 0 }));
  }

  const kitEquivalentPrice = pickableComponents.length
    ? buildKitComponents().reduce((sum, c) => {
        const component = pickableComponents.find((p) => p.id === c.componentItemId);
        return sum + (component ? component.unitPrice * c.quantity : 0);
      }, 0)
    : 0;

  function buildRecipe() {
    return lines
      .filter((line) => line.materialId && Number(line.quantity) > 0)
      .map((line) => {
        const material = materials.find((m) => m.id === line.materialId)!;
        const hasFixedSheet = Boolean(material.sheetWidthCm && material.sheetHeightCm);
        const quantity = Number(line.quantity) || 0;
        const areaCm2PerUnit = hasFixedSheet
          ? quantity * (material.sheetWidthCm as number) * (material.sheetHeightCm as number)
          : quantity; // sin hoja fija: "quantity" son piezas, 1 pieza = 1 "areaCm2PerUnit" (mismo truco que seed.ts)
        return { materialId: material.id, areaCm2PerUnit };
      });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const unitPrice = Number(form.unitPrice) || 0;
      const costFields = {
        otherCostPerUnit: Number(form.otherCostPerUnit) || 0,
        materialCostPerUnit: Number(form.materialCostPerUnit) || 0,
        inkCostPerUnit: Number(form.inkCostPerUnit) || 0,
        electricityCostPerUnit: Number(form.electricityCostPerUnit) || 0,
        wearCostPerUnit: Number(form.wearCostPerUnit) || 0,
        wasteCostPerUnit: Number(form.wasteCostPerUnit) || 0,
        bagCostPerUnit: Number(form.bagCostPerUnit) || 0,
        labelCostPerUnit: Number(form.labelCostPerUnit) || 0,
        laborCostPerUnit: Number(form.laborCostPerUnit) || 0,
      };
      // Un kit no edita su receta de materiales a mano: se re-deriva de sus
      // componentes via setKitComponents (ver lib/costing.ts). Por eso solo
      // se manda `recipe` cuando NO es kit.
      const recipe = form.isKit ? undefined : buildRecipe();
      const kitComponents = form.isKit ? buildKitComponents() : undefined;

      let kitId = item?.id;

      if (isEdit && item) {
        await updateCatalogItem(item.id, {
          name: form.name,
          isKit: form.isKit,
          unitPrice,
          ...costFields,
          description: form.description,
          recipe,
        });
        toast.success("Producto actualizado", { description: form.name });
      } else {
        const created = await createCatalogItem({
          name: form.name,
          isKit: form.isKit,
          unitPrice,
          ...costFields,
          description: form.description || undefined,
          recipe: recipe ?? [],
        });
        kitId = created.id;
        toast.success("Producto creado", { description: form.name });
      }

      if (form.isKit && kitId && kitComponents) {
        await setKitComponents(kitId, kitComponents);
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(isEdit ? "No se pudo actualizar el producto" : "No se pudo crear el producto", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button className="gap-1.5">
              <Plus className="size-4" />
              Agregar producto
            </Button>
          )
        }
      />
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar producto" : "Nuevo producto de catálogo"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos y la receta. Guardar reemplaza la receta completa."
              : "Crea un producto o kit de precio fijo. La receta es opcional."}
          </DialogDescription>
        </DialogHeader>

        {/*
          La receta puede crecer con varias líneas y el contenido supera la
          altura de la pantalla. DialogContent normal (grid, sin limite de
          alto) no tiene precedente de scroll en el repo, así que se resuelve
          aquí: el form es flex-col, el bloque de campos hace scroll interno
          (flex-1 overflow-y-auto) y el footer con el botón de guardar queda
          siempre visible y alcanzable, fuera del área scrolleable.
        */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-0.5 py-0.5">
            <div className="space-y-1.5">
              <Label htmlFor="catalog-name">Nombre</Label>
              <Input
                id="catalog-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="catalog-description">Descripción</Label>
              <Textarea
                id="catalog-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Opcional"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="catalog-price">Precio de venta</Label>
                <Input
                  id="catalog-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="catalog-other-cost">Otros costos (legado)</Label>
                <Input
                  id="catalog-other-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.otherCostPerUnit}
                  onChange={(e) => setForm((f) => ({ ...f, otherCostPerUnit: e.target.value }))}
                  placeholder="0"
                />
                <p className="text-[11px] text-muted-foreground">Ya no se usa en el cálculo, solo referencia histórica.</p>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-input p-3">
              <Label>Costos por unidad (desglose)</Label>
              {form.isKit ? (
                <p className="text-xs text-muted-foreground">
                  Material, tinta, luz, desgaste, merma y mano de obra se calculan solos sumando los componentes del
                  kit (abajo) — aquí solo se captura la bolsa y la etiquetita, compartidas una vez por kit.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(
                  [
                    ...(form.isKit
                      ? ([] as const)
                      : ([
                          ["materialCostPerUnit", "Material"],
                          ["inkCostPerUnit", "Tinta"],
                          ["electricityCostPerUnit", "Luz"],
                          ["wearCostPerUnit", "Desgaste"],
                          ["wasteCostPerUnit", "Merma"],
                          ["laborCostPerUnit", "Mano de obra"],
                        ] as const)),
                    ["bagCostPerUnit", form.isKit ? "Bolsa (kit, compartida)" : "Bolsa"],
                    ["labelCostPerUnit", form.isKit ? "Etiquetita (kit, compartida)" : "Etiquetita"],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field} className="space-y-1.5">
                    <Label htmlFor={`catalog-${field}`} className="text-xs text-muted-foreground">
                      {label}
                    </Label>
                    <Input
                      id={`catalog-${field}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={form[field]}
                      onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg border border-input p-3">
              <div className="space-y-0.5">
                <Label htmlFor="catalog-is-kit">¿Es un kit?</Label>
                <p className="text-xs text-muted-foreground">Combina varios productos individuales.</p>
              </div>
              <Switch
                id="catalog-is-kit"
                checked={form.isKit}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isKit: checked }))}
              />
            </div>

            {form.isKit ? (
              <div className="space-y-3 rounded-lg border border-input p-3">
                <div className="flex items-center justify-between">
                  <Label>Componentes del kit</Label>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={addKitLine}>
                    <Plus className="size-3.5" />
                    Agregar componente
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  La receta de materiales se calcula sola a partir de estos componentes — no se edita a mano.
                  La bolsa y la etiquetita del kit se capturan arriba (una sola vez, compartida).
                </p>

                {kitLines.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin componentes todavía.</p>
                ) : (
                  <div className="space-y-3">
                    {kitLines.map((line) => (
                      <div key={line.localId} className="flex items-end gap-2">
                        <div className="flex-1 space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Producto</Label>
                          <Select
                            items={componentSelectItems}
                            value={line.componentItemId || undefined}
                            onValueChange={(value) => updateKitLine(line.localId, { componentItemId: value ?? "" })}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecciona un producto" />
                            </SelectTrigger>
                            <SelectContent>
                              {pickableComponents.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-24 space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Cantidad</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={line.quantity}
                            onChange={(e) => updateKitLine(line.localId, { quantity: e.target.value })}
                          />
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="mb-0.5 shrink-0 text-muted-foreground"
                          onClick={() => removeKitLine(line.localId)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {kitLines.length > 0 ? (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-muted/40 p-2.5 text-xs">
                    <span className="text-muted-foreground">Precio normal equivalente</span>
                    <span className="text-right tabular-nums text-foreground">
                      ${kitEquivalentPrice.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">Ahorro para el cliente</span>
                    <span className="text-right tabular-nums font-medium text-success">
                      ${(kitEquivalentPrice - (Number(form.unitPrice) || 0)).toFixed(2)}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-input p-3">
                <div className="flex items-center justify-between">
                  <Label>Receta (materiales que consume)</Label>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={addLine}>
                    <Plus className="size-3.5" />
                    Agregar línea
                  </Button>
                </div>

                {lines.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sin receta: válido para productos de puro margen de servicio, sin materiales que trackear.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {lines.map((line) => {
                      const material = materials.find((m) => m.id === line.materialId);
                      const hasFixedSheet = Boolean(material?.sheetWidthCm && material?.sheetHeightCm);
                      return (
                        <div key={line.localId} className="flex items-end gap-2">
                          <div className="flex-1 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Material</Label>
                            <Select
                              items={materialItems}
                              value={line.materialId || undefined}
                              onValueChange={(value) => updateLine(line.localId, { materialId: value ?? "" })}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecciona un material" />
                              </SelectTrigger>
                              <SelectContent>
                                {materials.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-28 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                              {hasFixedSheet ? "Hojas" : "Piezas"}
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step={hasFixedSheet ? "0.01" : "1"}
                              value={line.quantity}
                              onChange={(e) => updateLine(line.localId, { quantity: e.target.value })}
                            />
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="mb-0.5 shrink-0 text-muted-foreground"
                            onClick={() => removeLine(line.localId)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditCatalogItemTrigger() {
  return (
    <Button size="sm" variant="ghost" className="gap-1.5">
      <Pencil className="size-3.5" />
      Editar
    </Button>
  );
}
