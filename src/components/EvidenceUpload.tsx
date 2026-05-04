
import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';

interface Props {
  evidencias: string[];
  onChange: (evidencias: string[]) => void;
  compact?: boolean;
  buttonLabel?: string;
}

export const EvidenceUpload: React.FC<Props> = ({ evidencias, onChange, compact = false, buttonLabel = 'Click / Foto' }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          onChange([...evidencias, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    onChange(evidencias.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'}`}>
        {evidencias.map((src, index) => (
          <div key={index} className="relative aspect-square rounded-2xl overflow-hidden group border border-white/60 shadow-sm transition-transform hover:scale-105">
            <img src={src} alt={`Evidencia ${index}`} className="w-full h-full object-cover" />
            <button
              onClick={() => removeImage(index)}
              className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            >
              <X size={12} strokeWidth={4} />
            </button>
          </div>
        ))}
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`aspect-square rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100/40 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-indigo-400 hover:text-indigo-400 hover:bg-white/60 transition-all cursor-pointer ${compact ? 'min-h-20' : ''}`}
        >
          <Camera size={24} strokeWidth={1.5} />
          <span className="text-[9px] font-black uppercase tracking-tighter">{buttonLabel}</span>
        </button>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
