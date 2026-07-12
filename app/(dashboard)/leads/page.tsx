import { SectionHeading } from "@/components/section-heading";
import { listLeads } from "@/lib/actions/leads";
import { LeadsBoardClient } from "./_components/leads-board-client";

/**
 * Leads: catálogo de clientes de VinylOps. Server Component simple:
 * listLeads() ya trae todo lo necesario, la interacción (crear/editar/
 * cambiar status/eliminar) vive en el client component. Cada lead es
 * clickeable hacia /leads/[id] para ver su historial de pedidos.
 */
export default async function LeadsPage() {
  const leads = await listLeads();
  // Serializado a ISO string para pasar de Server a Client Component.
  const rows = leads.map((lead) => ({
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Leads"
        subtitle="Catálogo de clientes: cada lead es un contacto de WhatsApp con su propio historial de pedidos."
      />

      <LeadsBoardClient leads={rows} />
    </div>
  );
}
