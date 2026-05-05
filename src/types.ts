
export interface AuditItem {
  id: number;
  requisito: string;
  descripcion: string;
  roles: string[]; // Ventas, Admin, Pre-Entrega
}

export type BranchName = 'Jujuy' | 'Salta';
export type LegajoStatus = 'pendiente' | 'en_proceso' | 'finalizado';

export interface AuditItemDetail {
  comentario: string;
  evidencias: string[];
}

export interface LegajoRecord {
  id: string;
  nombre: string;
  status: LegajoStatus;
  createdAt: number;
  updatedAt: number;
  finalizedAt?: number;
  scores: Record<number, number>;
  itemDetails: Record<number, AuditItemDetail>;
  evidencias: string[];
  observaciones: string;
  conclusiones: string;
}

export interface AuditSession {
  id: string;
  nombre: string;
  sucursal: BranchName;
  auditor: string;
  objetivo: number;
  createdAt: number;
  updatedAt: number;
  status: 'en_curso' | 'cerrada';
  legajos: LegajoRecord[];
}

export interface AuditData {
  id?: string;
  timestamp: number;
  sucursal: BranchName;
  auditoriaId?: string;
  auditoriaNombre?: string;
  auditor?: string;
  legajoNombre: string;
  legajoEstado?: 'pendiente' | 'en_proceso' | 'finalizado';
  scores: Record<number, number>; // itemId: score (0 or 1)
  itemDetails: Record<number, AuditItemDetail>;
  evidencias: string[]; // base64 images
  observaciones: string;
  conclusiones: string;
}

export interface AuditSummary {
  ventas: number;
  admin: number;
  preEntrega: number;
  total: number;
}
