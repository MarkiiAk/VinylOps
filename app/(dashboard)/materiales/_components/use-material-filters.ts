import { useMemo, useState } from "react";
import type { Material } from "@/lib/generated/prisma/client";

export const ALL = "__all__";

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((v): v is string => !!v && v.trim().length > 0))).sort((a, b) =>
    a.localeCompare(b)
  );
}

/**
 * Busqueda + filtros compartidos entre el catalogo de Materiales y el
 * listado de Inventario. Ambas paginas cargan la lista completa (ya filtrada
 * por isInventoryTracked en el Server Component correspondiente) y filtran
 * en memoria aqui, sin ida y vuelta al servidor por cada tecla.
 */
export function useMaterialFilters(materials: Material[]) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [color, setColor] = useState(ALL);
  const [brand, setBrand] = useState(ALL);
  const [supplier, setSupplier] = useState(ALL);
  const [showArchived, setShowArchived] = useState(false);

  const categories = useMemo(() => uniqueSorted(materials.map((m) => m.category)), [materials]);
  const colors = useMemo(() => uniqueSorted(materials.map((m) => m.color)), [materials]);
  const brands = useMemo(() => uniqueSorted(materials.map((m) => m.brand)), [materials]);
  const suppliers = useMemo(() => uniqueSorted(materials.map((m) => m.supplierDefault)), [materials]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return materials.filter((m) => {
      if (!showArchived && m.isArchived) return false;
      if (showArchived && !m.isArchived) return false;
      if (term && !m.name.toLowerCase().includes(term)) return false;
      if (category !== ALL && m.category !== category) return false;
      if (color !== ALL && m.color !== color) return false;
      if (brand !== ALL && m.brand !== brand) return false;
      if (supplier !== ALL && m.supplierDefault !== supplier) return false;
      return true;
    });
  }, [materials, search, category, color, brand, supplier, showArchived]);

  return {
    search,
    setSearch,
    category,
    setCategory,
    color,
    setColor,
    brand,
    setBrand,
    supplier,
    setSupplier,
    showArchived,
    setShowArchived,
    categories,
    colors,
    brands,
    suppliers,
    filtered,
  };
}
