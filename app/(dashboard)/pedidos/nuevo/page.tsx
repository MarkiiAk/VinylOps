import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listMaterials } from "@/lib/actions/materials";
import { listCatalogItems } from "@/lib/actions/catalog";
import { listLeads } from "@/lib/actions/leads";
import { SectionHeading } from "@/components/section-heading";
import { OrderCartClient } from "../_components/order-cart/order-cart-client";

/**
 * Nuevo pedido desde el tablero de Pedidos (a diferencia de
 * /leads/[id]/nuevo-pedido, aquí el lead no viene fijo por la ruta — se
 * elige de un selector con los leads reales, tipado fuerte: OrderCartClient
 * no deja guardar sin un leadId real seleccionado).
 */
export default async function NuevoPedidoDesdeTableroPage() {
  const [catalogItems, materials, leads] = await Promise.all([
    listCatalogItems(),
    listMaterials(),
    listLeads(),
  ]);

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
      unit: m.unit,
    }));

  const leadOptions = leads.map((lead) => ({ id: lead.id, name: lead.name, phone: lead.phone }));

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link
          href="/pedidos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver a Pedidos
        </Link>
        <SectionHeading title="Nuevo pedido" subtitle="Arma el carrito de este pedido para un lead ya existente." />
      </div>
      <OrderCartClient leads={leadOptions} catalogItems={catalogItemsLite} materials={materialsLite} />
    </div>
  );
}
