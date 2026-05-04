/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  User,
  FileText,
  Download,
  LayoutDashboard,
  CheckCircle2,
  X,
  Building2,
  ListChecks,
  Gauge,
  Link2,
  ClipboardList,
  Camera,
} from 'lucide-react';
import { AUDIT_ITEMS, calculateSummary } from './constants';
import { AuditData, AuditItemDetail } from './types';
import { AuditRow } from './components/AuditRow';
import { EvidenceUpload } from './components/EvidenceUpload';
import { SummaryChart } from './components/SummaryChart';
import { hasGoogleSheetsConfig, saveToSheets, testConnection } from './services/googleSheetsService';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

type BranchName = 'Jujuy' | 'Salta';

type CompletedAudit = {
  id: string;
  timestamp: number;
  sucursal: BranchName;
  legajoNombre: string;
  total: number;
  admin: number;
  preEntrega: number;
  ventas: number;
};

const HISTORY_STORAGE_KEY = 'audit_history';

const createEmptyItemDetail = (): AuditItemDetail => ({
  comentario: '',
  evidencias: [],
});

export default function App() {
  const [sucursal, setSucursal] = useState<BranchName>('Jujuy');
  const [nombre, setNombre] = useState('');
  const [items, setItems] = useState(AUDIT_ITEMS);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [itemDetails, setItemDetails] = useState<Record<number, AuditItemDetail>>({});
  const [evidencias, setEvidencias] = useState<string[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [conclusiones, setConclusiones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [auditHistory, setAuditHistory] = useState<CompletedAudit[]>([]);
  const [newItem, setNewItem] = useState({
    requisito: '',
    description: '',
    roles: [] as string[],
  });

  const summary = useMemo(() => calculateSummary(scores, items), [scores, items]);

  const allItemsAnswered = useMemo(() => {
    return items.every((item) => scores[item.id] !== undefined) && nombre.trim().length > 0;
  }, [scores, nombre, items]);

  const branchStats = useMemo(() => {
    const stats = {
      Jujuy: { count: 0, average: 0, latest: '' },
      Salta: { count: 0, average: 0, latest: '' },
    };

    for (const branch of ['Jujuy', 'Salta'] as BranchName[]) {
      const branchAudits = auditHistory.filter((audit) => audit.sucursal === branch);
      const total = branchAudits.reduce((acc, audit) => acc + audit.total, 0);

      stats[branch] = {
        count: branchAudits.length,
        average: branchAudits.length ? total / branchAudits.length : 0,
        latest: branchAudits[0]?.legajoNombre || '',
      };
    }

    return stats;
  }, [auditHistory]);

  const currentProgress = useMemo(() => {
    const answered = items.filter((item) => scores[item.id] !== undefined).length;
    return {
      answered,
      total: items.length,
      percentage: items.length ? (answered / items.length) * 100 : 0,
    };
  }, [items, scores]);

  const detailedSummary = useMemo(() => {
    return items.map((item) => ({
      item,
      score: scores[item.id],
      detail: itemDetails[item.id] ?? createEmptyItemDetail(),
    }));
  }, [items, scores, itemDetails]);

  const totalAudited = auditHistory.length;

  const handleScoreChange = (id: number, score: number) => {
    setScores((prev) => ({ ...prev, [id]: score }));

    const nextItemIndex = items.findIndex((item) => item.id === id) + 1;
    if (nextItemIndex < items.length) {
      const nextItemId = items[nextItemIndex].id;
      setTimeout(() => {
        const element = document.getElementById(`audit-item-${nextItemId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  };

  const handleItemDetailChange = (itemId: number, detail: AuditItemDetail) => {
    setItemDetails((prev) => ({
      ...prev,
      [itemId]: detail,
    }));
  };

  const addItem = () => {
    if (!newItem.requisito) return;

    const itemToAdd = {
      ...newItem,
      descripcion: newItem.description,
      id: items.length + 1,
    };

    const updatedItems = [...items, itemToAdd];
    setItems(updatedItems);
    setNewItem({ requisito: '', description: '', roles: [] });
    setShowNewItemForm(false);
    localStorage.setItem('audit_items_config', JSON.stringify(updatedItems));
  };

  React.useEffect(() => {
    const savedItems = localStorage.getItem('audit_items_config');
    if (savedItems) {
      try {
        setItems(JSON.parse(savedItems));
      } catch (error) {
        console.error(error);
      }
    }

    const savedDraft = localStorage.getItem('audit_draft');
    if (savedDraft) {
      try {
        const draft: AuditData = JSON.parse(savedDraft);
        setSucursal(draft.sucursal);
        setNombre(draft.legajoNombre);
        setScores(draft.scores);
        setItemDetails(draft.itemDetails ?? {});
        setEvidencias(draft.evidencias);
        setObservaciones(draft.observaciones);
        setConclusiones(draft.conclusiones);
      } catch (error) {
        console.error('Error loading draft', error);
      }
    }

    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory) as CompletedAudit[];
        const sortedHistory = parsedHistory.sort((a, b) => b.timestamp - a.timestamp);
        setAuditHistory(sortedHistory);
      } catch (error) {
        console.error('Error loading audit history', error);
      }
    }

    testConnection().then(setIsOnline);
  }, []);

  React.useEffect(() => {
    const draft: AuditData = {
      timestamp: Date.now(),
      sucursal,
      legajoNombre: nombre,
      scores,
      itemDetails,
      evidencias,
      observaciones,
      conclusiones,
    };

    localStorage.setItem('audit_draft', JSON.stringify(draft));
  }, [sucursal, nombre, scores, itemDetails, evidencias, observaciones, conclusiones]);

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE AUDITORIA DE LEGAJOS', 14, 25);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('CONTROL DE CALIDAD Y ESTANDARES OPERATIVOS', 14, 32);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, pageWidth - 50, 32);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DE LA AUDITORIA', 14, 60);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 62, pageWidth - 14, 62);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Sucursal:', 14, 70);
    doc.setFont('helvetica', 'bold');
    doc.text(sucursal, 45, 70);

    doc.setFont('helvetica', 'normal');
    doc.text('Auditor/Responsable:', 14, 76);
    doc.setFont('helvetica', 'bold');
    doc.text(nombre, 55, 76);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 85, pageWidth - 28, 40, 3, 3, 'F');

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.text('DESEMPENO GENERAL', 20, 92);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(28);
    doc.text(`${summary.total.toFixed(1)}%`, 20, 108);

    const status = summary.total > 85 ? 'OPTIMO' : summary.total > 60 ? 'REGULAR' : 'CRITICO';
    const statusColor = summary.total > 85 ? [16, 185, 129] : summary.total > 60 ? [59, 130, 246] : [239, 68, 68];

    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.setFontSize(14);
    doc.text(status, 20, 118);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.text(`Admin: ${summary.admin.toFixed(0)}%`, 140, 95);
    doc.text(`Pre-Entrega: ${summary.preEntrega.toFixed(0)}%`, 140, 105);
    doc.text(`Ventas: ${summary.ventas.toFixed(0)}%`, 140, 115);

    autoTable(doc, {
      startY: 135,
      head: [['NRO', 'REQUISITO AUDITADO', 'CALIFICACION']],
      body: items.map((item) => [
        item.id,
        item.requisito,
        scores[item.id] === 1 ? 'CUMPLE' : scores[item.id] === 0 ? 'NO CUMPLE' : 'PENDIENTE',
      ]),
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 4 },
    });

    const finalY = doc.lastAutoTable.finalY + 15;

    if (observaciones || conclusiones) {
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('OBSERVACIONES Y CONCLUSIONES', 14, finalY);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, finalY + 2, pageWidth - 14, finalY + 2);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      let currentY = finalY + 10;

      if (observaciones) {
        doc.setFont('helvetica', 'bold');
        doc.text('Bitacora de hallazgos:', 14, currentY);
        doc.setFont('helvetica', 'normal');
        const splitObs = doc.splitTextToSize(observaciones, pageWidth - 28);
        doc.text(splitObs, 14, currentY + 5);
        currentY += splitObs.length * 5 + 12;
      }

      if (conclusiones) {
        doc.setFont('helvetica', 'bold');
        doc.text('Plan de accion / Resolucion gerencial:', 14, currentY);
        doc.setFont('helvetica', 'normal');
        const splitConc = doc.splitTextToSize(conclusiones, pageWidth - 28);
        doc.text(splitConc, 14, currentY + 5);
      }
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.text(`AuditPro v2.1 - Reporte Confidencial - Pagina ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    doc.save(`Auditoria_${sucursal}_${nombre}_${new Date().getTime()}.pdf`);
    setShowPreview(false);
  };

  const resetCurrentForm = () => {
    setNombre('');
    setScores({});
    setItemDetails({});
    setEvidencias([]);
    setObservaciones('');
    setConclusiones('');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const data: AuditData = {
      timestamp: Date.now(),
      sucursal,
      legajoNombre: nombre,
      scores,
      itemDetails,
      evidencias,
      observaciones,
      conclusiones,
    };

    try {
      await saveToSheets(data);

      const historyEntry: CompletedAudit = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: data.timestamp,
        sucursal: data.sucursal,
        legajoNombre: data.legajoNombre,
        total: summary.total,
        admin: summary.admin,
        preEntrega: summary.preEntrega,
        ventas: summary.ventas,
      };

      const nextHistory = [historyEntry, ...auditHistory];
      setAuditHistory(nextHistory);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));

      setShowSuccess(true);
      localStorage.removeItem('audit_draft');
      setTimeout(() => setShowSuccess(false), 3000);
      setTimeout(() => resetCurrentForm(), 3000);
    } catch (err) {
      alert('Error al conectar con Google Sheets. Verifique la configuracion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusLabel = !hasGoogleSheetsConfig
    ? 'SHEET NOT CONFIGURED'
    : isOnline === null
      ? 'CHECKING SYNC...'
      : isOnline
        ? 'SHEET ONLINE'
        : 'SHEET OFFLINE';

  const scoreCards = [
    { label: 'Cumplimiento total', value: summary.total, color: 'text-slate-800' },
    { label: 'Cumplimiento Administracion', value: summary.admin, color: 'text-indigo-600' },
    { label: 'Cumplimiento Pre-entrega', value: summary.preEntrega, color: 'text-emerald-600' },
    { label: 'Cumplimiento Ventas', value: summary.ventas, color: 'text-sky-600' },
  ];

  return (
    <div className="min-h-screen relative overflow-x-hidden font-sans pb-20">
      <div className="fixed top-0 left-0 w-full h-full opacity-20 pointer-events-none -z-10">
        <div className="absolute top-10 left-10 w-64 h-64 bg-blue-400 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-400 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-4 pt-3 sm:pt-4">
        <div className="max-w-6xl mx-auto glass-card flex items-center justify-between gap-3 sm:gap-4 !p-3 sm:!p-4 !rounded-3xl">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-indigo-200 shadow-lg shrink-0">
              A
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-800 uppercase leading-none">Auditores v2.1</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] font-bold">
                <p className="flex items-center gap-1 transition-all">
                  <span className={`w-2 h-2 rounded-full ${isOnline === null ? 'bg-gray-400' : isOnline ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                  {statusLabel}
                </p>
                <span className="text-slate-400">TOTAL AUDITADOS: {totalAudited}</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex bg-slate-200/40 backdrop-blur-sm p-1 rounded-xl shrink-0">
            {(['Jujuy', 'Salta'] as BranchName[]).map((branch) => (
              <button
                key={branch}
                onClick={() => setSucursal(branch)}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${sucursal === branch ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {branch.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex md:hidden">
            <button
              onClick={() => setSucursal(sucursal === 'Jujuy' ? 'Salta' : 'Jujuy')}
              className="px-3 py-1.5 bg-white/60 rounded-lg text-[10px] font-black border border-white/40"
            >
              {sucursal.toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 pt-28 sm:pt-32 space-y-6">
        <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
          <div className="glass-card !p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Legajo actual</label>
                <p className="text-xs text-slate-500 mt-1">Preparado para celular y compu, con carga rapida por item.</p>
              </div>
              <span className="self-start px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-700 text-[10px] font-black uppercase tracking-[0.2em]">
                {sucursal}
              </span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
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

              <div className="rounded-2xl border border-white/60 bg-white/45 px-4 py-3">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  <Link2 size={12} />
                  Google Sheets
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  El link va en <span className="font-black">`.env.local`</span> con la clave <span className="font-black">`VITE_GOOGLE_APPS_SCRIPT_URL`</span>.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(['Jujuy', 'Salta'] as BranchName[]).map((branch) => (
              <div
                key={branch}
                className={`glass-card !p-4 ${sucursal === branch ? 'ring-2 ring-indigo-300/70 bg-white/55' : ''}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={15} className="text-indigo-500" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{branch}</p>
                </div>
                <p className="text-3xl font-black text-slate-800 leading-none">{branchStats[branch].count}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Promedio: <span className="font-black text-slate-700">{branchStats[branch].average.toFixed(1)}%</span>
                </p>
                <p className="mt-1 text-xs text-slate-400 truncate">
                  {branchStats[branch].latest ? `Ultimo: ${branchStats[branch].latest}` : 'Sin auditorias aun'}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {scoreCards.map((card) => (
            <div key={card.label} className="glass-card !p-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.16em] leading-tight">{card.label}</p>
              <p className={`mt-2 text-2xl sm:text-3xl font-black ${card.color}`}>{card.value.toFixed(0)}%</p>
            </div>
          ))}
        </section>

        <section className="glass-card !p-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-white/40 bg-white/20 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <ListChecks size={16} className="text-indigo-500" />
              <div>
                <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest">Puntos de control</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {currentProgress.answered} de {currentProgress.total} respondidos en {sucursal}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowNewItemForm(!showNewItemForm)}
                className="px-3 py-2 bg-indigo-500 text-white rounded-lg text-[10px] font-bold shadow-sm"
              >
                {showNewItemForm ? 'CANCELAR' : '+ AGREGAR'}
              </button>
              <div className="flex gap-1 items-center">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`w-1.5 h-1.5 rounded-full ${scores[item.id] !== undefined ? 'bg-indigo-500' : 'bg-slate-300'}`}
                  />
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
                      onChange={(e) => setNewItem({ ...newItem, requisito: e.target.value })}
                    />
                    <input
                      placeholder="Descripcion breve..."
                      className="glass-input !bg-white"
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Ventas', 'Admin', 'Pre-Entrega'].map((role) => (
                      <button
                        key={role}
                        onClick={() => {
                          const roles = newItem.roles.includes(role)
                            ? newItem.roles.filter((existingRole) => existingRole !== role)
                            : [...newItem.roles, role];
                          setNewItem({ ...newItem, roles });
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
                    GUARDAR ITEM
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="divide-y divide-white/20">
            {items.map((item) => (
              <AuditRow
                key={item.id}
                item={item}
                score={scores[item.id]}
                detail={itemDetails[item.id] ?? createEmptyItemDetail()}
                onChange={(score) => handleScoreChange(item.id, score)}
                onDetailChange={(detail) => handleItemDetailChange(item.id, detail)}
              />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
          <section className="glass-card">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <FileText size={14} className="text-indigo-500" />
              Evidencia general y notas
            </h3>
            <div className="space-y-4">
              <EvidenceUpload evidencias={evidencias} onChange={setEvidencias} buttonLabel="Foto general" />
              <textarea
                placeholder="Anadir nota tecnica o desvio general del legajo..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="glass-input w-full min-h-[100px] resize-none pb-4"
              />
            </div>
          </section>

          <section className="glass-card">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Resumen del legajo</p>
                <h3 className="text-lg font-black text-slate-800 mt-1">{nombre || 'Sin legajo cargado'}</h3>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Avance</p>
                <p className="text-2xl font-black text-slate-800">{currentProgress.answered}/{currentProgress.total}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {scoreCards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-white/60 bg-white/60 p-3">
                  <p className="text-[9px] font-black text-slate-400 uppercase leading-tight">{card.label}</p>
                  <p className={`mt-2 text-xl font-black ${card.color}`}>{card.value.toFixed(0)}%</p>
                </div>
              ))}
            </div>

            <SummaryChart summary={summary} />
          </section>
        </section>

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <button
            onClick={() => setShowPreview(true)}
            disabled={!nombre}
            className="flex-1 px-8 py-4 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl font-bold text-slate-600 shadow-sm hover:bg-white hover:text-slate-900 transition-all flex items-center justify-center gap-2 group"
          >
            <LayoutDashboard size={18} className="group-hover:scale-110 transition-transform" />
            Vista previa del detalle
          </button>

          <button
            onClick={handleSubmit}
            disabled={!allItemsAnswered || isSubmitting}
            className="flex-1 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all relative overflow-hidden"
          >
            {isSubmitting ? 'Procesando...' : 'Finalizar auditoria'}
            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  className="absolute inset-0 bg-emerald-500 flex items-center justify-center gap-2"
                  initial={{ y: 50 }}
                  animate={{ y: 0 }}
                >
                  <CheckCircle2 size={20} /> LISTO
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </main>

      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-5xl max-h-[92vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h2 className="font-black text-slate-800 uppercase tracking-tighter text-lg sm:text-xl">Resumen detallado del legajo</h2>
                <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-8 bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]">
                <div className="border-l-4 border-indigo-600 pl-6 py-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">{nombre}</h3>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <span>Sucursal: {sucursal}</span>
                    <span>Fecha: {new Date().toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {scoreCards.map((card) => (
                    <div key={card.label} className="bg-white/85 p-4 rounded-2xl border border-white/40 shadow-sm">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 leading-tight">{card.label}</p>
                      <p className={`text-2xl font-black ${card.color}`}>{card.value.toFixed(0)}%</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
                  <div className="glass-card !bg-white/55 !p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4">Grafico de cumplimiento</p>
                    <SummaryChart summary={summary} />
                  </div>

                  <div className="glass-card !bg-white/55 !p-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Conclusiones finales</label>
                    <textarea
                      value={conclusiones}
                      onChange={(e) => setConclusiones(e.target.value)}
                      placeholder="Redacte aqui las conclusiones finales para el auditado..."
                      className="w-full p-4 glass-input !bg-white/80 min-h-[180px] font-medium leading-relaxed"
                    />
                  </div>
                </div>

                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-indigo-500" />
                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-[0.18em]">Detalle por pregunta</h4>
                  </div>

                  <div className="space-y-4">
                    {detailedSummary.map(({ item, score, detail }) => (
                      <div key={item.id} className="bg-white/85 rounded-2xl border border-white/50 shadow-sm p-4 sm:p-5">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400 border border-indigo-100">
                                {item.id}
                              </span>
                              <h5 className="font-black text-slate-800">{item.requisito}</h5>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">{item.descripcion}</p>
                          </div>

                          <span className={`self-start px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] ${
                            score === 1
                              ? 'bg-emerald-100 text-emerald-700'
                              : score === 0
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-500'
                          }`}>
                            {score === 1 ? 'OK' : score === 0 ? 'DESVIO' : 'PENDIENTE'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4 mt-4">
                          <div className="rounded-2xl bg-slate-50/80 border border-slate-200/60 p-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Comentario</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {detail.comentario || 'Sin comentario para este punto.'}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-slate-50/80 border border-slate-200/60 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Camera size={13} className="text-slate-400" />
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                Evidencias ({detail.evidencias.length})
                              </p>
                            </div>
                            {detail.evidencias.length > 0 ? (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {detail.evidencias.map((src, index) => (
                                  <img
                                    key={`${item.id}-${index}`}
                                    src={src}
                                    alt={`Evidencia ${item.id}-${index + 1}`}
                                    className="aspect-square rounded-xl object-cover border border-white/60"
                                  />
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">Sin fotos cargadas para este punto.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="p-5 sm:p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 py-4 font-bold text-slate-500 hover:text-slate-900"
                >
                  Volver a editar
                </button>
                <button
                  onClick={generatePDF}
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  <Download size={18} /> DESCARGAR PDF FINAL
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-12 text-center opacity-40">
        <p className="text-[10px] font-black tracking-[0.3em] uppercase">Built for Quality Control and Standards</p>
      </footer>
    </div>
  );
}
