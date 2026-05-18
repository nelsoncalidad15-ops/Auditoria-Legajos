import { EvidenceAsset } from '../types';

export const isDriveEvidence = (evidence: EvidenceAsset): evidence is Exclude<EvidenceAsset, string> =>
  typeof evidence === 'object' && evidence !== null && evidence.kind === 'drive';

export const getEvidencePreviewSrc = (evidence: EvidenceAsset) => {
  if (typeof evidence === 'string') return evidence;
  return evidence.previewUrl || evidence.url || evidence.openUrl || '';
};

export const getEvidenceOpenUrl = (evidence: EvidenceAsset) => {
  if (typeof evidence === 'string') return '';
  return evidence.openUrl || evidence.url || evidence.previewUrl || '';
};

export const getEvidenceLabel = (evidence: EvidenceAsset, index: number) => {
  if (typeof evidence === 'string') return `Evidencia ${index + 1}`;
  return evidence.name || `Evidencia ${index + 1}`;
};
