import React from 'react';
import { AuditItem, AuditItemDetail } from '../types';
import { Check, MessageSquareText, Paperclip, X } from 'lucide-react';
import { EvidenceUpload } from './EvidenceUpload';

interface Props {
  item: AuditItem;
  score: number | undefined;
  detail: AuditItemDetail;
  onChange: (score: number) => void;
  onDetailChange: (detail: AuditItemDetail) => void;
}

export const AuditRow: React.FC<Props> = ({ item, score, detail, onChange, onDetailChange }) => {
  return (
    <div
      id={`audit-item-${item.id}`}
      className="flex flex-col gap-4 p-5 hover:bg-white/40 transition-colors scroll-mt-24"
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400 border border-indigo-100 italic shrink-0">
              {item.id}
            </span>
            <h3 className="font-bold text-slate-800 text-sm">{item.requisito}</h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed opacity-80">{item.descripcion}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {item.roles.map((role) => (
              <span key={role} className="text-[8px] px-2 py-0.5 rounded-md bg-white/60 text-slate-600 border border-white/40 uppercase font-black tracking-widest">
                {role}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:min-w-[250px]">
          <button
            onClick={() => onChange(1)}
            className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 transition-all font-black text-xs uppercase tracking-tighter ${
              score === 1
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200'
                : 'bg-white/40 border-white/60 text-slate-400 hover:border-emerald-300 hover:text-emerald-600'
            }`}
          >
            <Check size={14} strokeWidth={3} />
            OK
          </button>

          <button
            onClick={() => onChange(0)}
            className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 transition-all font-black text-xs uppercase tracking-tighter ${
              score === 0
                ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200'
                : 'bg-white/40 border-white/60 text-slate-400 hover:border-red-300 hover:text-red-600'
            }`}
          >
            <X size={14} strokeWidth={3} />
            Desvio
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="rounded-2xl border border-white/60 bg-white/35 p-4">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
            <MessageSquareText size={12} />
            Comentario del item
          </label>
          <textarea
            value={detail.comentario}
            onChange={(e) => onDetailChange({ ...detail, comentario: e.target.value })}
            placeholder="Anota observaciones puntuales de esta pregunta..."
            className="glass-input w-full min-h-[92px] resize-none !bg-white/70 text-sm"
          />
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/35 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              <Paperclip size={12} />
              Evidencias del item
            </label>
            <span className="text-[10px] font-bold text-slate-400">{detail.evidencias.length} archivo(s)</span>
          </div>
          <EvidenceUpload
            evidencias={detail.evidencias}
            onChange={(evidencias) => onDetailChange({ ...detail, evidencias })}
            compact
            buttonLabel="Foto"
          />
        </div>
      </div>
    </div>
  );
};
