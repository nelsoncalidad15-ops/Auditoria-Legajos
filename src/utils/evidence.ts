import { EvidenceAsset } from '../types';

export const isDriveEvidence = (evidence: EvidenceAsset): evidence is Exclude<EvidenceAsset, string> =>
  typeof evidence === 'object' && evidence !== null && evidence.kind === 'drive';

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const buildDrivePreviewUrl = (fileId: string, size = 'w1200') =>
  `https://drive.google.com/thumbnail?id=${fileId}&sz=${size}`;

const buildDriveDirectImageUrl = (fileId: string) =>
  `https://drive.google.com/uc?export=view&id=${fileId}`;

const buildDriveFileUrl = (fileId: string) =>
  `https://drive.google.com/file/d/${fileId}/view`;

export const getEvidencePreviewSrc = (evidence: EvidenceAsset) => {
  if (typeof evidence === 'string') return evidence;
  if (evidence.fileId) {
    return buildDrivePreviewUrl(evidence.fileId);
  }
  return evidence.previewUrl || evidence.url || evidence.openUrl || '';
};

export const getEvidenceOpenUrl = (evidence: EvidenceAsset) => {
  if (typeof evidence === 'string') return '';
  if (evidence.fileId) {
    return buildDriveDirectImageUrl(evidence.fileId);
  }
  return evidence.openUrl || evidence.url || evidence.previewUrl || '';
};

export const getEvidenceDriveUrl = (evidence: EvidenceAsset) => {
  if (typeof evidence === 'string') return '';
  if (evidence.fileId) {
    return buildDriveFileUrl(evidence.fileId);
  }
  return evidence.openUrl || '';
};

export const getEvidencePdfSources = (evidence: EvidenceAsset) => {
  if (typeof evidence === 'string') return unique([evidence]);

  return unique([
    evidence.previewUrl || '',
    evidence.url || '',
    evidence.fileId ? buildDrivePreviewUrl(evidence.fileId, 'w1600') : '',
    evidence.fileId ? buildDriveDirectImageUrl(evidence.fileId) : '',
    evidence.fileId ? `https://lh3.googleusercontent.com/d/${evidence.fileId}=w1600` : '',
  ]);
};

export const getEvidenceLabel = (evidence: EvidenceAsset, index: number) => {
  if (typeof evidence === 'string') return `Evidencia ${index + 1}`;
  return evidence.name || `Evidencia ${index + 1}`;
};
