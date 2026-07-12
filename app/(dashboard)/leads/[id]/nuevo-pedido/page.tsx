import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listMaterials } from "@/lib/actions/materials";
import { listCatalogItems } from "@/lib/actions/catalog";
import { getLeadWithOrders } from "@/lib/actions/leads";
import { SectionHeading } from "@/components/section-heading";
import { OrderCartClient } from "./_components/order-cart-client";

interface NuevoPedidoPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Nuevo pedido para un lead ya existente — flujo tipo carrito (adaptado de
 * la vieja /cotizaciones/nueva): se agregan líneas del catálogo de precio
 * fijo y/o líneas "Otro" 100% manuales. El lead viene fijo desde la ruta, no
 * hay selector como en el flujo viejo. Un solo round-trip al cargar
 * (catálogo + materiales); el carrito vive en estado local del cliente hasta
 * que se guarda de una sola vez.
 */
export default async function NuevoPedidoPage({ params }: NuevoPedidoPageProps) {
  const { id } = await params;

  let lead;
  try {
    lead = await getLeadWithOrders(id);
  } catch {
    notFound();
  }

  const [catalogItems, materials] = await Promise.all([listCatalogItems(), listMaterials()]);

  const catalogItemsLite = catalogItems.map((item) => ({
    id: item.id,
    name: item.name,
    unitPrice: item.unitPrice,
  }));

  const materialsLite = materials
    .filter((m) => !m.isArchived)
    .map((m) => ({
      id: m.id,
      name: m.name,
      sheetWidthCm: m.sheetWidthCm,
      sheetHeightCm: m.sheetHeightCm,
    }));

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link
          href={`/leads/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver a {lead.name || "el lead"}
        </Link>
        <SectionHeading
          title="Nuevo pedido"
          subtitle={`Arma el carrito de este pedido para ${lead.name || "el lead"}.`}
        />
      </div>
      <OrderCartClient leadId={id} catalogItems={catalogItemsLite} materials={materialsLite} />
    </div>
  );
}
