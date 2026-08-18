
import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, LoaderCircle, X } from 'lucide-react';
import { EvidenceAsset } from '../types';
import { getEvidenceDriveUrl, getEvidenceLabel, getEvidenceOpenUrl, getEvidencePreviewSrc, isDriveEvidence } from '../utils/evidence';
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
  const [failedPreviews, setFailedPreviews] = useState<Record<number, boolean>>({});
  const [selectedPreview, setSelectedPreview] = useState<EvidenceAsset | null>(null);

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

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const imageFiles = (Array.from(e.clipboardData.files) as File[]).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    e.preventDefault();
    setIsUploading(true);
    setUploadError('');

    try {
      const uploadedImages: EvidenceAsset[] = [];
      for (const file of imageFiles) {
        uploadedImages.push(await uploadEvidence(file, uploadContext));
      }
      onChange([...evidencias, ...uploadedImages]);
    } catch (error) {
      console.error('Error pasting evidence:', error);
      setUploadError('No se pudo pegar la evidencia. Intenta nuevamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const shouldRemove = window.confirm('¿Querés quitar esta evidencia del legajo?');
    if (!shouldRemove) return;
    onChange(evidencias.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      <div className={`grid gap-3 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'}`}>
        {evidencias.map((src, index) => (
          <div key={index} className="relative aspect-square rounded-2xl overflow-hidden group border border-white/60 shadow-sm transition-transform hover:scale-105">
            <button
              type="button"
              onClick={() => setSelectedPreview(src)}
              className="h-full w-full"
              title="Abrir evidencia"
            >
              {failedPreviews[index] ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 px-3 text-center">
                  <ImageIcon size={20} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500">Vista previa no disponible</span>
                </div>
              ) : (
                <img
                  src={getEvidencePreviewSrc(src)}
                  alt={getEvidenceLabel(src, index)}
                  className="w-full h-full object-cover"
                  onError={() => setFailedPreviews((current) => ({ ...current, [index]: true }))}
                />
              )}
            </button>
            {isDriveEvidence(src) && getEvidenceOpenUrl(src) && (
              <a
                href={getEvidenceOpenUrl(src)}
                target="_blank"
                rel="noreferrer"
                className="absolute left-1 bottom-1 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-white"
              >
                Ver imagen
              </a>
            )}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                removeImage(index);
              }}
              className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-lg opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg"
              title="Quitar evidencia"
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

        <button
          type="button"
          disabled={isUploading}
          title="Hacé clic acá y presioná Ctrl + V para adjuntar una captura"
          className={`aspect-square rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 flex flex-col items-center justify-center gap-1 text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer ${compact ? 'min-h-20' : ''}`}
        >
          <ImageIcon size={24} strokeWidth={1.5} />
          <span className="text-[9px] font-black uppercase tracking-tighter">Pegar captura</span>
          <span className="text-[8px] font-bold text-indigo-400">Ctrl + V</span>
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

      {selectedPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setSelectedPreview(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedPreview(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-slate-900/80 p-2 text-white"
              title="Cerrar"
            >
              <X size={16} />
            </button>

            {typeof selectedPreview === 'string' ? (
              <img
                src={selectedPreview}
                alt="Vista previa de evidencia"
                className="max-h-[90vh] max-w-[90vw] object-contain"
              />
            ) : (
              <div className="flex max-h-[90vh] w-[min(90vw,820px)] flex-col overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">{selectedPreview.name}</p>
                    <p className="mt-1 text-xs text-slate-500">La evidencia está guardada en Drive.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={getEvidenceOpenUrl(selectedPreview)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white"
                    >
                      Abrir imagen
                    </a>
                    {getEvidenceDriveUrl(selectedPreview) && (
                      <a
                        href={getEvidenceDriveUrl(selectedPreview)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700"
                      >
                        Abrir en Drive
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-center bg-slate-100 p-4">
                  <img
                    src={getEvidencePreviewSrc(selectedPreview)}
                    alt={selectedPreview.name || 'Vista previa de evidencia'}
                    className="max-h-[70vh] max-w-[85vw] object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
