"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
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
import { createPurchase } from "@/lib/actions/purchases";
import { calculateAreaCm2, calculatePurchaseCostPerCm2, calculateWeightedAverageCost } from "@/lib/pricing";

interface MaterialForPurchase {
  id: string;
  name: string;
  supplierDefault: string | null;
  totalAreaCm2: number;
  totalValue: number;
  weightedAverageCostPerCm2: number;
  isInventoryTracked?: boolean;
}

interface PurchaseFormProps {
  material: MaterialForPurchase;
  trigger?: React.ReactNode;
}

function formatMXN(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits,
  }).format(value);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Dialog reutilizable para registrar una compra de material. Se usa tanto
 * desde el listado (`/materiales`) como desde el detalle (`/materiales/[id]`),
 * por eso recibe el material completo como prop en vez de cargarlo el mismo.
 *
 * El calculo en vivo se hace client-side con las mismas funciones puras de
 * lib/pricing que usa el server (`createPurchase`), para no depender de una
 * ida y vuelta al servidor en cada tecla — evita el round-trip de
 * `previewPurchase` (que sí golpea la DB) ya que aqui tenemos los acumulados
 * del material disponibles de entrada.
 */
export function PurchaseForm({ material, trigger }: PurchaseFormProps) {
  const router = useRouter();
  const isCostOnly = material.isInventoryTracked === false;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [supplier, setSupplier] = useState(material.supplierDefault ?? "");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [grossPrice, setGrossPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [purchaseDate, setPurchaseDate] = useState(todayInputValue());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setSupplier(material.supplierDefault ?? "");
      setWidthCm("");
      setHeightCm("");
      setQuantity("1");
      setGrossPrice("");
      setDiscount("0");
      setPurchaseDate(todayInputValue());
      setNotes("");
    }
  }, [open, material.supplierDefault]);

  const width = parseFloat(widthCm);
  const height = parseFloat(heightCm);
  const qty = parseFloat(quantity);
  const gross = parseFloat(grossPrice);
  const disc = parseFloat(discount || "0");

  const validationError = useMemo(() => {
    if (!widthCm || !heightCm || !quantity || !grossPrice) return null; // aun no llena el form, no mostramos error todavia
    if (!(width > 0) || !(height > 0)) return "El ancho y el alto deben ser mayores a cero.";
    if (!(qty > 0)) return "La cantidad debe ser mayor a cero.";
    if (!(gross > 0)) return "El precio bruto debe ser mayor a cero.";
    if (disc < 0) return "El descuento no puede ser negativo.";
    if (disc > gross) return "El descuento no puede ser mayor al precio bruto.";
    return null;
  }, [width, height, qty, gross, disc, widthCm, heightCm, quantity, grossPrice]);

  const preview = useMemo(() => {
    if (!(width > 0) || !(height > 0) || !(qty > 0) || !(gross > 0) || disc > gross || disc < 0) {
      return null;
    }
    const areaPerUnit = calculateAreaCm2(width, height, 1);
    const totalAreaCm2 = calculateAreaCm2(width, height, qty);
    const finalPrice = gross - disc;
    const costPerCm2 = calculatePurchaseCostPerCm2(finalPrice, totalAreaCm2);
    const costPerM2 = costPerCm2 * 10_000;
    const weighted = calculateWeightedAverageCost(material.totalAreaCm2, material.totalValue, totalAreaCm2, finalPrice);

    return {
      areaPerUnit,
      totalAreaCm2,
      finalPrice,
      costPerCm2,
      costPerM2,
      projectedWeightedAverageCostPerCm2: weighted.newWeightedAverageCostPerCm2,
    };
  }, [width, height, qty, gross, disc, material.totalAreaCm2, material.totalValue]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validationError || !preview) return;

    setSubmitting(true);
    try {
      await createPurchase({
        materialId: material.id,
        widthCm: width,
        heightCm: height,
        quantity: qty,
        grossPrice: gross,
        discount: disc,
        supplier: supplier.trim() || undefined,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Compra registrada", {
        description: `${material.name}: costo promedio actualizado a ${formatMXN(preview.projectedWeightedAverageCostPerCm2 * 10_000)}/m2.`,
      });
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error("No se pudo registrar la compra", {
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
            <Button size="sm" variant="outline" className="gap-1.5">
              <ShoppingCart className="size-3.5" />
              Agregar compra
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isCostOnly ? "Actualizar costo" : "Agregar compra"} — {material.name}</DialogTitle>
          <DialogDescription>
            {isCostOnly
              ? "Este material no lleva inventario (se maquila o se pide bajo demanda). Registra el precio de la ultima remesa para recalcular el costo promedio ponderado — no suma stock disponible."
              : "Registra una compra nueva. El costo promedio ponderado del material se recalcula automaticamente."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="purchase-supplier">Proveedor</Label>
            <Input
              id="purchase-supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="purchase-width">Ancho (cm)</Label>
              <Input
                id="purchase-width"
                type="number"
                min="0"
                step="0.1"
                value={widthCm}
                onChange={(e) => setWidthCm(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purchase-height">Alto (cm)</Label>
              <Input
                id="purchase-height"
                type="number"
                min="0"
                step="0.1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="purchase-quantity">Cantidad</Label>
            <Input
              id="purchase-quantity"
              type="number"
              min="0"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="purchase-gross">Precio bruto</Label>
              <Input
                id="purchase-gross"
                type="number"
                min="0"
                step="0.01"
                value={grossPrice}
                onChange={(e) => setGrossPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purchase-discount">Descuento</Label>
              <Input
                id="purchase-discount"
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="purchase-date">Fecha</Label>
            <Input
              id="purchase-date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="purchase-notes">Notas</Label>
            <Textarea
              id="purchase-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              rows={2}
            />
          </div>

          {validationError ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{validationError}</p>
          ) : preview ? (
            <div className="space-y-2 rounded-lg bg-muted/50 px-3 py-2.5 text-xs">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                <span>Area por unidad</span>
                <span className="text-right tabular-nums text-foreground">
                  {preview.areaPerUnit.toFixed(1)} cm2
                </span>
                <span>Area total comprada</span>
                <span className="text-right tabular-nums text-foreground">
                  {preview.totalAreaCm2.toFixed(1)} cm2
                </span>
                <span>Precio final</span>
                <span className="text-right tabular-nums text-foreground">{formatMXN(preview.finalPrice)}</span>
                <span>Costo / cm2</span>
                <span className="text-right tabular-nums text-foreground">
                  {formatMXN(preview.costPerCm2, 4)}
                </span>
                <span>Costo / m2</span>
                <span className="text-right tabular-nums text-foreground">{formatMXN(preview.costPerM2)}</span>
              </div>
              <p className="border-t border-border pt-2 font-medium text-primary">
                Despues de esta compra, tu costo promedio de este material cambiara de{" "}
                {formatMXN(material.weightedAverageCostPerCm2, 4)} a{" "}
                {formatMXN(preview.projectedWeightedAverageCostPerCm2, 4)} por cm2.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={submitting || !preview || !!validationError}>
              {submitting ? "Guardando..." : isCostOnly ? "Actualizar costo" : "Registrar compra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
