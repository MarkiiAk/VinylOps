"use client";

import { useState } from "react";
import { Plus, Wand2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MaterialLite } from "./cart-types";

function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

interface AddOtherItemDialogProps {
  materials: MaterialLite[];
  onAdd: (item: {
    description: string;
    quantity: number;
    unitPrice: number;
    otherMaterialId?: string;
    otherMaterialName?: string;
    otherMaterialAreaCm2?: number;
    unitInkCost?: number;
    unitElectricityCost?: number;
    unitWearCost?: number;
    unitWasteCost?: number;
    unitBagCost?: number;
    unitLabelCost?: number;
    estimatedUnitLabor?: number;
  }) => void;
}

const NONE_MATERIAL = "__none__";

const COST_FIELDS = [
  ["unitInkCost", "Tinta"],
  ["unitElectricityCost", "Luz"],
  ["unitWearCost", "Desgaste"],
  ["unitWasteCost", "Merma"],
  ["unitBagCost", "Bolsa"],
  ["unitLabelCost", "Etiquetita"],
  ["estimatedUnitLabor", "Mano de obra"],
] as const;

type CostFieldKey = (typeof COST_FIELDS)[number][0];

/**
 * Dialog "Agregar Otro": trabajo fuera de catálogo, 100% manual — el dueño
 * escribe la descripción y el precio a mano, nunca se invoca el motor de
 * pricing por área/complejidad (lib/pricing queda sin usar aquí a propósito).
 *
 * Opcionalmente declara qué material usó y cuánto, para poder descontar
 * inventario después (no hay receta automática como en catálogo). Si el
 * material tiene tamaño de hoja fijo (sheetWidthCm/sheetHeightCm) se pregunta
 * "¿cuántas hojas?" y se convierte a cm2 internamente — más simple de
 * capturar que pedir área directa. Si no tiene hoja fija, se pide el área en
 * cm2 directamente.
 */
export function AddOtherItemDialog({ materials, onAdd }: AddOtherItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [materialId, setMaterialId] = useState<string>(NONE_MATERIAL);
  const [sheets, setSheets] = useState("1");
  const [manualAreaCm2, setManualAreaCm2] = useState("");
  const [costs, setCosts] = useState<Record<CostFieldKey, string>>({
    unitInkCost: "0",
    unitElectricityCost: "0",
    unitWearCost: "0",
    unitWasteCost: "0",
    unitBagCost: "0",
    unitLabelCost: "0",
    estimatedUnitLabor: "0",
  });

  const selectedMaterial = materials.find((m) => m.id === materialId);
  const hasFixedSheet = Boolean(selectedMaterial?.sheetWidthCm && selectedMaterial?.sheetHeightCm);

  const parsedQuantity = parseInt(quantity || "0", 10) || 0;
  const parsedUnitPrice = Number(unitPrice) || 0;
  const parsedCosts = Object.fromEntries(
    COST_FIELDS.map(([field]) => [field, Number(costs[field]) || 0])
  ) as Record<CostFieldKey, number>;
  const hasAnyDeclaredCost = Boolean(selectedMaterial) || Object.values(parsedCosts).some((v) => v > 0);

  function computeTotalAreaCm2(): number | undefined {
    if (!selectedMaterial) return undefined;
    if (hasFixedSheet) {
      const parsedSheets = Number(sheets) || 0;
      if (parsedSheets <= 0) return undefined;
      return parsedSheets * (selectedMaterial.sheetWidthCm as number) * (selectedMaterial.sheetHeightCm as number);
    }
    const parsedArea = Number(manualAreaCm2) || 0;
    return parsedArea > 0 ? parsedArea : undefined;
  }

  function reset() {
    setDescription("");
    setQuantity("1");
    setUnitPrice("");
    setMaterialId(NONE_MATERIAL);
    setSheets("1");
    setManualAreaCm2("");
    setCosts({
      unitInkCost: "0",
      unitElectricityCost: "0",
      unitWearCost: "0",
      unitWasteCost: "0",
      unitBagCost: "0",
      unitLabelCost: "0",
      estimatedUnitLabor: "0",
    });
  }

  function handleAdd() {
    if (!description.trim() || parsedQuantity <= 0 || parsedUnitPrice < 0) return;

    if (!hasAnyDeclaredCost) {
      const confirmed = window.confirm(
        "No declaraste ningún costo (material, tinta, luz, desgaste, merma, bolsa, etiquetita, mano de obra) para esta línea. Su ganancia se calculará como si costara $0 de producirla. ¿Continuar de todas formas?"
      );
      if (!confirmed) return;
    }

    const totalAreaCm2 = computeTotalAreaCm2();

    onAdd({
      description: description.trim(),
      quantity: parsedQuantity,
      unitPrice: parsedUnitPrice,
      otherMaterialId: selectedMaterial?.id,
      otherMaterialName: selectedMaterial?.name,
      otherMaterialAreaCm2: selectedMaterial ? totalAreaCm2 : undefined,
      ...parsedCosts,
    });
    setOpen(false);
    reset();
  }

  const canAdd = description.trim().length > 0 && parsedQuantity > 0 && unitPrice !== "" && parsedUnitPrice >= 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-1.5">
            <Wand2 className="size-4" />
            Agregar Otro
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Agregar trabajo "Otro"</DialogTitle>
          <DialogDescription>
            Para trabajos fuera del catálogo. El precio lo escribes tú a mano, no se calcula automático.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="other-desc">Descripción</Label>
            <Textarea
              id="other-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Vinil de corte personalizado para playera"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="other-qty">Cantidad</Label>
              <Input
                id="other-qty"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="other-price">Precio (a mano)</Label>
              <Input
                id="other-price"
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1.5 border-t border-border pt-3">
            <Label htmlFor="other-material">Material usado (opcional, para descontar inventario)</Label>
            <Select
              value={materialId}
              onValueChange={(value) => {
                setMaterialId(value ?? NONE_MATERIAL);
                setSheets("1");
                setManualAreaCm2("");
              }}
            >
              <SelectTrigger id="other-material" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_MATERIAL}>Ninguno</SelectItem>
                {materials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMaterial ? (
            hasFixedSheet ? (
              <div className="space-y-1.5">
                <Label htmlFor="other-sheets">
                  ¿Cuántas hojas ({selectedMaterial.sheetWidthCm}x{selectedMaterial.sheetHeightCm}cm) en total?
                </Label>
                <Input
                  id="other-sheets"
                  type="number"
                  min="0"
                  step="0.5"
                  value={sheets}
                  onChange={(e) => setSheets(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="other-area">Área total usada (cm²)</Label>
                <Input
                  id="other-area"
                  type="number"
                  min="0"
                  step="1"
                  value={manualAreaCm2}
                  onChange={(e) => setManualAreaCm2(e.target.value)}
                />
              </div>
            )
          ) : null}

          <div className="space-y-1.5 border-t border-border pt-3">
            <Label className="text-xs text-muted-foreground">Costos por unidad (opcional, para calcular ganancia)</Label>
            <div className="grid grid-cols-2 gap-2">
              {COST_FIELDS.map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <Label htmlFor={`other-${field}`} className="text-xs text-muted-foreground">
                    {label}
                  </Label>
                  <Input
                    id={`other-${field}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={costs[field]}
                    onChange={(e) => setCosts((c) => ({ ...c, [field]: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            {!hasAnyDeclaredCost ? (
              <p className="text-xs text-amber-500">
                Sin costos declarados: la ganancia de esta línea se verá como si costara $0.
              </p>
            ) : null}
          </div>

          {parsedQuantity > 0 && parsedUnitPrice >= 0 ? (
            <p className="text-sm text-muted-foreground">
              Subtotal: <span className="font-medium tabular-nums text-foreground">{formatMXN(parsedQuantity * parsedUnitPrice)}</span>
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" disabled={!canAdd} onClick={handleAdd} className="gap-1.5">
            <Plus className="size-4" />
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
