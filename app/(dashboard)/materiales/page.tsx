import { SectionHeading } from "@/components/section-heading";
import { listMaterials } from "@/lib/actions/materials";
import { MaterialFormDialog } from "./_components/material-form-dialog";
import { MaterialsListClient } from "./_components/materials-list-client";

/**
 * Catalogo de materiales: TODOS los tipos de material (con o sin inventario
 * trackeado), sin importar isInventoryTracked. Es el catalogo de referencia
 * de costo/proveedor — el stock real (area disponible, valor de inventario,
 * alerta de stock bajo) vive en /inventario, no aqui.
 *
 * Server Component: carga TODOS los materiales (activos + archivados) una
 * sola vez y delega busqueda/filtros/toggle de archivados al client
 * component, que filtra en memoria sin volver a pegarle al servidor por
 * cada tecla.
 */
export default async function MaterialesPage() {
  const materials = await listMaterials({ includeArchived: true });

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Materiales"
        subtitle="Catalogo de tipos de material: costo de referencia, proveedor y link de compra. El stock real esta en Inventario."
        action={<MaterialFormDialog />}
      />

      <MaterialsListClient materials={materials} />
    </div>
  );
}
