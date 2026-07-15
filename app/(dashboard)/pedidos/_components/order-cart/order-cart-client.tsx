"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, ShoppingCart, Trash2 } from "lucide-react";
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
import { EmptyState } from "@/components/empty-state";
import { createOrder } from "@/lib/actions/orders";
import { AddCatalogItemDialog } from "./add-catalog-item-dialog";
import { AddOtherItemDialog } from "./add-other-item-dialog";
import { lineTotal, type CartLine, type CatalogItemLite, type MaterialLite } from "./cart-types";

function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

export interface LeadOption {
  id: string;
  name: string | null;
  phone: string | null;
}

interface OrderCartClientProps {
  /** Si se pasa, el lead viene fijo (ruta /leads/[id]/nuevo-pedido) y no se muestra selector. */
  leadId?: string;
  /** Requerido cuando NO se pasa leadId (ruta /pedidos/nuevo) — lista de leads reales para elegir uno, tipado fuerte: no se puede crear un pedido sin ligarlo a un lead existente. */
  leads?: LeadOption[];
  catalogItems: CatalogItemLite[];
  materials: MaterialLite[];
}

/**
 * Orquestador del carrito de "Nuevo pedido". Puede venir con el lead ya fijo
 * (desde /leads/[id]/nuevo-pedido) o con un selector de lead existente
 * (desde /pedidos/nuevo) — nunca permite crear un pedido sin un lead real
 * detrás, ver handleSave. Estado 100% local hasta guardar: se arma la lista
 * de líneas (catálogo y/o "Otro"), se describe qué se está vendiendo/
 * trabajando (interest) y al guardar se manda todo de una sola vez a
 * createOrder.
 */
export function OrderCartClient({ leadId: fixedLeadId, leads, catalogItems, materials }: OrderCartClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>(undefined);
  const [interest, setInterest] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);

  const leadId = fixedLeadId ?? selectedLeadId;
  const leadOptions = leads?.map((lead) => ({
    value: lead.id,
    label: [lead.name || "Sin nombre", lead.phone].filter(Boolean).join(" · "),
  }));

  const total = useMemo(() => lines.reduce((sum, line) => sum + lineTotal(line), 0), [lines]);

  function addLine(line: Omit<CartLine, "localId">) {
    setLines((prev) => [...prev, { ...line, localId: crypto.randomUUID() }]);
  }

  function removeLine(localId: string) {
    setLines((prev) => prev.filter((line) => line.localId !== localId));
  }

  function handleSave() {
    if (!leadId) {
      toast.error("Selecciona a qué lead pertenece este pedido");
      return;
    }
    if (!interest.trim()) {
      toast.error("Describe qué se está vendiendo/trabajando en este pedido");
      return;
    }
    if (lines.length === 0) {
      toast.error("Agrega al menos una línea al pedido");
      return;
    }

    startTransition(async () => {
      try {
        const order = await createOrder({
          leadId,
          interest: interest.trim(),
          notes: notes || undefined,
          deliveryDate: deliveryDate ? new Date(`${deliveryDate}T12:00:00`) : undefined,
          lineItems: lines.map((line) => ({
            catalogItemId: line.catalogItemId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            otherMaterialId: line.otherMaterialId,
            otherMaterialAreaCm2: line.otherMaterialAreaCm2,
            unitInkCost: line.unitInkCost,
            unitElectricityCost: line.unitElectricityCost,
            unitWearCost: line.unitWearCost,
            unitWasteCost: line.unitWasteCost,
            unitBagCost: line.unitBagCost,
            unitLabelCost: line.unitLabelCost,
            estimatedUnitLabor: line.estimatedUnitLabor,
          })),
        });

        toast.success("Pedido creado");
        router.push(fixedLeadId ? `/leads/${fixedLeadId}?order=${order.id}` : `/pedidos/${order.id}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar el pedido");
      }
    });
  }

  return (
    <div className="grid gap-6 pb-28 lg:grid-cols-[1fr_380px] lg:pb-0">
      <div className="space-y-6">
        <section className="glass-panel space-y-4 rounded-2xl p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">Este pedido</h2>

          {!fixedLeadId ? (
            <div className="space-y-1.5">
              <Label htmlFor="order-lead">Lead</Label>
              <Select value={selectedLeadId ?? null} items={leadOptions} onValueChange={(value) => setSelectedLeadId(value ?? undefined)}>
                <SelectTrigger id="order-lead" className="w-full">
                  <SelectValue placeholder="Selecciona un lead existente" />
                </SelectTrigger>
                <SelectContent>
                  {leads?.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {[lead.name || "Sin nombre", lead.phone].filter(Boolean).join(" · ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Todo pedido debe estar ligado a un lead ya existente — si es un cliente nuevo, créalo primero desde
                Leads.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="order-interest">¿Qué se está vendiendo/trabajando?</Label>
            <Textarea
              id="order-interest"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder="Ej. 2 identificadores rectangulares 11x6cm"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="order-delivery-date">Fecha de entrega</Label>
            <Input
              id="order-delivery-date"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full sm:w-56"
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">Líneas</h2>
            <div className="flex gap-2">
              <AddCatalogItemDialog catalogItems={catalogItems} onAdd={addLine} />
              <AddOtherItemDialog materials={materials} onAdd={addLine} />
            </div>
          </div>

          {lines.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="El carrito está vacío"
              description="Agrega productos del catálogo o un trabajo 'Otro' para empezar."
            />
          ) : (
            <div className="glass-panel divide-y divide-border rounded-xl">
              {lines.map((line) => (
                <div key={line.localId} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium text-foreground">{line.description}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {line.quantity} x {formatMXN(line.unitPrice)}
                      {line.catalogItemId ? " · Catálogo" : " · Otro"}
                      {line.otherMaterialName ? ` · ${line.otherMaterialName}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                    {formatMXN(lineTotal(line))}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeLine(line.localId)}
                    title="Quitar línea"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass-panel space-y-2 rounded-2xl p-5">
          <Label htmlFor="order-notes">Notas internas</Label>
          <textarea
            id="order-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional"
            rows={3}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </section>
      </div>

      {/* Desktop: panel fijo a la derecha. Mobile: sticky arriba de la nav inferior. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 p-4 backdrop-blur-lg lg:sticky lg:top-6 lg:inset-x-auto lg:bottom-auto lg:z-auto lg:h-fit lg:border-t-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total</span>
            <span className="font-heading text-2xl font-semibold tabular-nums text-foreground">
              {formatMXN(total)}
            </span>
          </div>

          <div className="mt-5 flex gap-2 border-t border-border pt-4">
            <Button
              type="button"
              className="flex-1 gap-1.5 bg-neon-pink text-background hover:bg-neon-pink/90"
              disabled={isPending || !leadId}
              onClick={handleSave}
            >
              <Save className="size-4" />
              Guardar pedido
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
