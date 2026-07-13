import { SectionHeading } from "@/components/section-heading";
import { listCatalogItems } from "@/lib/actions/catalog";
import { listMaterials } from "@/lib/actions/materials";
import { CatalogListClient } from "./_components/catalog-list-client";
import { CatalogItemFormDialog } from "./_components/catalog-item-form-dialog";

/**
 * Catálogo de precio fijo (etiquetas escolares y kits) — solo el catálogo en
 * sí (definición + receta + costo/margen de cada producto), sin mezclar
 * ventas: las ventas reales se registran y se ven en /pedidos, ligadas a un
 * lead. Server Component: listCatalogItems ya calcula costo de producción y
 * margen al vuelo a partir del costo vigente de cada material de la receta.
 * Carga activos + archivados de una sola vez (mismo criterio que
 * /materiales) y delega el toggle "Ver archivados" al client component.
 */
export default async function CatalogoPage() {
  const [items, materials] = await Promise.all([
    listCatalogItems({ includeArchived: true }),
    listMaterials({ includeArchived: true }),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Catálogo"
        subtitle="Productos de precio fijo: etiquetas escolares y kits, con su receta y margen."
        action={<CatalogItemFormDialog materials={materials} componentOptions={items} />}
      />

      <CatalogListClient items={items} materials={materials} />
    </div>
  );
}
