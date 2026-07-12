"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, MessageCircleMore, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { LeadStatusBadge, LEAD_STATUS_OPTIONS } from "@/components/lead-status-badge";
import { updateLead, deleteLead } from "@/lib/actions/leads";
import { LeadFormDialog } from "./lead-form-dialog";

export interface LeadRow {
  id: string;
  name: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  createdAt: string; // ISO string, serializado desde el server component
  updatedAt: string;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso)
  );
}

/**
 * Board de leads: tarjetas con nombre/teléfono/notas, Select inline para
 * cambiar status (llama updateLead al vuelo), editar (reusa LeadFormDialog
 * en modo edición), eliminar (confirm simple, no es data financiera) y un
 * link a /leads/[id] para ver el historial de pedidos de ese contacto.
 * Server component (page.tsx) ya trae la lista ordenada.
 */
export function LeadsBoardClient({ leads }: { leads: LeadRow[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleStatusChange(lead: LeadRow, nextStatus: string | null) {
    if (!nextStatus || nextStatus === lead.status) return;
    startTransition(async () => {
      try {
        await updateLead(lead.id, { status: nextStatus });
        toast.success(`Status actualizado a ${nextStatus}`);
        router.refresh();
      } catch (error) {
        toast.error("No se pudo actualizar el status", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  }

  function handleDelete(lead: LeadRow) {
    const label = lead.name || "este lead";
    if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      try {
        await deleteLead(lead.id);
        toast.success("Lead eliminado");
        router.refresh();
      } catch (error) {
        toast.error("No se pudo eliminar el lead", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <LeadFormDialog />
      </div>

      {leads.length === 0 ? (
        <EmptyState
          icon={MessageCircleMore}
          title="No hay leads todavía"
          description="Registra aquí a las clientas que preguntan por WhatsApp, antes de que se conviertan en una venta."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <div key={lead.id} className="glass-panel flex flex-col gap-3 rounded-xl p-4">
              <Link href={`/leads/${lead.id}`} className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-heading text-base font-medium text-foreground">
                    {lead.name || "Sin nombre"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {lead.phone || "Sin teléfono"} · {formatDate(lead.createdAt)}
                  </p>
                </div>
                <LeadStatusBadge status={lead.status} className="shrink-0" />
              </Link>

              {lead.notes ? (
                <p className="text-sm text-muted-foreground">{lead.notes}</p>
              ) : null}

              <div className="mt-1 flex items-center justify-between gap-2">
                <Select
                  value={lead.status}
                  onValueChange={(value) => handleStatusChange(lead, value)}
                  disabled={isPending}
                >
                  <SelectTrigger size="sm" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1">
                  <Link href={`/leads/${lead.id}`}>
                    <Button size="icon-sm" variant="ghost" title="Ver historial">
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </Link>
                  <LeadFormDialog
                    lead={{
                      id: lead.id,
                      name: lead.name,
                      phone: lead.phone,
                      status: lead.status,
                      notes: lead.notes,
                    }}
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => handleDelete(lead)}
                    title="Eliminar lead"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
