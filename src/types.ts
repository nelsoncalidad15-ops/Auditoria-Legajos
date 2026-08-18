
export interface AuditItem {
  id: number;
  requisito: string;
  descripcion: string;
  roles: string[]; // Ventas, Admin, Pre-Entrega
}

export type BranchName = 'Jujuy' | 'Salta';
export type LegajoStatus = 'pendiente' | 'en_proceso' | 'finalizado';
export type AuditScore = 0 | 1 | -1;

export interface DriveEvidenceAsset {
  kind: 'drive';
  fileId: string;
  name: string;
  mimeType?: string;
  url: string;
  previewUrl?: string;
  openUrl?: string;
  uploadedAt?: number;
}

export type EvidenceAsset = string | DriveEvidenceAsset;

export interface AuditItemDetail {
  comentario: string;
  evidencias: EvidenceAsset[];
  affectedRoles?: string[];
}

export interface LegajoRecord {
  id: string;
  nombre: string;
  vendedor?: string;
  status: LegajoStatus;
  createdAt: number;
  updatedAt: number;
  finalizedAt?: number;
  scores: Record<number, AuditScore>;
  itemDetails: Record<number, AuditItemDetail>;
  evidencias: EvidenceAsset[];
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
  legajoVendedor?: string;
  legajoEstado?: 'pendiente' | 'en_proceso' | 'finalizado';
  scores: Record<number, AuditScore>; // itemId: 0 = desvío, 1 = OK, -1 = N/A
  itemDetails: Record<number, AuditItemDetail>;
  evidencias: EvidenceAsset[];
  observaciones: string;
  conclusiones: string;
  summary?: AuditSummary;
}

export interface AuditSummary {
  ventas: number;
  admin: number;
  preEntrega: number;
  total: number;
}
