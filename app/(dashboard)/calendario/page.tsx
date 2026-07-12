import { CalendarDays } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { EmptyState } from "@/components/empty-state";
import { listOrdersWithDeliveryDate } from "@/lib/actions/orders";
import { MonthNav } from "./_components/month-nav";
import { DeliveryCalendarGrid, type DeliveryOrderData } from "./_components/delivery-calendar-grid";

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });

interface CalendarioPageProps {
  searchParams: Promise<{ anio?: string; mes?: string }>;
}

/**
 * Calendario de entregas: vista mensual construida con una grilla CSS simple
 * (sin librería de calendario, ver DeliveryCalendarGrid), alimentada por
 * todas las Order con deliveryDate no nula. Navegación de mes vía query
 * params (?anio=&mes=) para que sea deep-linkeable y no dependa de estado
 * de cliente.
 */
export default async function CalendarioPage({ searchParams }: CalendarioPageProps) {
  const { anio, mes } = await searchParams;

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
        title="Calendario de entregas"
        subtitle="Fechas de entrega de los pedidos activos, mes por mes."
        action={<MonthNav year={year} month={month} label={label} />}
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
