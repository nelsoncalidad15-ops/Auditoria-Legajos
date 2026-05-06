import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Filter, 
  Search, 
  GraduationCap, 
  TrendingUp, 
  Award, 
  Globe2,
  RefreshCw
} from 'lucide-react';
import { useFormacionData, CourseRecord } from '../services/formacionService';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export function FormacionDashboard() {
  const { data, colaboradores, loading, error } = useFormacionData();

  // Filters state
  const [filters, setFilters] = useState({
    provincia: 'Todas',
    ano: '2025',
    mes: 'diciembre',
    colaborador: 'Todas',
    rutaAprendizaje: 'Todas',
    fase: 'Todas',
    estado: 'Todas'
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Extract unique values for filters
  const filterOptions = useMemo(() => {
    if (!data.length) return {
      provincias: [], colaboradores: [], rutas: [], fases: [], estados: []
    };
    return {
      provincias: Array.from(new Set(data.map(d => d.unidad).filter(Boolean))).sort(),
      colaboradores: Array.from(new Set(data.map(d => d.colaborador).filter(Boolean))).sort(),
      rutas: Array.from(new Set(data.map(d => d.rutaAprendizaje).filter(Boolean))).sort(),
      fases: Array.from(new Set(data.map(d => d.fase).filter(Boolean))).sort(),
      estados: Array.from(new Set(data.map(d => d.estado).filter(Boolean))).sort()
    };
  }, [data]);

  // Apply filters
  const filteredData = useMemo(() => {
    return data.filter(d => {
      if (filters.provincia !== 'Todas' && !d.unidad.includes(filters.provincia)) return false;
      if (filters.colaborador !== 'Todas' && d.colaborador !== filters.colaborador) return false;
      if (filters.rutaAprendizaje !== 'Todas' && d.rutaAprendizaje !== filters.rutaAprendizaje) return false;
      if (filters.fase !== 'Todas' && d.fase !== filters.fase) return false;
      if (filters.estado !== 'Todas' && d.estado !== filters.estado) return false;
      return true;
    });
  }, [data, filters]);

  // Derived KPIs
  const filteredColaboradores = useMemo(() => {
    const colabsInFiltered = new Set(filteredData.map(d => d.colaborador));
    return colaboradores.filter(c => colabsInFiltered.has(c.colaborador));
  }, [filteredData, colaboradores]);

  const indiceCualificacion = useMemo(() => {
    if (filteredColaboradores.length === 0) return 0;
    const sum = filteredColaboradores.reduce((acc, c) => acc + c.icf, 0);
    return sum / filteredColaboradores.length;
  }, [filteredColaboradores]);

  // Gauges Data
  const getAreaScore = (areaPattern: string) => {
    const cols = filteredColaboradores.filter(c => c.area.toLowerCase().includes(areaPattern.toLowerCase()));
    if (cols.length === 0) return 0;
    return cols.reduce((acc, c) => acc + c.icf, 0) / cols.length;
  };

  const areaServicioRepuesto = getAreaScore('Servicio & Repuestos');
  const areaTecnica = getAreaScore('Técnico');
  const areaVentas = getAreaScore('Ventas');

  // Tables Data
  const functionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    filteredColaboradores.forEach(c => {
      counts.set(c.funcion, (counts.get(c.funcion) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredColaboradores]);

  const totalDeclarados = filteredColaboradores.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-slate-500 font-medium uppercase tracking-widest text-xs">Cargando indicadores...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="p-6 bg-red-50 text-red-600 rounded-2xl border border-red-200 shadow-sm max-w-md text-center">
          <h3 className="font-bold text-lg mb-2">Error</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header and Filters */}
      <section className="glass-card !p-5 overflow-visible">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white shrink-0">
              <GraduationCap size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Formación</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Indicadores de RRHH</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <FilterSelect label="Provincia" value={filters.provincia} onChange={v => handleFilterChange('provincia', v)} options={['Todas', 'Salta', 'Jujuy']} />
            <FilterSelect label="Año" value={filters.ano} onChange={v => handleFilterChange('ano', v)} options={['2025', '2026']} />
            <FilterSelect label="Mes" value={filters.mes} onChange={v => handleFilterChange('mes', v)} options={['diciembre', 'enero', 'febrero']} />
            <FilterSelect label="Colaborador" value={filters.colaborador} onChange={v => handleFilterChange('colaborador', v)} options={['Todas', ...filterOptions.colaboradores]} />
            <FilterSelect label="Ruta de aprendizaje" value={filters.rutaAprendizaje} onChange={v => handleFilterChange('rutaAprendizaje', v)} options={['Todas', ...filterOptions.rutas]} />
            <FilterSelect label="Fase" value={filters.fase} onChange={v => handleFilterChange('fase', v)} options={['Todas', ...filterOptions.fases]} />
            <FilterSelect label="Estado" value={filters.estado} onChange={v => handleFilterChange('estado', v)} options={['Todas', ...filterOptions.estados]} />
          </div>
        </div>
      </section>

      {/* KPIs & Gauges */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main KPIs Box */}
        <div className="lg:col-span-5 grid grid-cols-3 gap-4">
          <div className="rounded-[24px] bg-gradient-to-b from-sky-400 to-sky-500 p-5 flex flex-col justify-center items-center text-white shadow-xl shadow-sky-500/20 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform"><Award size={80}/></div>
            <p className="text-[11px] font-black uppercase tracking-widest text-sky-100 mb-2 relative z-10 text-center">Puesto en Ranking</p>
            <p className="text-5xl font-black relative z-10">24</p>
          </div>
          
          <div className="rounded-[24px] bg-gradient-to-b from-indigo-500 to-indigo-600 p-5 flex flex-col justify-center items-center text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp size={80}/></div>
            <p className="text-[11px] font-black uppercase tracking-widest text-indigo-100 mb-2 relative z-10 text-center">Índice de Cualificación</p>
            <p className="text-3xl font-black relative z-10">{indiceCualificacion.toFixed(2)}%</p>
          </div>

          <div className="rounded-[24px] bg-slate-100 border border-slate-200 p-5 flex flex-col justify-center items-center text-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center mb-3"><Globe2 size={16}/></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 text-center">Media pais</p>
            <p className="text-2xl font-black">90.54 %</p>
          </div>
        </div>

        {/* Gauges Box */}
        <div className="lg:col-span-7 glass-card p-5 grid grid-cols-3 gap-4">
          <Gauge value={areaServicioRepuesto} label="Índice Área Servicio y Repuesto" color="#3b82f6" />
          <Gauge value={areaTecnica} label="Índice Área Técnica" color="#0ea5e9" />
          <Gauge value={areaVentas} label="Índice Área Ventas" color="#6366f1" />
        </div>
      </section>

      {/* Top Tables Container */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Table 1 */}
        <div className="glass-card !p-0 overflow-hidden flex flex-col h-[400px]">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex justify-between items-center">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Función vs Declarados</h3>
            <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">Total: {totalDeclarados}</span>
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100">Función</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 text-right">Total Declarados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {functionCounts.map(([func, count]) => (
                  <tr key={func} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-xs font-semibold text-slate-700">{func || 'Sin definir'}</td>
                    <td className="px-5 py-3 text-sm font-black text-slate-900 text-right">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2 */}
        <div className="glass-card !p-0 overflow-hidden flex flex-col h-[400px]">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Colaboradores e ICF</h3>
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100">Función</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 text-right">ICF</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100">Colaborador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredColaboradores.map(c => (
                  <tr key={c.colaborador} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-xs text-slate-500 w-1/3">{c.funcion}</td>
                    <td className="px-5 py-3 text-sm font-black text-slate-900 text-right">{c.icf.toFixed(2)}</td>
                    <td className="px-5 py-3 text-xs font-bold text-slate-700">{c.colaborador}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Main Table */}
      <section className="glass-card !p-0 overflow-hidden flex flex-col max-h-[600px]">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Detalle de Formación</h3>
        </div>
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100">Colaborador</th>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 text-right">ICF</th>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100">Función</th>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100">Ruta de aprendizaje</th>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100">Fase</th>
                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.slice(0, 500).map((row, i) => ( // Limiting to 500 to avoid performance issues if large
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-2.5 text-xs font-bold text-slate-700 whitespace-nowrap">{row.colaborador}</td>
                  <td className="px-5 py-2.5 text-xs font-black text-slate-900 text-right">{row.icf.toFixed(2)}</td>
                  <td className="px-5 py-2.5 text-[11px] text-slate-500">{row.funcion}</td>
                  <td className="px-5 py-2.5 text-xs text-slate-600">{row.rutaAprendizaje}</td>
                  <td className="px-5 py-2.5 text-[11px] text-slate-500">{row.fase}</td>
                  <td className="px-5 py-2.5 text-xs">
                    <span className={`px-2.5 py-1 rounded-md font-bold uppercase tracking-wider text-[9px] ${
                      row.estado === 'Aprobado' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : row.estado === 'Desaprobado'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}>
                      {row.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}

// Subcomponents

function FilterSelect({ label, value, onChange, options }: { label: string, value: string, onChange: (v: string) => void, options: string[] }) {
  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">{label}</label>
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)}
        className="w-full text-xs font-medium bg-white/60 border border-slate-200/60 rounded-xl px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all shadow-sm appearance-none cursor-pointer hover:bg-white"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2364748b\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function Gauge({ value, label, color }: { value: number, label: string, color: string }) {
  const data = [
    { name: 'Value', value: value },
    { name: 'Empty', value: 100 - value },
  ];

  return (
    <div className="flex flex-col items-center justify-center p-2 relative">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center h-8 flex items-end justify-center mb-2">{label}</p>
      <div className="w-full h-[100px] relative flex justify-center items-end">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              startAngle={180}
              endAngle={0}
              innerRadius={60}
              outerRadius={80}
              dataKey="value"
              stroke="none"
              cornerRadius={40}
            >
              <Cell key="cell-0" fill={color} />
              <Cell key="cell-1" fill="#f1f5f9" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute bottom-2 w-full flex justify-between px-6 text-[9px] font-bold text-slate-400">
          <span>0,00 %</span>
          <span>100,00 %</span>
        </div>
        <div className="absolute top-[45px] left-0 w-full text-center">
          <p className="text-2xl font-black text-slate-800">{value.toFixed(2)} %</p>
        </div>
      </div>
    </div>
  );
}
