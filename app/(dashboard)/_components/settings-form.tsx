"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Moon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { updateSettings, type UpdateSettingsInput } from "@/lib/actions/settings";

export interface SettingsFormValues {
  id: string;
  currency: string;
  businessName: string;
  ownerName: string | null;
  theme: string;
}

function toFormState(settings: SettingsFormValues) {
  return {
    businessName: settings.businessName,
    ownerName: settings.ownerName ?? "",
  };
}

/**
 * Formulario de configuracion global. currency se muestra fijo (MXN, unica
 * moneda soportada por ahora) y theme como toggle documentado: la app corre
 * siempre en dark mode (ver ARCHITECTURE.md #6), asi que el switch queda
 * deshabilitado y encendido, sin persistir un valor distinto todavia.
 *
 * FASE 6 (V1, limpieza): se retiraron los campos del motor de pricing por
 * área+complejidad (factor de complejidad, multiplicadores, precios
 * mínimos, redondeo) — sin ningún consumidor real desde que el negocio pasó
 * a precio fijo por catálogo.
 */
export function SettingsForm({ settings }: { settings: SettingsFormValues }) {
  const [form, setForm] = useState(toFormState(settings));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): { input: UpdateSettingsInput } | { error: string } {
    if (!form.businessName.trim()) return { error: "El nombre del negocio no puede quedar vacio" };

    return {
      input: {
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim() || undefined,
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

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending} className="bg-neon-pink text-background hover:bg-neon-pink/90">
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
