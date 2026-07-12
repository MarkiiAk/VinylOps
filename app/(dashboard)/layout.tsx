import { getSettings } from "@/lib/actions/settings";
import {
  DesktopSidebar,
  MobileBottomNav,
  MobileNewQuoteFab,
  ThemeToggle,
} from "@/components/dashboard-nav";

/**
 * Shell de navegacion del dashboard interno.
 * Desktop: sidebar fija a la izquierda con CTA de nueva cotizacion + Smart Quote.
 * Mobile: nav inferior + FAB flotante, con padding de safe-area para iPhone
 * (viewport-fit=cover se define en app/layout.tsx).
 *
 * El nombre del negocio viene de getSettings() (lib/actions/settings.ts) —
 * es de solo lectura, así que se conecta directo aunque el resto de las
 * pantallas todavia usen data hardcodeada.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();

  return (
    <div className="bg-aurora flex min-h-screen w-full">
      <DesktopSidebar businessName={settings.businessName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="pt-safe flex items-center justify-between border-b border-border bg-background/70 px-4 py-3 backdrop-blur-md sm:px-6 md:hidden">
          <div className="leading-tight">
            <p className="font-heading text-sm font-semibold tracking-tight text-foreground">
              {settings.businessName}
            </p>
            <p className="text-[0.7rem] text-muted-foreground">VinylOps Pricing Studio</p>
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 md:px-8 md:pb-8">
          {children}
        </main>
      </div>

      <MobileBottomNav />
      <MobileNewQuoteFab />
    </div>
  );
}
