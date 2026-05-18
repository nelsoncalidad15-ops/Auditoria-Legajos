import React, { useEffect, useMemo, useState } from 'react';
import { AuditItem, AuditItemDetail } from '../types';
import { Check, MessageSquareText, Paperclip, X } from 'lucide-react';
import { EvidenceUpload } from './EvidenceUpload';
import { getAffectedRolesForScore } from '../constants';

interface Props {
  item: AuditItem;
  score: number | undefined;
  detail: AuditItemDetail;
  onChange: (score: number) => void;
  onDetailChange: (detail: AuditItemDetail) => void;
}

export const AuditRow: React.FC<Props> = ({ item, score, detail, onChange, onDetailChange }) => {
  const [showDetails, setShowDetails] = useState(false);
  const affectedRoles = useMemo(() => getAffectedRolesForScore(item, score, detail), [detail, item, score]);

  const detailCount = useMemo(() => {
    let count = 0;
    if (detail.comentario.trim()) count += 1;
    if (detail.evidencias.length > 0) count += detail.evidencias.length;
    return count;
  }, [detail]);

  const isOk = score === 1;
  const isDesvio = score === 0;
  const isPending = score === undefined;

  useEffect(() => {
    if (isDesvio && item.roles.length > 1) {
      setShowDetails(true);
    }
  }, [isDesvio, item.roles.length]);

  // Estado visual del número
  const numBg = isOk
    ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-100 shadow-sm'
    : isDesvio
      ? 'bg-red-500 text-white border-red-400 shadow-red-100 shadow-sm'
      : 'bg-slate-100 text-slate-400 border-slate-200';

  // Color de la fila completa según estado
  const rowBg = isOk
    ? 'bg-emerald-50/40 border-l-2 border-l-emerald-400'
    : isDesvio
      ? 'bg-red-50/40 border-l-2 border-l-red-400'
      : isPending
        ? 'border-l-2 border-l-transparent'
        : '';

  return (
    <div id={`audit-item-${item.id}`} className={`scroll-mt-6 transition-colors duration-300 ${rowBg}`}>
      {/* Separador */}
      <div className="mx-4 sm:mx-6 border-t border-slate-100/80 first:border-t-0" />

      <div className="px-4 py-4 sm:px-6 sm:py-5">
        {/* Fila principal */}
        <div className="flex items-center gap-3 sm:gap-4">

          {/* Número con indicador de estado */}
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-black transition-all duration-200 ${numBg}`}>
            {isOk ? <Check size={13} strokeWidth={3.5} /> : isDesvio ? <X size={13} strokeWidth={3.5} /> : item.id}
          </div>

          {/* Contenido central */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h3 className="text-[13px] sm:text-[14px] font-bold text-slate-800 leading-snug">{item.requisito}</h3>
              {item.descripcion && (
                <span className="text-[11px] text-slate-400 leading-snug">{item.descripcion}</span>
              )}
            </div>
            {item.roles.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {item.roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500"
                  >
                    {role}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Botones OK / DESVÍO + Nota */}
          <div className="flex items-center gap-2 shrink-0">
            {/* OK */}
            <button
              onClick={() => onChange(1)}
              title="OK"
              className={`audit-btn flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[12px] font-black uppercase tracking-wide transition-all duration-150 select-none ${
                isOk
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 scale-105'
                  : 'bg-white text-emerald-600 border-2 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 hover:scale-105'
              }`}
            >
              <Check size={14} strokeWidth={3} />
              <span className="hidden sm:inline">OK</span>
            </button>

            {/* DESVÍO */}
            <button
              onClick={() => onChange(0)}
              title="Desvío"
              className={`audit-btn flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[12px] font-black uppercase tracking-wide transition-all duration-150 select-none ${
                isDesvio
                  ? 'bg-red-500 text-white shadow-lg shadow-red-200 scale-105'
                  : 'bg-white text-red-500 border-2 border-red-200 hover:bg-red-50 hover:border-red-300 hover:scale-105'
              }`}
            >
              <X size={14} strokeWidth={3} />
              <span className="hidden sm:inline">Desvío</span>
            </button>

            {/* Nota */}
            <button
              onClick={() => setShowDetails((prev) => !prev)}
              title={showDetails ? 'Ocultar notas' : 'Agregar nota o evidencia'}
              className={`audit-btn relative flex items-center justify-center rounded-xl p-2.5 transition-all duration-150 border-2 ${
                showDetails
                  ? 'bg-slate-700 text-white border-slate-700'
                  : detailCount > 0
                    ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <MessageSquareText size={15} />
              {detailCount > 0 && !showDetails && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-white shadow-sm">
                  {detailCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Panel desplegable */}
        {showDetails && (
          <div className="mt-4 ml-11 grid gap-3 sm:grid-cols-2 animate-in fade-in slide-in-from-top-2 duration-200">
            {isDesvio && item.roles.length > 1 && (
              <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                  Este desvio impacta en
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.roles.map((role) => {
                    const isActive = affectedRoles.includes(role);
                    const nextRoles = isActive
                      ? affectedRoles.filter((currentRole) => currentRole !== role)
                      : [...affectedRoles, role];

                    return (
                      <button
                        key={role}
                        onClick={() =>
                          onDetailChange({
                            ...detail,
                            affectedRoles: nextRoles.length > 0 ? nextRoles : [role],
                          })
                        }
                        className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all ${
                          isActive
                            ? 'border-amber-500 bg-amber-500 text-white'
                            : 'border-amber-200 bg-white text-amber-700'
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-amber-800">
                  Por defecto afecta a todos los sectores vinculados. Acá podés dejarlo solo en el sector que corresponda.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <label className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                <MessageSquareText size={11} />
                Observación
              </label>
              <textarea
                value={detail.comentario}
                onChange={(e) => onDetailChange({ ...detail, comentario: e.target.value })}
                placeholder="Anota observaciones puntuales..."
                rows={3}
                className="glass-input min-h-[80px] w-full resize-none !rounded-xl !bg-slate-50/60 text-[13px] !py-2.5"
              />
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  <Paperclip size={11} />
                  Evidencias
                </label>
                {detail.evidencias.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-700">
                    {detail.evidencias.length} foto(s)
                  </span>
                )}
              </div>
              <EvidenceUpload
                evidencias={detail.evidencias}
                onChange={(evidencias) => onDetailChange({ ...detail, evidencias })}
                compact
                buttonLabel="Agregar foto"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
