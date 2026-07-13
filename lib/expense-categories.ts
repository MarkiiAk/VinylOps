// Categorías y métodos de pago de gastos operativos (Fase 4, V1). Viven en
// un archivo aparte (no en lib/actions/expenses.ts) porque un archivo
// 'use server' solo puede exportar funciones async — exportar una constante
// desde ahí rompe el build de Next ("A 'use server' file can only export
// async functions").

export const EXPENSE_CATEGORIES = [
  'Publicidad',
  'Envíos y traslados',
  'Herramientas',
  'Mantenimiento',
  'Servicios',
  'Empaque',
  'Papelería',
  'Software',
  'Comisiones',
  'Otros',
] as const

export const EXPENSE_METHODS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'] as const
