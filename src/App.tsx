/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardCheck, 
  MapPin, 
  User, 
  FileText, 
  Send, 
  Download, 
  Trash2, 
  LayoutDashboard,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AUDIT_ITEMS, calculateSummary } from './constants';
import { AuditData, AuditSummary } from './types';
import { AuditRow } from './components/AuditRow';
import { EvidenceUpload } from './components/EvidenceUpload';
import { saveToSheets, testConnection } from './services/googleSheetsService';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export default function App() {
  const [sucursal, setSucursal] = useState<'Jujuy' | 'Salta'>('Jujuy');
  const [nombre, setNombre] = useState('');
  const [items, setItems] = useState(AUDIT_ITEMS);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [evidencias, setEvidencias] = useState<string[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  
  // New Item State
  const [newItem, setNewItem] = useState({
    requisito: '',
    description: '',
    roles: [] as string[]
  });

  const summary = useMemo(() => calculateSummary(scores, items), [scores, items]);

  const allItemsAnswered = useMemo(() => {
    return items.every(item => scores[item.id] !== undefined) && nombre.trim().length > 0;
  }, [scores, nombre, items]);

  const handleScoreChange = (id: number, score: number) => {
    setScores(prev => ({ ...prev, [id]: score }));
  };

  const addItem = () => {
    if (!newItem.requisito) return;
    const itemToAdd = {
      ...newItem,
      descripcion: newItem.description,
      id: items.length + 1
    };
    const updatedItems = [...items, itemToAdd];
    setItems(updatedItems);
    setNewItem({ requisito: '', description: '', roles: [] });
    setShowNewItemForm(false);
    localStorage.setItem('audit_items_config', JSON.stringify(updatedItems));
  };

  // Load items and test connection
  React.useEffect(() => {
    const saved = localStorage.getItem('audit_items_config');
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading items", e);
      }
    }
    
    testConnection().then(setIsOnline);
  }, []);

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(31, 41, 55); // Gray 800
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('REPORTE DE AUDITORÍA', 14, 20);
    doc.setFontSize(10);
    doc.text(`Sucursal: ${sucursal} | Fecha: ${new Date().toLocaleDateString()}`, 14, 30);

    // Meta Info
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Legajo: ${nombre}`, 14, 50);

    // Summary Cards
    doc.autoTable({
      startY: 60,
      head: [['Categoría', 'Cumplimiento']],
      body: [
        ['Administración', `${summary.admin.toFixed(1)}%`],
        ['Pre-entrega', `${summary.preEntrega.toFixed(1)}%`],
        ['Ventas', `${summary.ventas.toFixed(1)}%`],
        ['TOTAL GENERAL', `${summary.total.toFixed(1)}%`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }, // Blue 500
    });

    // Details Table
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Nro', 'Requisito', 'Estado']],
      body: items.map(item => [
        item.id,
        item.requisito,
        scores[item.id] === 1 ? 'CUMPLE' : 'NO CUMPLE'
      ]),
      columnStyles: {
        2: { cellPadding: 2, fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && (data.column as any).index === 2) {
          data.cell.styles.textColor = data.cell.text[0] === 'CUMPLE' ? [21, 128, 61] : [185, 28, 28];
        }
      }
    });

    if (observaciones) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Observaciones:', 14, doc.lastAutoTable.finalY + 10);
      doc.text(observaciones, 14, doc.lastAutoTable.finalY + 15, { maxWidth: 180 });
    }

    doc.save(`Auditoria_${sucursal}_${nombre}_${new Date().getTime()}.pdf`);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const data: AuditData = {
      timestamp: Date.now(),
      sucursal,
      legajoNombre: nombre,
      scores,
      evidencias,
      observaciones
    };

    try {
      await saveToSheets(data);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      // Reset after 3 seconds
      setTimeout(() => {
        setNombre('');
        setScores({});
        setEvidencias([]);
        setObservaciones('');
      }, 3000);
    } catch (err) {
      alert("Error al conectar con Google Sheets. Verifique la configuración.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden font-sans pb-20">
      {/* Background Blobs */}
      <div className="fixed top-0 left-0 w-full h-full opacity-20 pointer-events-none -z-10">
        <div className="absolute top-10 left-10 w-64 h-64 bg-blue-400 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-400 rounded-full blur-[120px] animate-pulse delay-700"></div>
      </div>

      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-4">
        <div className="max-w-5xl mx-auto glass-card flex items-center justify-between !p-4 !rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-indigo-200 shadow-lg">
              A
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-800 uppercase leading-none">Auditores v2.1</h1>
              <p className="text-[10px] font-bold flex items-center gap-1 mt-1 transition-all">
                <span className={`w-2 h-2 rounded-full ${isOnline === null ? 'bg-gray-400' : isOnline ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></span> 
                {isOnline === null ? 'CHECKING SYNC...' : isOnline ? 'SHEET ONLINE' : 'SHEET OFFLINE'}
              </p>
            </div>
          </div>
          
          <div className="hidden md:flex bg-slate-200/40 backdrop-blur-sm p-1 rounded-xl">
            <button 
              onClick={() => setSucursal('Jujuy')}
              className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${sucursal === 'Jujuy' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              JUJUY
            </button>
            <button 
              onClick={() => setSucursal('Salta')}
              className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${sucursal === 'Salta' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              SALTA
            </button>
          </div>

          <div className="flex md:hidden">
            <button 
              onClick={() => setSucursal(sucursal === 'Jujuy' ? 'Salta' : 'Jujuy')}
              className="px-3 py-1 bg-white/60 rounded-lg text-[10px] font-black border border-white/40"
            >
              {sucursal.toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-28 space-y-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar / Profile */}
          <aside className="lg:col-span-4 space-y-6">
            <section className="glass-card !p-5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Legajo a Auditar</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Nombre de la persona..."
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="glass-input w-full pl-11 !bg-white/60"
                />
              </div>
            </section>

            {/* Stats Dashboard */}
            <section className="glass-card !p-5 space-y-4">
               <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <LayoutDashboard size={14} className="text-indigo-500" />
                Cumplimiento
               </h2>
               <div className="grid grid-cols-2 gap-3">
                 {[
                   { label: 'Admin', val: summary.admin, color: 'text-indigo-600' },
                   { label: 'Entrega', val: summary.preEntrega, color: 'text-emerald-600' },
                   { label: 'Ventas', val: summary.ventas, color: 'text-indigo-600' },
                   { label: 'Total', val: summary.total, color: 'text-slate-800' }
                 ].map(s => (
                   <div key={s.label} className="bg-white/50 p-3 rounded-2xl border border-white/40">
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">{s.label}</p>
                     <p className={`text-xl font-black ${s.color}`}>{s.val.toFixed(0)}%</p>
                   </div>
                 ))}
               </div>
            </section>
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-8 space-y-6">
            <section className="glass-card !p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/40 bg-white/20 flex items-center justify-between">
                <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest">Puntos de Control</h2>
                <div className="flex gap-2">
                   <button 
                    onClick={() => setShowNewItemForm(!showNewItemForm)}
                    className="px-2 py-1 bg-indigo-500 text-white rounded-lg text-[10px] font-bold shadow-sm"
                   >
                     {showNewItemForm ? 'CANCELAR' : '+ AGREGAR'}
                   </button>
                   <div className="flex gap-1 items-center">
                      {items.map((item, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${scores[item.id] !== undefined ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                      ))}
                   </div>
                </div>
              </div>

              <AnimatePresence>
                {showNewItemForm && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-6 bg-indigo-50/50 border-b border-indigo-100 overflow-hidden"
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input
                          placeholder="Nombre del requisito (ej: Contrato)"
                          className="glass-input !bg-white"
                          value={newItem.requisito}
                          onChange={e => setNewItem({...newItem, requisito: e.target.value})}
                        />
                        <input
                          placeholder="Descripción breve..."
                          className="glass-input !bg-white"
                          value={newItem.descripcion}
                          onChange={e => setNewItem({...newItem, descripcion: e.target.value})}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {['Ventas', 'Admin', 'Pre-Entrega'].map(role => (
                          <button
                            key={role}
                            onClick={() => {
                              const roles = newItem.roles.includes(role) 
                                ? newItem.roles.filter(r => r !== role)
                                : [...newItem.roles, role];
                              setNewItem({...newItem, roles});
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                              newItem.roles.includes(role)
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-white border-slate-200 text-slate-400'
                            }`}
                          >
                            {role.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <button 
                        onClick={addItem}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md"
                      >
                        GUARDAR ÍTEM
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="divide-y divide-white/20">
                {items.map(item => (
                  <AuditRow 
                    key={item.id} 
                    item={item} 
                    score={scores[item.id]} 
                    onChange={(s) => handleScoreChange(item.id, s)} 
                  />
                ))}
              </div>
            </section>

            {/* Evidences */}
            <section className="glass-card">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <FileText size={14} className="text-indigo-500" />
                Auditoría Multimedia & Notas
              </h3>
              <div className="space-y-4">
                <EvidenceUpload evidencias={evidencias} onChange={setEvidencias} />
                <textarea
                  placeholder="Añadir nota técnica o desvío encontrado..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="glass-input w-full min-h-[100px] resize-none pb-4"
                />
              </div>
            </section>

            {/* Final Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button
                onClick={generatePDF}
                disabled={!nombre}
                className="flex-1 px-8 py-4 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl font-bold text-slate-600 shadow-sm hover:bg-white hover:text-slate-900 transition-all flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Exportar Reporte
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={!allItemsAnswered || isSubmitting}
                className="flex-1 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all relative overflow-hidden"
              >
                {isSubmitting ? 'Procesando...' : 'Finalizar Auditoría'}
                <AnimatePresence>
                  {showSuccess && (
                     <motion.div 
                      className="absolute inset-0 bg-emerald-500 flex items-center justify-center gap-2"
                      initial={{ y: 50 }} animate={{ y: 0 }}
                     >
                        <CheckCircle2 size={20} /> ¡LISTO!
                     </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-12 text-center opacity-40">
        <p className="text-[10px] font-black tracking-[0.3em] uppercase">Built for Quality Control & Standards</p>
      </footer>
    </div>
  );
}

