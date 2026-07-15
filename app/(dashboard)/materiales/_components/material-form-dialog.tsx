"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
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
import { createMaterial, updateMaterial } from "@/lib/actions/materials";

const CATEGORIES = ["Vinyl", "Transfer", "HTV", "Cardstock", "StickerPaper", "Other"];

export interface MaterialFormValues {
  id: string;
  name: string;
  category: string;
  color: string | null;
  finish: string | null;
  brand: string | null;
  supplierDefault: string | null;
  lowStockThresholdCm2: number;
  isInventoryTracked: boolean;
  purchaseUrl: string | null;
  sheetWidthCm: number | null;
  sheetHeightCm: number | null;
  unit: string;
}

interface MaterialFormDialogProps {
  /** Si se pasa, el dialog opera en modo edicion (sin poder cambiar la categoria). */
  material?: MaterialFormValues;
  trigger?: React.ReactNode;
}

const emptyForm = {
  name: "",
  category: CATEGORIES[0],
  color: "",
  finish: "",
  brand: "",
  supplierDefault: "",
  lowStockThresholdCm2: "0",
  isInventoryTracked: true,
  purchaseUrl: "",
  isSoldBySheet: false,
  sheetWidthCm: "",
  sheetHeightCm: "",
  isPieceUnit: false,
};

function buildFormState(material: MaterialFormValues | undefined) {
  if (!material) return emptyForm;
  return {
    name: material.name,
    category: material.category,
    color: material.color ?? "",
    finish: material.finish ?? "",
    brand: material.brand ?? "",
    supplierDefault: material.supplierDefault ?? "",
    lowStockThresholdCm2: String(material.lowStockThresholdCm2 ?? 0),
    isInventoryTracked: material.isInventoryTracked ?? true,
    purchaseUrl: material.purchaseUrl ?? "",
    isSoldBySheet: material.sheetWidthCm != null && material.sheetHeightCm != null,
    sheetWidthCm: material.sheetWidthCm != null ? String(material.sheetWidthCm) : "",
    sheetHeightCm: material.sheetHeightCm != null ? String(material.sheetHeightCm) : "",
    isPieceUnit: material.unit === "pieza",
  };
}

/**
 * Dialog reutilizable para crear o editar un material. La categoria solo se
 * puede definir al crear — en edicion se deja fija porque cambiar la
 * categoria de un material con historial de compras/usos es una decision de
 * arquitectura, no un ajuste de formulario (ver materials.ts: UpdateMaterialInput
 * no incluye category).
 */
export function MaterialFormDialog({ material, trigger }: MaterialFormDialogProps) {
  const router = useRouter();
  const isEdit = !!material;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setForm(buildFormState(material));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const lowStockThresholdCm2 = parseFloat(form.lowStockThresholdCm2 || "0") || 0;
      const sheetWidthCm =
        form.isSoldBySheet && !form.isPieceUnit ? parseFloat(form.sheetWidthCm || "0") || undefined : undefined;
      const sheetHeightCm =
        form.isSoldBySheet && !form.isPieceUnit ? parseFloat(form.sheetHeightCm || "0") || undefined : undefined;
      const unit = form.isPieceUnit ? "pieza" : "cm2";

      if (isEdit && material) {
        await updateMaterial(material.id, {
          name: form.name,
          color: form.color,
          finish: form.finish,
          brand: form.brand,
          supplierDefault: form.supplierDefault,
          lowStockThresholdCm2,
          isInventoryTracked: form.isInventoryTracked,
          purchaseUrl: form.purchaseUrl,
          sheetWidthCm: sheetWidthCm ?? null,
          sheetHeightCm: sheetHeightCm ?? null,
          unit,
        });
        toast.success("Material actualizado", { description: form.name });
      } else {
        await createMaterial({
          name: form.name,
          category: form.category,
          color: form.color || undefined,
          finish: form.finish || undefined,
          brand: form.brand || undefined,
          supplierDefault: form.supplierDefault || undefined,
          lowStockThresholdCm2,
          isInventoryTracked: form.isInventoryTracked,
          purchaseUrl: form.purchaseUrl || undefined,
          sheetWidthCm,
          sheetHeightCm,
          unit,
        });
        toast.success("Material creado", { description: form.name });
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(isEdit ? "No se pudo actualizar el material" : "No se pudo crear el material", {
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
              Agregar material
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar material" : "Nuevo material"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Actualiza los datos descriptivos. El costo e inventario se mueven solo con compras."
              : "Crea un material nuevo. Se agrega con inventario en cero — registra una compra para darle stock."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="material-name">Nombre</Label>
            <Input
              id="material-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          {!isEdit ? (
            <div className="space-y-1.5">
              <Label htmlFor="material-category">Categoria</Label>
              <select
                id="material-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-popover text-popover-foreground">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="material-color">Color</Label>
              <Input
                id="material-color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material-finish">Acabado</Label>
              <Input
                id="material-finish"
                value={form.finish}
                onChange={(e) => setForm((f) => ({ ...f, finish: e.target.value }))}
                placeholder="Glossy, Matte..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="material-brand">Marca</Label>
              <Input
                id="material-brand"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material-supplier">Proveedor por defecto</Label>
              <Input
                id="material-supplier"
                value={form.supplierDefault}
                onChange={(e) => setForm((f) => ({ ...f, supplierDefault: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-input p-3">
            <div className="space-y-0.5">
              <Label htmlFor="material-inventory-tracked">¿Es inventario que se va gastando?</Label>
              <p className="text-xs text-muted-foreground">
                Desactiva si es solo costo de referencia (maquilado o pedido bajo demanda) — no dispara alertas de
                stock bajo.
              </p>
            </div>
            <Switch
              id="material-inventory-tracked"
              checked={form.isInventoryTracked}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, isInventoryTracked: checked }))}
            />
          </div>

          {form.isInventoryTracked ? (
            <div className="space-y-1.5">
              <Label htmlFor="material-threshold">Umbral de stock bajo (cm2)</Label>
              <Input
                id="material-threshold"
                type="number"
                min="0"
                step="1"
                value={form.lowStockThresholdCm2}
                onChange={(e) => setForm((f) => ({ ...f, lowStockThresholdCm2: e.target.value }))}
                placeholder="0 = sin alerta"
              />
            </div>
          ) : null}

          <div className="space-y-3 rounded-lg border border-input p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="material-sold-by-sheet">¿Se vende por hoja de tamaño fijo?</Label>
                <p className="text-xs text-muted-foreground">
                  Ej. papel fotográfico o vinil imprimible en hojas carta. Si activas esto, el inventario se muestra
                  en &quot;hojas disponibles&quot; en vez de área (cm2/m2).
                </p>
              </div>
              <Switch
                id="material-sold-by-sheet"
                checked={form.isSoldBySheet}
                disabled={form.isPieceUnit}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isSoldBySheet: checked }))}
              />
            </div>

            {form.isSoldBySheet && !form.isPieceUnit ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="material-sheet-width">Ancho de hoja (cm)</Label>
                  <Input
                    id="material-sheet-width"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.sheetWidthCm}
                    onChange={(e) => setForm((f) => ({ ...f, sheetWidthCm: e.target.value }))}
                    placeholder="21.6"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="material-sheet-height">Alto de hoja (cm)</Label>
                  <Input
                    id="material-sheet-height"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.sheetHeightCm}
                    onChange={(e) => setForm((f) => ({ ...f, sheetHeightCm: e.target.value }))}
                    placeholder="27.9"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-input p-3">
            <div className="space-y-0.5">
              <Label htmlFor="material-piece-unit">¿Se compra/vende por pieza?</Label>
              <p className="text-xs text-muted-foreground">
                Ej. bolsas de Pringles para reempaquetar, tags de acrílico. No se mide por área ni por hoja — se
                cuenta directo (compras 40 piezas, vendes 1, quedan 39).
              </p>
            </div>
            <Switch
              id="material-piece-unit"
              checked={form.isPieceUnit}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, isPieceUnit: checked, isSoldBySheet: checked ? false : f.isSoldBySheet }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="material-purchase-url">Link de compra (opcional)</Label>
            <Input
              id="material-purchase-url"
              type="url"
              value={form.purchaseUrl}
              onChange={(e) => setForm((f) => ({ ...f, purchaseUrl: e.target.value }))}
              placeholder="https://articulo.mercadolibre.com.mx/..."
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear material"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditMaterialTrigger() {
  return (
    <Button size="sm" variant="outline" className="gap-1.5">
      <Pencil className="size-3.5" />
      Editar material
    </Button>
  );
}
