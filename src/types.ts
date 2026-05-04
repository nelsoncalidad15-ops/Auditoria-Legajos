
export interface AuditItem {
  id: number;
  requisito: string;
  descripcion: string;
  roles: string[]; // Ventas, Admin, Pre-Entrega
}

export interface AuditData {
  id?: string;
  timestamp: number;
  sucursal: 'Jujuy' | 'Salta';
  legajoNombre: string;
  scores: Record<number, number>; // itemId: score (0 or 1)
  evidencias: string[]; // base64 images
  observaciones: string;
}

export interface AuditSummary {
  ventas: number;
  admin: number;
  preEntrega: number;
  total: number;
}
