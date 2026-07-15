import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/section-heading";
import { EmptyState } from "@/components/empty-state";
import { listOrders, listOrdersWithDeliveryDate } from "@/lib/actions/orders";
import { OrdersBoardClient, type OrderCardData } from "./_components/orders-board-client";
import { PedidosViewToggle } from "./_components/pedidos-view-toggle";
import { MonthNav } from "./_components/month-nav";
import { DeliveryCalendarGrid, type DeliveryOrderData } from "./_components/delivery-calendar-grid";

function NewOrderButton() {
  return (
    <Link href="/pedidos/nuevo">
      <Button size="sm" className="gap-1.5 bg-neon-pink text-background hover:bg-neon-pink/90">
        <Plus className="size-4" />
        Nuevo pedido
      </Button>
    </Link>
  );
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });

interface PedidosPageProps {
  searchParams: Promise<{ vista?: string; anio?: string; mes?: string }>;
}

/**
 * Pedidos: tablero Kanban (default) o vista calendario de entregas, con un
 * toggle arriba (antes /calendario era una ruta aparte — se fusionó porque
 * es la misma info, `Order.deliveryDate`, sin modelo propio).
 */
export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  const { vista, anio, mes } = await searchParams;

  if (vista === "calendario") {
    const now = new Date();
    const year = anio ? Number(anio) : now.getFullYear();
    // mes en la URL es 1-indexado (más natural para deep-linking); Date usa 0-indexado.
    const month = mes ? Number(mes) - 1 : now.getMonth();

    const orders = await listOrdersWithDeliveryDate();

    const monthOrders: DeliveryOrderData[] = orders
      .filter((order) => {
        if (!order.deliveryDate) return false;
        const d = new Date(order.deliveryDate);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map((order) => ({
        id: order.id,
        interest: order.interest,
        status: order.status,
        deliveryDate: order.deliveryDate!.toISOString(),
        lead: { name: order.lead.name },
      }));

    const label = MONTH_LABEL_FORMATTER.format(new Date(year, month, 1));

    return (
      <div className="space-y-6">
        <SectionHeading
          title="Pedidos"
          subtitle="Fechas de entrega de los pedidos activos, mes por mes."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <PedidosViewToggle vista="calendario" />
              <MonthNav year={year} month={month} label={label} />
              <NewOrderButton />
            </div>
          }
        />

        {monthOrders.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Sin entregas programadas este mes"
            description="Los pedidos aparecen aquí cuando tienen una fecha de entrega asignada."
          />
        ) : (
          <DeliveryCalendarGrid year={year} month={month} orders={monthOrders} />
        )}
      </div>
    );
  }

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
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PedidosViewToggle vista="kanban" />
            <NewOrderButton />
          </div>
        }
      />

      <OrdersBoardClient orders={cards} />
    </div>
  );
}
