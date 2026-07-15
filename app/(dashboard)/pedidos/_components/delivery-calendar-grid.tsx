import Link from "next/link";
import { OrderStatusBadge } from "@/components/order-status-badge";

export interface DeliveryOrderData {
  id: string;
  interest: string;
  status: string;
  deliveryDate: string; // ISO string, serializado desde el server component
  lead: { name: string | null };
}

interface DeliveryCalendarGridProps {
  year: number;
  month: number; // 0-indexado
  orders: DeliveryOrderData[];
}

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function isoDateKey(date: Date) {
  // Clave local (no UTC) para agrupar por día calendario, evita el corrimiento
  // de día que da toISOString() en zonas horarias negativas.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Grilla mensual de 7 columnas construida a mano con Date nativo (sin
 * librería de calendario, por indicación explícita de Marco). Cada celda es
 * un día del mes visible (incluye días de relleno del mes anterior/siguiente
 * para completar semanas), y lista de forma compacta los pedidos cuya
 * deliveryDate cae en ese día.
 */
export function DeliveryCalendarGrid({ year, month, orders }: DeliveryCalendarGridProps) {
  const ordersByDay = new Map<string, DeliveryOrderData[]>();
  for (const order of orders) {
    const key = isoDateKey(new Date(order.deliveryDate));
    const list = ordersByDay.get(key) ?? [];
    list.push(order);
    ordersByDay.set(key, list);
  }

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 = domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Grilla siempre múltiplo de 7: relleno antes (mes anterior) y después
  // (mes siguiente) hasta completar semanas.
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const gridStart = new Date(year, month, 1 - startWeekday);

  const today = new Date();
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    return {
      date,
      inMonth: date.getMonth() === month,
      isToday: isSameDay(date, today),
      orders: ordersByDay.get(isoDateKey(date)) ?? [],
    };
  });

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map(({ date, inMonth, isToday, orders: dayOrders }) => (
          <div
            key={date.toISOString()}
            className={`min-h-28 border-b border-r border-border p-1.5 last:border-r-0 sm:min-h-32 ${
              inMonth ? "" : "bg-muted/30"
            }`}
          >
            <span
              className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums ${
                isToday
                  ? "bg-primary text-primary-foreground"
                  : inMonth
                    ? "text-foreground"
                    : "text-muted-foreground/60"
              }`}
            >
              {date.getDate()}
            </span>

            <div className="mt-1 space-y-1">
              {dayOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/pedidos/${order.id}`}
                  className="block truncate rounded-md bg-muted px-1.5 py-1 text-[0.7rem] leading-tight text-foreground hover:bg-muted/70"
                  title={order.interest}
                >
                  <span className="block truncate font-medium">{order.lead.name || "Sin nombre"}</span>
                  <span className="block truncate text-muted-foreground">{order.interest}</span>
                  <OrderStatusBadge status={order.status} className="mt-0.5 h-4 px-1.5 text-[0.6rem]" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
