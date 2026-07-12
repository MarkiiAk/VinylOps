import { SectionHeading } from "@/components/section-heading";
import { listMaterials } from "@/lib/actions/materials";
import { InventoryListClient } from "./_components/inventory-list-client";

/**
 * Inventario: stock real que se compra y se va gastando. Solo materiales con
 * isInventoryTracked=true (a diferencia de /materiales, que es el catalogo
 * completo). Server Component: carga todo el inventario (activo + archivado)
 * una sola vez y delega busqueda/filtros al client component.
 */
export default async function InventarioPage() {
  const materials = await listMaterials({ includeArchived: true, isInventoryTracked: true });

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Inventario"
        subtitle="Stock real de materiales que se compran y se van gastando. El costo promedio ponderado se recalcula con cada compra."
      />

      <InventoryListClient materials={materials} />
    </div>
  );
}
