import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, DollarSign, Layers, Package, Ruler } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMaterial } from "@/lib/actions/materials";
import { PurchaseForm } from "../_components/purchase-form";
import { MaterialFormDialog } from "../_components/material-form-dialog";
import { MaterialCostChart } from "../_components/material-cost-chart";

function formatMXN(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits,
  }).format(value);
}

function formatM2(cm2: number) {
  return `${(cm2 / 10_000).toFixed(2)} m2`;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

interface MaterialDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Detalle de un material: metricas actuales, historial de compras, historial
 * de uso en pedidos, y grafica de evolucion de costo. `getMaterial`
 * lanza si no existe -> se traduce a notFound() de Next para el 404 estandar.
 */
export default async function MaterialDetailPage({ params }: MaterialDetailPageProps) {
  const { id } = await params;

  let material;
  try {
    material = await getMaterial(id);
  } catch {
    notFound();
  }

  const isLowStock = material.lowStockThresholdCm2 > 0 && material.totalAreaCm2 <= material.lowStockThresholdCm2;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/materiales"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver a materiales
        </Link>
        <SectionHeading
          title={material.name}
          subtitle={[material.category, material.color, material.finish].filter(Boolean).join(" · ")}
          action={
            <div className="flex flex-wrap gap-2">
              <MaterialFormDialog
                material={{
                  id: material.id,
                  name: material.name,
                  category: material.category,
                  color: material.color,
                  finish: material.finish,
                  brand: material.brand,
                  supplierDefault: material.supplierDefault,
                  lowStockThresholdCm2: material.lowStockThresholdCm2,
                  isInventoryTracked: material.isInventoryTracked,
                  purchaseUrl: material.purchaseUrl,
                  sheetWidthCm: material.sheetWidthCm,
                  sheetHeightCm: material.sheetHeightCm,
                }}
                trigger={<Button variant="outline">Editar material</Button>}
              />
              <PurchaseForm material={material} />
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Costo / cm2"
          value={formatMXN(material.weightedAverageCostPerCm2, 4)}
          icon={<DollarSign />}
        />
        <StatCard label="Costo / m2" value={formatMXN(material.weightedAverageCostPerM2)} icon={<DollarSign />} />
        <StatCard
          label="Area disponible"
          value={formatM2(material.totalAreaCm2)}
          icon={<Ruler />}
          variant={isLowStock ? "warning" : "neutral"}
          hint={isLowStock ? "Por debajo del umbral de stock bajo" : undefined}
        />
        <StatCard label="Valor disponible" value={formatMXN(material.totalValue)} icon={<Package />} />
      </div>

      <div className="glass-panel rounded-xl p-4">
        <h2 className="mb-3 font-heading text-sm font-medium text-foreground">Evolucion del costo</h2>
        <MaterialCostChart
          purchases={material.purchases}
          currentWeightedAverageCostPerCm2={material.weightedAverageCostPerCm2}
        />
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-sm font-medium text-foreground">Historial de compras</h2>
        {material.purchases.length === 0 ? (
          <EmptyState icon={Layers} title="Sin compras registradas" description="Agrega la primera compra de este material." />
        ) : (
          <div className="glass-panel overflow-x-auto rounded-xl">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Dimensiones</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Precio bruto</TableHead>
                  <TableHead>Descuento</TableHead>
                  <TableHead>Precio final</TableHead>
                  <TableHead className="text-right">Costo / cm2</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {material.purchases.map((purchase) => (
                  <TableRow key={purchase.id} className="border-border">
                    <TableCell className="text-muted-foreground">{formatDate(purchase.purchaseDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{purchase.supplier ?? "—"}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {purchase.widthCm} x {purchase.heightCm} cm
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{purchase.quantity}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatMXN(purchase.grossPrice)}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatMXN(purchase.discount)}
                    </TableCell>
                    <TableCell className="tabular-nums font-medium text-foreground">
                      {formatMXN(purchase.finalPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {formatMXN(purchase.costPerCm2, 4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-sm font-medium text-foreground">Historial de uso</h2>
        {material.orderLineItemUsages.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Sin uso registrado"
            description="Cuando este material se declare en una linea 'Otro' de un pedido, aparecera aqui."
          />
        ) : (
          <div className="glass-panel overflow-x-auto rounded-xl">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Pedido</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Area declarada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {material.orderLineItemUsages.map((usage) => (
                  <TableRow key={usage.id} className="border-border">
                    <TableCell className="font-medium text-foreground">{usage.description}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={usage.order.status} />
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {usage.otherMaterialAreaCm2 !== null ? formatM2(usage.otherMaterialAreaCm2) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
