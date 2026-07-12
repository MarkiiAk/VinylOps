"use client";

import { useEffect, useMemo, useState } from "react";
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
import { createCatalogItem, updateCatalogItem } from "@/lib/actions/catalog";

export interface CatalogMaterialOption {
  id: string;
  name: string;
  sheetWidthCm: number | null;
  sheetHeightCm: number | null;
}

export interface CatalogItemFormValues {
  id: string;
  name: string;
  isKit: boolean;
  unitPrice: number;
  otherCostPerUnit: number;
  description: string | null;
  materials: {
    materialId: string;
    areaCm2PerUnit: number;
  }[];
}

interface CatalogItemFormDialogProps {
  /** Lista completa de materiales (inventario + costo) para armar la receta. */
  materials: CatalogMaterialOption[];
  /** Si se pasa, el dialog opera en modo edición, precargado con su receta actual. */
  item?: CatalogItemFormValues;
  trigger?: React.ReactNode;
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
export function CatalogItemFormDialog({ materials, item, trigger }: CatalogItemFormDialogProps) {
  const router = useRouter();
  const isEdit = !!item;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lines, setLines] = useState<RecipeDraftLine[]>([]);

  // Record id -> nombre para que <Select items={...}> pueda resolver el
  // label del material seleccionado en <SelectValue>. Sin esto, Base UI
  // muestra el value crudo (el id/cuid) en vez del nombre cuando el popup no
  // está montado — ver SelectRoot.d.ts: "When specified, <Select.Value>
  // renders the label of the selected item instead of the raw value."
  const materialItems = useMemo(
    () => Object.fromEntries(materials.map((m) => [m.id, m.name])),
    [materials]
  );

  useEffect(() => {
    if (!open) return;

    if (item) {
      setForm({
        name: item.name,
        isKit: item.isKit,
        unitPrice: String(item.unitPrice),
        otherCostPerUnit: String(item.otherCostPerUnit),
        description: item.description ?? "",
      });
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
    }
  }, [open, item, materials]);

  function addLine() {
    setLines((prev) => [...prev, newDraftLine(materials[0]?.id ?? "")]);
  }

  function removeLine(localId: string) {
    setLines((prev) => prev.filter((l) => l.localId !== localId));
  }

  function updateLine(localId: string, patch: Partial<RecipeDraftLine>) {
    setLines((prev) => prev.map((l) => (l.localId === localId ? { ...l, ...patch } : l)));
  }

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
      const otherCostPerUnit = Number(form.otherCostPerUnit) || 0;
      const recipe = buildRecipe();

      if (isEdit && item) {
        await updateCatalogItem(item.id, {
          name: form.name,
          isKit: form.isKit,
          unitPrice,
          otherCostPerUnit,
          description: form.description,
          recipe,
        });
        toast.success("Producto actualizado", { description: form.name });
      } else {
        await createCatalogItem({
          name: form.name,
          isKit: form.isKit,
          unitPrice,
          otherCostPerUnit,
          description: form.description || undefined,
          recipe,
        });
        toast.success("Producto creado", { description: form.name });
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
    <Dialog open={open} onOpenChange={setOpen}>
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
                <Label htmlFor="catalog-other-cost">Otros costos por unidad</Label>
                <Input
                  id="catalog-other-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.otherCostPerUnit}
                  onChange={(e) => setForm((f) => ({ ...f, otherCostPerUnit: e.target.value }))}
                  placeholder="Tinta, luz, tiempo..."
                />
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
