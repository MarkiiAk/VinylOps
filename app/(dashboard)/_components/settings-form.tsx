"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Percent, Ruler, Moon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSettings, type UpdateSettingsInput } from "@/lib/actions/settings";

export interface SettingsFormValues {
  id: string;
  currency: string;
  defaultComplexityFactor: number;
  defaultMinimumPricePerPiece: number;
  defaultMinimumJobPrice: number;
  defaultWastePercentage: number;
  premiumMultiplier: number;
  minimumAcceptableMultiplier: number;
  roundingRule: string;
  businessName: string;
  ownerName: string | null;
  theme: string;
}

const ROUNDING_OPTIONS = [
  { value: "nearest10", label: "Multiplo de 10" },
  { value: "nearest50", label: "Multiplo de 50" },
  { value: "none", label: "Sin redondeo" },
];

function toFormState(settings: SettingsFormValues) {
  return {
    businessName: settings.businessName,
    ownerName: settings.ownerName ?? "",
    defaultComplexityFactor: String(settings.defaultComplexityFactor),
    defaultWastePercentage: String(settings.defaultWastePercentage),
    minimumAcceptableMultiplier: String(settings.minimumAcceptableMultiplier),
    premiumMultiplier: String(settings.premiumMultiplier),
    defaultMinimumPricePerPiece: String(settings.defaultMinimumPricePerPiece),
    defaultMinimumJobPrice: String(settings.defaultMinimumJobPrice),
    roundingRule: settings.roundingRule,
  };
}

/**
 * Formulario de configuracion global. currency se muestra fijo (MXN, unica
 * moneda soportada por ahora) y theme como toggle documentado: la app corre
 * siempre en dark mode (ver ARCHITECTURE.md #6), asi que el switch queda
 * deshabilitado y encendido, sin persistir un valor distinto todavia.
 */
export function SettingsForm({ settings }: { settings: SettingsFormValues }) {
  const [form, setForm] = useState(toFormState(settings));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): { input: UpdateSettingsInput } | { error: string } {
    const complexity = Number(form.defaultComplexityFactor);
    const waste = Number(form.defaultWastePercentage);
    const minMultiplier = Number(form.minimumAcceptableMultiplier);
    const premiumMultiplier = Number(form.premiumMultiplier);
    const minPiece = Number(form.defaultMinimumPricePerPiece);
    const minJob = Number(form.defaultMinimumJobPrice);

    if (!form.businessName.trim()) return { error: "El nombre del negocio no puede quedar vacio" };
    if (Number.isNaN(complexity) || complexity <= 0) return { error: "El factor de complejidad debe ser mayor a cero" };
    if (Number.isNaN(waste) || waste < 0) return { error: "El desperdicio no puede ser negativo" };
    if (Number.isNaN(minMultiplier) || minMultiplier <= 0 || minMultiplier >= 1)
      return { error: "El multiplicador minimo aceptable debe estar entre 0 y 1" };
    if (Number.isNaN(premiumMultiplier) || premiumMultiplier <= 1)
      return { error: "El multiplicador premium debe ser mayor a 1" };
    if (Number.isNaN(minPiece) || minPiece < 0) return { error: "El precio minimo por pieza no puede ser negativo" };
    if (Number.isNaN(minJob) || minJob < 0) return { error: "El precio minimo por trabajo no puede ser negativo" };

    return {
      input: {
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim() || undefined,
        defaultComplexityFactor: complexity,
        defaultWastePercentage: waste,
        minimumAcceptableMultiplier: minMultiplier,
        premiumMultiplier: premiumMultiplier,
        defaultMinimumPricePerPiece: minPiece,
        defaultMinimumJobPrice: minJob,
        roundingRule: form.roundingRule,
      },
    };
  }

  function handleSave() {
    const result = validate();
    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    startTransition(async () => {
      try {
        await updateSettings(result.input);
        toast.success("Configuracion guardada");
        router.refresh();
      } catch (error) {
        toast.error("No se pudo guardar la configuracion", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel space-y-4 rounded-xl p-5">
        <div className="flex items-center gap-2 text-foreground">
          <Building2 className="size-4 text-primary" />
          <h2 className="font-heading text-sm font-semibold tracking-tight">Negocio</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="businessName">Nombre del negocio</Label>
            <Input
              id="businessName"
              value={form.businessName}
              onChange={(e) => update("businessName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ownerName">Nombre del dueño</Label>
            <Input
              id="ownerName"
              value={form.ownerName}
              placeholder="Sin definir"
              onChange={(e) => update("ownerName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Moneda</Label>
            <Input id="currency" value="MXN" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="theme" className="flex items-center gap-1.5">
              <Moon className="size-3.5" />
              Tema
            </Label>
            <div className="flex h-8 items-center gap-2">
              <Switch id="theme" checked disabled />
              <span className="text-xs text-muted-foreground">
                Oscuro fijo (unico tema disponible por ahora)
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel space-y-4 rounded-xl p-5">
        <div className="flex items-center gap-2 text-foreground">
          <Percent className="size-4 text-primary" />
          <h2 className="font-heading text-sm font-semibold tracking-tight">Margenes por defecto</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="complexity">Factor de complejidad</Label>
            <Input
              id="complexity"
              type="number"
              step="0.1"
              min="0.1"
              value={form.defaultComplexityFactor}
              onChange={(e) => update("defaultComplexityFactor", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="waste">Desperdicio (%)</Label>
            <Input
              id="waste"
              type="number"
              step="1"
              min="0"
              value={form.defaultWastePercentage}
              onChange={(e) => update("defaultWastePercentage", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="minMultiplier">Multiplicador minimo aceptable</Label>
            <Input
              id="minMultiplier"
              type="number"
              step="0.01"
              min="0.01"
              max="0.99"
              value={form.minimumAcceptableMultiplier}
              onChange={(e) => update("minimumAcceptableMultiplier", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Debe ser menor a 1 (ej. 0.90).</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="premiumMultiplier">Multiplicador premium</Label>
            <Input
              id="premiumMultiplier"
              type="number"
              step="0.01"
              min="1.01"
              value={form.premiumMultiplier}
              onChange={(e) => update("premiumMultiplier", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Debe ser mayor a 1 (ej. 1.10).</p>
          </div>
        </div>
      </section>

      <section className="glass-panel space-y-4 rounded-xl p-5">
        <div className="flex items-center gap-2 text-foreground">
          <Ruler className="size-4 text-primary" />
          <h2 className="font-heading text-sm font-semibold tracking-tight">Precios minimos y redondeo</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="minPiece">Precio minimo por pieza (MXN)</Label>
            <Input
              id="minPiece"
              type="number"
              step="1"
              min="0"
              value={form.defaultMinimumPricePerPiece}
              onChange={(e) => update("defaultMinimumPricePerPiece", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="minJob">Precio minimo por trabajo (MXN)</Label>
            <Input
              id="minJob"
              type="number"
              step="1"
              min="0"
              value={form.defaultMinimumJobPrice}
              onChange={(e) => update("defaultMinimumJobPrice", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rounding">Regla de redondeo</Label>
            <Select
              value={form.roundingRule}
              onValueChange={(value) => update("roundingRule", value ?? form.roundingRule)}
            >
              <SelectTrigger id="rounding" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUNDING_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending} className="bg-neon-pink text-background hover:bg-neon-pink/90">
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
