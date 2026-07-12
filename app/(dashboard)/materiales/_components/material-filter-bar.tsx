"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ALL } from "./use-material-filters";

interface MaterialFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  color: string;
  onColorChange: (value: string) => void;
  colors: string[];
  brand: string;
  onBrandChange: (value: string) => void;
  brands: string[];
  supplier: string;
  onSupplierChange: (value: string) => void;
  suppliers: string[];
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
}

/** Barra de busqueda + filtros, compartida entre /materiales y /inventario. */
export function MaterialFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  category,
  onCategoryChange,
  categories,
  color,
  onColorChange,
  colors,
  brand,
  onBrandChange,
  brands,
  supplier,
  onSupplierChange,
  suppliers,
  showArchived,
  onShowArchivedChange,
}: MaterialFilterBarProps) {
  return (
    <div className="glass-panel flex flex-col gap-3 rounded-xl p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterSelect label="Categoria" value={category} onChange={onCategoryChange} options={categories} />
        <FilterSelect label="Color" value={color} onChange={onColorChange} options={colors} />
        <FilterSelect label="Marca" value={brand} onChange={onBrandChange} options={brands} />
        <FilterSelect label="Proveedor" value={supplier} onChange={onSupplierChange} options={suppliers} />

        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="show-archived" className="text-xs text-muted-foreground">
            Ver archivados
          </Label>
          <Switch id="show-archived" checked={showArchived} onCheckedChange={onShowArchivedChange} />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  if (options.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
    >
      <option value={ALL} className="bg-popover text-popover-foreground">
        {label}: todos
      </option>
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-popover text-popover-foreground">
          {opt}
        </option>
      ))}
    </select>
  );
}
