
import React from 'react';
import { AuditItem } from '../types';
import { Check, X } from 'lucide-react';

interface Props {
  item: AuditItem;
  score: number | undefined;
  onChange: (score: number) => void;
}

export const AuditRow: React.FC<Props> = ({ item, score, onChange }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-white/40 transition-colors gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400 border border-indigo-100 italic">
            {item.id}
          </span>
          <h3 className="font-bold text-slate-800 text-sm">{item.requisito}</h3>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed opacity-80">{item.descripcion}</p>
        <div className="flex gap-1.5 mt-3">
          {item.roles.map(role => (
            <span key={role} className="text-[8px] px-2 py-0.5 rounded-md bg-white/60 text-slate-600 border border-white/40 uppercase font-black tracking-widest">
              {role}
            </span>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:self-center">
        <button
          onClick={() => onChange(1)}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 transition-all font-black text-xs uppercase tracking-tighter ${
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
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 transition-all font-black text-xs uppercase tracking-tighter ${
            score === 0 
              ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200' 
              : 'bg-white/40 border-white/60 text-slate-400 hover:border-red-300 hover:text-red-600'
          }`}
        >
          <X size={14} strokeWidth={3} />
          Desvío
        </button>
      </div>
    </div>
  );
};
