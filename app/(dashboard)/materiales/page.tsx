import { SectionHeading } from "@/components/section-heading";
import { listMaterials } from "@/lib/actions/materials";
import { MaterialFormDialog } from "./_components/material-form-dialog";
import { MaterialsListClient } from "./_components/materials-list-client";

/**
 * Materiales: catalogo + inventario en una sola pantalla. Antes eran dos
 * rutas separadas (/materiales y /inventario) sobre la misma tabla,
 * distinguidas solo por isInventoryTracked — se fusionaron porque era la
 * misma pantalla disfrazada de dos.
 *
 * Server Component: carga TODOS los materiales (activos + archivados, con o
 * sin inventario trackeado) una sola vez y delega busqueda/filtros al client
 * component, que filtra en memoria sin volver a pegarle al servidor por
 * cada tecla.
 */
export default async function MaterialesPage() {
  const materials = await listMaterials({ includeArchived: true });

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Materiales"
        subtitle="Catalogo de materiales e inventario real: costo de referencia, stock disponible y compras."
        action={<MaterialFormDialog />}
      />

      <MaterialsListClient materials={materials} />
    </div>
  );
}
