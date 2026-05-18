
import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, LoaderCircle, X } from 'lucide-react';
import { EvidenceAsset } from '../types';
import { getEvidenceLabel, getEvidenceOpenUrl, getEvidencePreviewSrc, isDriveEvidence } from '../utils/evidence';
import { EvidenceUploadContext, uploadEvidence } from '../services/googleSheetsService';

interface Props {
  evidencias: EvidenceAsset[];
  onChange: (evidencias: EvidenceAsset[]) => void;
  uploadContext: EvidenceUploadContext;
  compact?: boolean;
  buttonLabel?: string;
}

export const EvidenceUpload: React.FC<Props> = ({ evidencias, onChange, uploadContext, compact = false, buttonLabel = 'Click / Foto' }) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setIsUploading(true);
      setUploadError('');

      try {
        const uploadedImages: EvidenceAsset[] = [];

        for (const file of Array.from(files) as File[]) {
          const uploaded = await uploadEvidence(file, uploadContext);
          uploadedImages.push(uploaded);
        }

        onChange([...evidencias, ...uploadedImages]);
      } catch (error) {
        console.error('Error uploading evidence:', error);
        setUploadError('No se pudo subir la evidencia. Probá de nuevo.');
      } finally {
        setIsUploading(false);
      }
    }

    e.target.value = '';
  };

  const removeImage = (index: number) => {
    onChange(evidencias.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'}`}>
        {evidencias.map((src, index) => (
          <div key={index} className="relative aspect-square rounded-2xl overflow-hidden group border border-white/60 shadow-sm transition-transform hover:scale-105">
            <img src={getEvidencePreviewSrc(src)} alt={getEvidenceLabel(src, index)} className="w-full h-full object-cover" />
            {isDriveEvidence(src) && getEvidenceOpenUrl(src) && (
              <a
                href={getEvidenceOpenUrl(src)}
                target="_blank"
                rel="noreferrer"
                className="absolute left-1 bottom-1 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-white"
              >
                Drive
              </a>
            )}
            <button
              onClick={() => removeImage(index)}
              className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            >
              <X size={12} strokeWidth={4} />
            </button>
          </div>
        ))}

        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading}
          className={`aspect-square rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100/40 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-indigo-400 hover:text-indigo-400 hover:bg-white/60 transition-all cursor-pointer ${compact ? 'min-h-20' : ''}`}
        >
          {isUploading ? <LoaderCircle size={24} className="animate-spin" strokeWidth={1.5} /> : <Camera size={24} strokeWidth={1.5} />}
          <span className="text-[9px] font-black uppercase tracking-tighter">{buttonLabel}</span>
        </button>

        <button
          onClick={() => galleryInputRef.current?.click()}
          disabled={isUploading}
          className={`aspect-square rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100/40 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-sky-400 hover:text-sky-500 hover:bg-white/60 transition-all cursor-pointer ${compact ? 'min-h-20' : ''}`}
        >
          {isUploading ? <LoaderCircle size={24} className="animate-spin" strokeWidth={1.5} /> : <ImageIcon size={24} strokeWidth={1.5} />}
          <span className="text-[9px] font-black uppercase tracking-tighter">Galeria</span>
        </button>
      </div>

      {isUploading && (
        <p className="text-[11px] text-slate-500">Subiendo evidencia a Drive...</p>
      )}

      {uploadError && (
        <p className="text-[11px] text-red-600">{uploadError}</p>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        multiple
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <input
        ref={galleryInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
