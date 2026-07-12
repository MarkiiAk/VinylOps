import { SectionHeading } from "@/components/section-heading";
import { listOrders } from "@/lib/actions/orders";
import { OrdersBoardClient, type OrderCardData } from "./_components/orders-board-client";

/**
 * Tablero Kanban de pedidos (Order): 5 columnas por status de producción.
 * Server Component simple: listOrders() ya trae lead + lineItems, la
 * interacción (cambiar status, registrar pago) vive en el client component.
 */
export default async function PedidosPage() {
  const orders = await listOrders();

  const cards: OrderCardData[] = orders.map((order) => ({
    id: order.id,
    interest: order.interest,
    status: order.status,
    deliveryDate: order.deliveryDate ? order.deliveryDate.toISOString() : null,
    lead: { id: order.lead.id, name: order.lead.name, phone: order.lead.phone },
    total: order.lineItems.reduce((sum, line) => sum + line.lineTotal, 0),
  }));

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Pedidos"
        subtitle="Tablero de producción: cada tarjeta es un pedido ligado a un lead, avanza por sus fases hasta la entrega."
      />

      <OrdersBoardClient orders={cards} />
    </div>
  );
}
