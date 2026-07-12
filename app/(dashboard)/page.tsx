import Link from "next/link";
import { Layers, Wallet, TrendingUp, AlertTriangle, Plus, PackagePlus, ShoppingBag } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { StatCard } from "@/components/stat-card";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getDashboardSummary } from "@/lib/actions/dashboard";

function formatMXN(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(date);
}

/**
 * Dashboard principal. Server component: llama getDashboardSummary() directo
 * (sin cliente/fetch intermedio) y renderiza todo con datos reales del seed.
 */
export default async function DashboardHomePage() {
  const summary = await getDashboardSummary();

  const hasLowStock = summary.lowStockMaterials.length > 0;

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Dashboard"
        subtitle="Resumen rapido de tu inventario y pedidos del mes."
        action={
          <div className="flex gap-2">
            <Link href="/materiales">
              <Button variant="outline" className="gap-1.5 border-neon-violet/30 text-neon-violet hover:bg-neon-violet/10">
                <PackagePlus className="size-4" />
                Agregar compra
              </Button>
            </Link>
            <Link href="/leads">
              <Button className="gap-1.5 bg-neon-pink text-background hover:bg-neon-pink/90">
                <Plus className="size-4" />
                Nuevo lead
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Valor inventario"
          value={formatMXN(summary.totalInventoryValue)}
          icon={<Wallet strokeWidth={2} />}
          delay={0}
        />
        <StatCard
          label="Materiales activos"
          value={String(summary.activeMaterialsCount)}
          icon={<Layers strokeWidth={2} />}
          delay={0.05}
        />
        <StatCard
          label="Ganancia del mes"
          value={formatMXN(summary.estimatedProfitThisMonth)}
          icon={<TrendingUp strokeWidth={2} />}
          variant={summary.estimatedProfitThisMonth >= 0 ? "success" : "warning"}
          hint="Pagos recibidos este mes"
          delay={0.1}
        />
        <StatCard
          label="Pedidos completados"
          value={String(summary.acceptedJobsCount)}
          icon={<ShoppingBag strokeWidth={2} />}
          hint="Completado + Entregado"
          delay={0.15}
        />
      </div>

      {hasLowStock ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight text-warning">
            <AlertTriangle className="size-4" />
            Stock bajo
          </h2>
          <div className="glass-panel divide-y divide-border rounded-xl ring-1 ring-warning/25">
            {summary.lowStockMaterials.map((material) => (
              <div key={material.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium text-foreground">{material.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {material.category}
                    {material.color ? ` · ${material.color}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-warning">
                  {material.totalAreaCm2.toFixed(0)} cm² restantes
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
            Compras recientes
          </h2>
          {summary.recentPurchases.length === 0 ? (
            <EmptyState
              icon={PackagePlus}
              title="Todavia no hay compras registradas"
              description="Agrega tu primera compra de material para llevar el control de inventario."
              action={
                <Link href="/materiales">
                  <Button size="sm" variant="outline">
                    Ir a materiales
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="glass-panel divide-y divide-border rounded-xl">
              {summary.recentPurchases.map((purchase) => (
                <div key={purchase.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium text-foreground">{purchase.material.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(purchase.purchaseDate)}
                      {purchase.supplier ? ` · ${purchase.supplier}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                    {formatMXN(purchase.finalPrice)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
            Pedidos recientes
          </h2>
          {summary.recentOrders.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Todavia no tienes pedidos"
              description="Crea un lead y su primer pedido para empezar a ver el resumen aqui."
              action={
                <Link href="/leads">
                  <Button size="sm" className="bg-neon-pink text-background hover:bg-neon-pink/90">
                    Ir a leads
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="glass-panel divide-y divide-border rounded-xl">
              {summary.recentOrders.map((order) => {
                const total = order.lineItems.reduce((sum, line) => sum + line.lineTotal, 0);
                const clientLabel = order.lead?.name || "Sin cliente";
                return (
                  <Link
                    key={order.id}
                    href={`/pedidos/${order.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-sidebar-accent/40"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium text-foreground">{clientLabel}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {order.interest}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium tabular-nums text-foreground">
                        {formatMXN(total)}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
