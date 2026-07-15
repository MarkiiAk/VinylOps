"use client";

import { useState } from "react";
import { Package, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogItemLite } from "./cart-types";

function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

interface AddCatalogItemDialogProps {
  catalogItems: CatalogItemLite[];
  onAdd: (item: { catalogItemId: string; description: string; quantity: number; unitPrice: number }) => void;
}

/**
 * Dialog "Agregar del catálogo": elige un item de precio fijo, cantidad
 * (default 1) y precio editable por si se negocia. El precio viene
 * precargado del catálogo pero se puede ajustar antes de agregar la línea.
 */
export function AddCatalogItemDialog({ catalogItems, onAdd }: AddCatalogItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [catalogItemId, setCatalogItemId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");

  const selected = catalogItems.find((item) => item.id === catalogItemId);
  const parsedQuantity = parseInt(quantity || "0", 10) || 0;
  const parsedUnitPrice = unitPrice === "" ? (selected?.unitPrice ?? 0) : Number(unitPrice) || 0;

  function reset() {
    setCatalogItemId("");
    setQuantity("1");
    setUnitPrice("");
  }

  function handleSelectItem(id: string | null) {
    if (!id) return;
    setCatalogItemId(id);
    const item = catalogItems.find((c) => c.id === id);
    setUnitPrice(item ? String(item.unitPrice) : "");
  }

  function handleAdd() {
    if (!selected || parsedQuantity <= 0) return;
    onAdd({
      catalogItemId: selected.id,
      description: selected.name,
      quantity: parsedQuantity,
      unitPrice: parsedUnitPrice,
    });
    setOpen(false);
    reset();
  }

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
            <Package className="size-4" />
            Agregar del catálogo
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Agregar del catálogo</DialogTitle>
          <DialogDescription>El precio se congela al momento de agregarlo, pero puedes editarlo si negocias.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Producto</Label>
            <Select
              value={catalogItemId || null}
              items={catalogItems.map((item) => ({
                value: item.id,
                label: `${item.name} · ${formatMXN(item.unitPrice)}`,
              }))}
              onValueChange={handleSelectItem}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un producto" />
              </SelectTrigger>
              <SelectContent>
                {catalogItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {formatMXN(item.unitPrice)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="catalog-qty">Cantidad</Label>
              <Input
                id="catalog-qty"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="catalog-price">Precio unitario</Label>
              <Input
                id="catalog-price"
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder={selected ? String(selected.unitPrice) : "0"}
              />
            </div>
          </div>

          {selected ? (
            <p className="text-sm text-muted-foreground">
              Subtotal: <span className="font-medium tabular-nums text-foreground">{formatMXN(parsedQuantity * parsedUnitPrice)}</span>
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" disabled={!selected || parsedQuantity <= 0} onClick={handleAdd} className="gap-1.5">
            <Plus className="size-4" />
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
