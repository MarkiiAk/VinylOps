import { SectionHeading } from "@/components/section-heading";
import { getSettings } from "@/lib/actions/settings";
import { SettingsForm } from "../_components/settings-form";

/**
 * Configuracion global del negocio. Server component: carga getSettings()
 * (fila unica, se crea con defaults si no existe) y delega la edicion a
 * SettingsForm (client component) que llama updateSettings() + router.refresh().
 */
export default async function ConfiguracionPage() {
  const settings = await getSettings();

  return (
    <div className="max-w-2xl space-y-8">
      <SectionHeading
        title="Configuracion"
        subtitle="Ajustes del negocio y valores por defecto para el motor de precios."
      />
      <SettingsForm settings={settings} />
    </div>
  );
}
