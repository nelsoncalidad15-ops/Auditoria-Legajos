import { EvidenceAsset } from '../types';

export const isDriveEvidence = (evidence: EvidenceAsset): evidence is Exclude<EvidenceAsset, string> =>
  typeof evidence === 'object' && evidence !== null && evidence.kind === 'drive';

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export const getEvidencePreviewSrc = (evidence: EvidenceAsset) => {
  if (typeof evidence === 'string') return evidence;
  if (evidence.fileId) {
    return `https://drive.google.com/thumbnail?id=${evidence.fileId}&sz=w1200`;
  }
  return evidence.previewUrl || evidence.url || evidence.openUrl || '';
};

export const getEvidenceOpenUrl = (evidence: EvidenceAsset) => {
  if (typeof evidence === 'string') return '';
  return evidence.openUrl || evidence.url || evidence.previewUrl || '';
};

export const getEvidencePdfSources = (evidence: EvidenceAsset) => {
  if (typeof evidence === 'string') return unique([evidence]);

  return unique([
    evidence.previewUrl || '',
    evidence.url || '',
    evidence.fileId ? `https://drive.google.com/thumbnail?id=${evidence.fileId}&sz=w1600` : '',
    evidence.fileId ? `https://drive.google.com/uc?export=view&id=${evidence.fileId}` : '',
    evidence.fileId ? `https://lh3.googleusercontent.com/d/${evidence.fileId}=w1600` : '',
  ]);
};

export const getEvidenceLabel = (evidence: EvidenceAsset, index: number) => {
  if (typeof evidence === 'string') return `Evidencia ${index + 1}`;
  return evidence.name || `Evidencia ${index + 1}`;
};
