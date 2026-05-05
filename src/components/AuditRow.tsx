import React, { useMemo, useState } from 'react';
import { AuditItem, AuditItemDetail } from '../types';
import { Check, ChevronDown, MessageSquareText, Paperclip, X } from 'lucide-react';
import { EvidenceUpload } from './EvidenceUpload';

interface Props {
  item: AuditItem;
  score: number | undefined;
  detail: AuditItemDetail;
  onChange: (score: number) => void;
  onDetailChange: (detail: AuditItemDetail) => void;
}

export const AuditRow: React.FC<Props> = ({ item, score, detail, onChange, onDetailChange }) => {
  const [showDetails, setShowDetails] = useState(false);

  const detailCount = useMemo(() => {
    let count = 0;
    if (detail.comentario.trim()) count += 1;
    if (detail.evidencias.length > 0) count += detail.evidencias.length;
    return count;
  }, [detail]);

  const statusLabel = score === 1 ? 'OK' : score === 0 ? 'Desvio' : 'Pendiente';
  const statusClass =
    score === 1
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : score === 0
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-slate-100 text-slate-500 border-slate-200';

  return (
    <div id={`audit-item-${item.id}`} className="px-4 py-4 sm:px-6 sm:py-5 scroll-mt-24">
      <div className="rounded-[28px] border border-white/70 bg-white/40 shadow-[0_18px_40px_rgba(148,163,184,0.12)]">
        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 text-[10px] font-black text-indigo-500">
                  {item.id}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black text-slate-800">{item.requisito}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">{item.descripcion}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:w-[320px]">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onChange(1)}
                  className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.14em] transition-all ${
                    score === 1
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                      : 'border border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                  OK
                </button>
                <button
                  onClick={() => onChange(0)}
                  className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.14em] transition-all ${
                    score === 0
                      ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                      : 'border border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:text-red-600'
                  }`}
                >
                  <X size={14} strokeWidth={3} />
                  Desvio
                </button>
              </div>

              <button
                onClick={() => setShowDetails((prev) => !prev)}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left transition-all hover:bg-white"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-full bg-white p-2 text-slate-400 shadow-sm">
                    <MessageSquareText size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">Notas y evidencia</p>
                    <p className="text-xs text-slate-400">
                      {detailCount > 0 ? `${detailCount} detalle(s) cargado(s)` : 'Agregar comentario o foto'}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-slate-400 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {showDetails && (
          <div className="grid gap-4 border-t border-white/70 bg-white/30 p-4 sm:p-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-2xl border border-white/70 bg-white/65 p-4">
              <label className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                <MessageSquareText size={12} />
                Comentario del item
              </label>
              <textarea
                value={detail.comentario}
                onChange={(e) => onDetailChange({ ...detail, comentario: e.target.value })}
                placeholder="Anota observaciones puntuales de esta pregunta..."
                className="glass-input min-h-[110px] w-full resize-none !rounded-[20px] !bg-white/80 text-sm"
              />
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/65 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
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
        )}
      </div>
    </div>
  );
};
