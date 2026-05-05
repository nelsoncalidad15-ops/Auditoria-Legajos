/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ArrowLeft,
  Building2,
  Camera,
  ClipboardList,
  Download,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Plus,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { AUDIT_ITEMS, calculateSummary } from './constants';
import { AuditData, AuditItem, AuditItemDetail, AuditSession, BranchName, LegajoRecord, LegajoStatus } from './types';
import { AuditRow } from './components/AuditRow';
import { SummaryChart } from './components/SummaryChart';
import {
  hasGoogleSheetsConfig,
  loadSessionsSnapshot,
  loadQuestionsConfig,
  saveQuestionsConfig,
  saveSessionsSnapshot,
  saveToSheets,
  testConnection,
} from './services/googleSheetsService';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

type MainTab = 'auditorias' | 'preguntas';

const SESSIONS_STORAGE_KEY = 'audit_sessions_v3';
const ITEMS_STORAGE_KEY = 'audit_items_config';

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyItemDetail = (): AuditItemDetail => ({
  comentario: '',
  evidencias: [],
});

const createEmptyLegajo = (nombre: string): LegajoRecord => ({
  id: createId(),
  nombre,
  status: 'pendiente',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  scores: {},
  itemDetails: {},
  evidencias: [],
  observaciones: '',
  conclusiones: '',
});

const sortSessionsByUpdatedAt = (sessions: AuditSession[]) =>
  [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

const pickInitialSessionId = (sessions: AuditSession[]) =>
  sortSessionsByUpdatedAt(sessions).find((session) => session.status === 'en_curso')?.id ?? null;

const isCompactMobileViewport = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

export default function App() {
  const [mainTab, setMainTab] = useState<MainTab>('auditorias');
  const [items, setItems] = useState<AuditItem[]>(AUDIT_ITEMS);
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedLegajoId, setSelectedLegajoId] = useState<string | null>(null);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCreateLegajo, setShowCreateLegajo] = useState(false);
  const [showQuestionsForm, setShowQuestionsForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);
  const [isSyncingSessions, setIsSyncingSessions] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [newSession, setNewSession] = useState({
    nombre: '',
    auditor: '',
    sucursal: 'Jujuy' as BranchName,
    objetivo: 10,
  });
  const [newLegajoNombre, setNewLegajoNombre] = useState('');
  const [newItem, setNewItem] = useState({
    requisito: '',
    description: '',
    roles: [] as string[],
  });

  const hydrateSharedData = React.useCallback((localSessionsSnapshot: AuditSession[] = []) => {
    const savedItems = localStorage.getItem(ITEMS_STORAGE_KEY);
    if (savedItems) {
      try {
        setItems(JSON.parse(savedItems));
      } catch (error) {
        console.error(error);
      }
    }

    const savedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions) as AuditSession[];
        localSessionsSnapshot = parsed;
        const sorted = sortSessionsByUpdatedAt(parsed);
        setSessions(sorted);
        setSelectedSessionId(null);
      } catch (error) {
        console.error(error);
      }
    }

    loadQuestionsConfig().then((remoteItems) => {
      if (remoteItems && remoteItems.length > 0) {
        setItems(remoteItems);
        localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(remoteItems));
        return;
      }

      setSyncMessage((current) => current || 'Sincronizacion activa, pero la configuracion remota de preguntas esta vacia.');
    });

    loadSessionsSnapshot().then((remoteSessions) => {
      if (remoteSessions && remoteSessions.length > 0) {
        const sorted = sortSessionsByUpdatedAt(remoteSessions);
        setSessions(sorted);
        setSelectedSessionId(null);
        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sorted));
        setSyncMessage('');
        return;
      }

      if (hasGoogleSheetsConfig && localSessionsSnapshot.length > 0) {
        saveSessionsSnapshot(sortSessionsByUpdatedAt(localSessionsSnapshot)).catch((error) => {
          console.error(error);
        });
        setSyncMessage('No se encontro un snapshot remoto; se mantuvo el avance local de esta computadora.');
        return;
      }

      setSyncMessage('La conexion con Google Sheets responde, pero no devolvio sesiones compartidas para mostrar.');
    }).catch((error) => {
      console.error(error);
      setSyncMessage('No se pudieron leer las sesiones compartidas desde Google Sheets.');
    });

    testConnection().then((status) => {
      setIsOnline(status);
      if (!status) {
        setSyncMessage('No se pudo validar la sincronizacion con Google Sheets.');
      }
    });
  }, []);

  React.useEffect(() => {
    hydrateSharedData();
  }, []);

  const persistSessions = (nextSessions: AuditSession[]) => {
    const sorted = sortSessionsByUpdatedAt(nextSessions);
    setSessions(sorted);
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sorted));

    if (!hasGoogleSheetsConfig) return;

    setIsSyncingSessions(true);
    saveSessionsSnapshot(sorted)
      .then(() => {
        setSyncMessage('');
      })
      .catch((error) => {
        console.error(error);
        setSyncMessage('No se pudo guardar el avance compartido en Google Sheets. El cambio quedo local en esta computadora.');
      })
      .finally(() => {
        setIsSyncingSessions(false);
      });
  };

  const persistItems = (nextItems: AuditItem[]) => {
    setItems(nextItems);
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(nextItems));
  };

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const featuredSession = useMemo(() => sessions[0] ?? null, [sessions]);

  const selectedLegajo = useMemo(
    () => selectedSession?.legajos.find((legajo) => legajo.id === selectedLegajoId) ?? null,
    [selectedSession, selectedLegajoId],
  );

  const summary = useMemo(() => {
    if (!selectedLegajo) {
      return { total: 0, admin: 0, preEntrega: 0, ventas: 0 };
    }
    return calculateSummary(selectedLegajo.scores, items);
  }, [selectedLegajo, items]);

  const sessionLegajosWithSummary = useMemo(() => {
    if (!selectedSession) return [];
    return selectedSession.legajos.map((legajo) => ({
      ...legajo,
      summary: calculateSummary(legajo.scores, items),
      answered: items.filter((item) => legajo.scores[item.id] !== undefined).length,
      desvioItems: items.filter((item) => legajo.scores[item.id] === 0),
      commentedItems: (Object.values(legajo.itemDetails) as AuditItemDetail[]).filter((detail) => detail.comentario.trim() || detail.evidencias.length > 0).length,
    }));
  }, [selectedSession, items]);

  const sessionAggregateSummary = useMemo(() => {
    const source = sessionLegajosWithSummary.length > 0
      ? sessionLegajosWithSummary
      : [];

    if (source.length === 0) {
      return { total: 0, admin: 0, preEntrega: 0, ventas: 0 };
    }

    const totals = source.reduce(
      (acc, legajo) => ({
        total: acc.total + legajo.summary.total,
        admin: acc.admin + legajo.summary.admin,
        preEntrega: acc.preEntrega + legajo.summary.preEntrega,
        ventas: acc.ventas + legajo.summary.ventas,
      }),
      { total: 0, admin: 0, preEntrega: 0, ventas: 0 },
    );

    return {
      total: totals.total / source.length,
      admin: totals.admin / source.length,
      preEntrega: totals.preEntrega / source.length,
      ventas: totals.ventas / source.length,
    };
  }, [sessionLegajosWithSummary]);

  const currentProgress = useMemo(() => {
    const answered = selectedLegajo ? items.filter((item) => selectedLegajo.scores[item.id] !== undefined).length : 0;
    return {
      answered,
      total: items.length,
      percentage: items.length ? (answered / items.length) * 100 : 0,
    };
  }, [selectedLegajo, items]);

  const allItemsAnswered = useMemo(() => {
    if (!selectedLegajo) return false;
    return items.every((item) => selectedLegajo.scores[item.id] !== undefined) && selectedLegajo.nombre.trim().length > 0;
  }, [selectedLegajo, items]);

  const branchStats = useMemo(() => {
    const stats = {
      Jujuy: { count: 0, average: 0, latest: '' },
      Salta: { count: 0, average: 0, latest: '' },
    };

    for (const branch of ['Jujuy', 'Salta'] as BranchName[]) {
      const finalizados = sessions
        .filter((session) => session.sucursal === branch)
        .flatMap((session) =>
          session.legajos
            .filter((legajo) => legajo.status === 'finalizado')
            .map((legajo) => ({
              nombre: legajo.nombre,
              total: calculateSummary(legajo.scores, items).total,
              updatedAt: legajo.updatedAt,
            })),
        )
        .sort((a, b) => b.updatedAt - a.updatedAt);

      const total = finalizados.reduce((acc, legajo) => acc + legajo.total, 0);

      stats[branch] = {
        count: finalizados.length,
        average: finalizados.length ? total / finalizados.length : 0,
        latest: finalizados[0]?.nombre || '',
      };
    }

    return stats;
  }, [sessions, items]);

  const featuredSessionSummary = useMemo(() => {
    if (!featuredSession) return null;

    const finalizados = featuredSession.legajos.filter((legajo) => legajo.status === 'finalizado').length;
    const enProceso = featuredSession.legajos.filter((legajo) => legajo.status === 'en_proceso').length;
    const total = featuredSession.legajos.length;
    const average = total > 0
      ? featuredSession.legajos.reduce((acc, legajo) => acc + calculateSummary(legajo.scores, items).total, 0) / total
      : 0;

    return {
      finalizados,
      enProceso,
      total,
      average,
    };
  }, [featuredSession, items]);

  const totalAudited = branchStats.Jujuy.count + branchStats.Salta.count;

  const statusLabel = !hasGoogleSheetsConfig
    ? 'Sin sincronizacion'
    : isOnline === null
      ? 'Verificando sincronizacion'
      : isOnline
        ? isSyncingSessions
          ? 'Sincronizando cambios'
          : 'Sincronizacion activa'
        : 'Sincronizacion inestable';

  const scoreCards = [
    { label: 'Cumplimiento total', value: summary.total, color: 'text-slate-800' },
    { label: 'Cumplimiento Administracion', value: summary.admin, color: 'text-indigo-600' },
    { label: 'Cumplimiento Pre-entrega', value: summary.preEntrega, color: 'text-emerald-600' },
    { label: 'Cumplimiento Ventas', value: summary.ventas, color: 'text-sky-600' },
  ];

  const canGoBack =
    showPreview ||
    showCreateSession ||
    showCreateLegajo ||
    showQuestionsForm ||
    selectedLegajoId !== null ||
    selectedSessionId !== null ||
    mainTab === 'preguntas';

  const currentViewLabel = showPreview
    ? 'Vista previa'
    : selectedLegajoId
      ? 'Legajo'
      : selectedSessionId
        ? 'Lote'
        : mainTab === 'preguntas'
          ? 'Preguntas'
          : 'Inicio';

  const handleGoBack = () => {
    if (showPreview) {
      setShowPreview(false);
      return;
    }
    if (showQuestionsForm) {
      setShowQuestionsForm(false);
      return;
    }
    if (showCreateLegajo) {
      setShowCreateLegajo(false);
      return;
    }
    if (showCreateSession) {
      setShowCreateSession(false);
      return;
    }
    if (selectedLegajoId) {
      setSelectedLegajoId(null);
      return;
    }
    if (selectedSessionId) {
      setSelectedSessionId(null);
      return;
    }
    if (mainTab === 'preguntas') {
      setMainTab('auditorias');
    }
  };

  const updateLegajo = (legajoId: string, updater: (legajo: LegajoRecord) => LegajoRecord) => {
    if (!selectedSessionId) return;

    const nextSessions = sessions.map((session) => {
      if (session.id !== selectedSessionId) return session;

      return {
        ...session,
        updatedAt: Date.now(),
        legajos: session.legajos.map((legajo) => (legajo.id === legajoId ? updater(legajo) : legajo)),
      };
    });

    persistSessions(nextSessions);
  };

  const moveToNextAuditItem = (currentItemId: number) => {
    if (!isCompactMobileViewport()) return;

    const currentIndex = items.findIndex((item) => item.id === currentItemId);
    if (currentIndex < 0) return;

    const nextItem = items[currentIndex + 1];
    if (!nextItem) return;

    window.setTimeout(() => {
      const nextElement = document.getElementById(`audit-item-${nextItem.id}`);
      nextElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 180);
  };

  const createSession = () => {
    if (!newSession.nombre.trim() || !newSession.auditor.trim()) return;

    const session: AuditSession = {
      id: createId(),
      nombre: newSession.nombre.trim(),
      auditor: newSession.auditor.trim(),
      sucursal: newSession.sucursal,
      objetivo: Number(newSession.objetivo) || 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'en_curso',
      legajos: [],
    };

    persistSessions([session, ...sessions]);
    setSelectedSessionId(session.id);
    setSelectedLegajoId(null);
    setShowCreateSession(false);
    setNewSession({
      nombre: '',
      auditor: '',
      sucursal: 'Jujuy',
      objetivo: 10,
    });
  };

  const createLegajo = () => {
    if (!selectedSession || !newLegajoNombre.trim()) return;

    const legajo = createEmptyLegajo(newLegajoNombre.trim());
    const nextSessions = sessions.map((session) => {
      if (session.id !== selectedSession.id) return session;
      return {
        ...session,
        updatedAt: Date.now(),
        legajos: [legajo, ...session.legajos],
      };
    });

    persistSessions(nextSessions);
    setSelectedLegajoId(legajo.id);
    setShowCreateLegajo(false);
    setNewLegajoNombre('');
  };

  const saveQuestions = async () => {
    setIsSavingQuestions(true);
    try {
      await saveQuestionsConfig(items);
      alert('Las preguntas se guardaron correctamente.');
    } catch (error) {
      alert('No se pudieron guardar las preguntas en Google Sheets. Revise si el Apps Script fue actualizado y vuelto a implementar.');
    } finally {
      setIsSavingQuestions(false);
    }
  };

  const addQuestion = () => {
    if (!newItem.requisito.trim()) return;

    const nextItems: AuditItem[] = [
      ...items,
      {
        id: items.length + 1,
        requisito: newItem.requisito.trim(),
        descripcion: newItem.description.trim(),
        roles: newItem.roles,
      },
    ];

    persistItems(nextItems);
    setNewItem({ requisito: '', description: '', roles: [] });
    setShowQuestionsForm(false);
  };

  const updateQuestion = (itemId: number, field: keyof AuditItem, value: string | string[]) => {
    const nextItems = items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item));
    persistItems(nextItems);
  };

  const removeQuestion = (itemId: number) => {
    const nextItems = items
      .filter((item) => item.id !== itemId)
      .map((item, index) => ({ ...item, id: index + 1 }));
    persistItems(nextItems);
  };

  const handleFinalizeLegajo = async () => {
    if (!selectedSession || !selectedLegajo) return;

    setIsSubmitting(true);

    const data: AuditData = {
      id: selectedLegajo.id,
      timestamp: Date.now(),
      sucursal: selectedSession.sucursal,
      auditoriaId: selectedSession.id,
      auditoriaNombre: selectedSession.nombre,
      auditor: selectedSession.auditor,
      legajoNombre: selectedLegajo.nombre,
      legajoEstado: 'finalizado',
      scores: selectedLegajo.scores,
      itemDetails: selectedLegajo.itemDetails,
      evidencias: selectedLegajo.evidencias,
      observaciones: selectedLegajo.observaciones,
      conclusiones: selectedLegajo.conclusiones,
    };

    try {
      await saveToSheets(data);

      updateLegajo(selectedLegajo.id, (legajo) => ({
        ...legajo,
        status: 'finalizado',
        updatedAt: Date.now(),
        finalizedAt: Date.now(),
      }));

      setSelectedLegajoId(null);
    } catch (error) {
      alert('No se pudo guardar la auditoria en este momento. Intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = () => {
    if (!selectedSession) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const palette = {
      ink: [22, 32, 54] as [number, number, number],
      text: [62, 72, 89] as [number, number, number],
      muted: [117, 126, 145] as [number, number, number],
      border: [221, 226, 234] as [number, number, number],
      paper: [246, 244, 239] as [number, number, number],
      panel: [255, 252, 247] as [number, number, number],
      blue: [84, 112, 167] as [number, number, number],
      indigo: [112, 101, 183] as [number, number, number],
      teal: [37, 129, 117] as [number, number, number],
      amber: [177, 128, 64] as [number, number, number],
      rose: [180, 71, 85] as [number, number, number],
      gold: [193, 161, 98] as [number, number, number],
    };
    const finalizedCount = selectedSession.legajos.filter((legajo) => legajo.status === 'finalizado').length;
    const inProgressCount = selectedSession.legajos.filter((legajo) => legajo.status === 'en_proceso').length;
    const pendingCount = selectedSession.legajos.filter((legajo) => legajo.status === 'pendiente').length;
    const completionRate = selectedSession.objetivo > 0
      ? Math.min((finalizedCount / selectedSession.objetivo) * 100, 100)
      : 0;
    const activeLegajos = sessionLegajosWithSummary.filter((legajo) => legajo.answered > 0);
    const bestLegajo = [...activeLegajos].sort((a, b) => b.summary.total - a.summary.total)[0];
    const attentionLegajo = [...activeLegajos].sort((a, b) => a.summary.total - b.summary.total)[0];
    const totalDesvios = sessionLegajosWithSummary.reduce((acc, legajo) => acc + legajo.desvioItems.length, 0);
    const totalComentarios = sessionLegajosWithSummary.reduce((acc, legajo) => acc + legajo.commentedItems, 0);
    const deviationMap = new Map<string, number>();

    sessionLegajosWithSummary.forEach((legajo) => {
      legajo.desvioItems.forEach((item) => {
        deviationMap.set(item.requisito, (deviationMap.get(item.requisito) || 0) + 1);
      });
    });

    const topDeviationRows = Array.from(deviationMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const evidenceEntries = sessionLegajosWithSummary.flatMap((legajo) => {
      const itemEvidenceEntries = items.flatMap((item) => {
        const detail = legajo.itemDetails[item.id];
        const evidencias = detail?.evidencias || [];

        return evidencias.map((src, evidenceIndex) => ({
          legajo: legajo.nombre,
          requisito: item.requisito,
          comentario: detail?.comentario?.trim() || '',
          src,
          evidenceIndex,
        }));
      });

      const generalEvidenceEntries = (legajo.evidencias || []).map((src, evidenceIndex) => ({
        legajo: legajo.nombre,
        requisito: 'Evidencia general',
        comentario: legajo.observaciones?.trim() || '',
        src,
        evidenceIndex,
      }));

      return [...itemEvidenceEntries, ...generalEvidenceEntries];
    });

    const getPerformanceTone = (value: number) => {
      if (value >= 90) return { label: 'Solido', color: palette.teal };
      if (value >= 75) return { label: 'Controlado', color: palette.blue };
      if (value >= 60) return { label: 'Atencion', color: palette.amber };
      return { label: 'Critico', color: palette.rose };
    };

    const statusLabelMap: Record<LegajoStatus, string> = {
      finalizado: 'Finalizado',
      en_proceso: 'En proceso',
      pendiente: 'Pendiente',
    };

    const statusColorMap: Record<LegajoStatus, [number, number, number]> = {
      finalizado: palette.teal,
      en_proceso: palette.blue,
      pendiente: [148, 163, 184],
    };

    const formatDate = (value: number) => new Date(value).toLocaleDateString('es-AR');
    const normalizeRole = (role: string) => role.trim().toLowerCase();
    const itemMatchesRole = (item: AuditItem, keyword: string) =>
      item.roles.some((role) => normalizeRole(role).includes(keyword));
    const lotTone = getPerformanceTone(sessionAggregateSummary.total);

    const drawRoundedPanel = (
      x: number,
      y: number,
      width: number,
      height: number,
      fill: [number, number, number],
      stroke?: [number, number, number],
    ) => {
      doc.setFillColor(...fill);
      doc.roundedRect(x, y, width, height, 7, 7, 'F');
      if (stroke) {
        doc.setDrawColor(...stroke);
        doc.roundedRect(x, y, width, height, 7, 7, 'S');
      }
    };

    const drawStatCard = (
      x: number,
      y: number,
      width: number,
      height: number,
      label: string,
      value: string,
      helper: string,
      accent: [number, number, number],
    ) => {
      drawRoundedPanel(x, y, width, height, palette.panel, palette.border);
      doc.setFillColor(...accent);
      doc.roundedRect(x + 4, y + 4, 2.5, height - 8, 1.2, 1.2, 'F');
      doc.setTextColor(...palette.muted);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(label.toUpperCase(), x + 10, y + 9);
      doc.setTextColor(...palette.ink);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(value, x + 10, y + 20);
      doc.setTextColor(...palette.muted);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(helper, x + 10, y + 27);
    };

    const ensurePageSpace = (requiredHeight: number) => {
      const currentY = (doc.lastAutoTable?.finalY || 0) + 10;
      if (currentY + requiredHeight <= pageHeight - 20) {
        return currentY;
      }

      doc.addPage();
      doc.setFillColor(...palette.paper);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      return 18;
    };

    const drawEvidenceSection = () => {
      const sectionY = ensurePageSpace(90);
      doc.setTextColor(...palette.ink);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('7. Anexo de evidencias', 14, sectionY);

      if (evidenceEntries.length === 0) {
        doc.setTextColor(...palette.text);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('No se registraron fotos de evidencia en este lote.', 14, sectionY + 10);
        return;
      }

      let cursorY = sectionY + 8;
      const marginX = 14;
      const gutter = 8;
      const cardWidth = (pageWidth - marginX * 2 - gutter) / 2;
      const imageHeight = 32;
      const cardHeight = 62;

      evidenceEntries.forEach((entry, index) => {
        const column = index % 2;
        if (column === 0 && cursorY + cardHeight > pageHeight - 22) {
          doc.addPage();
          doc.setFillColor(...palette.paper);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          cursorY = 18;
        }

        const cardX = marginX + column * (cardWidth + gutter);
        const cardY = cursorY;

        drawRoundedPanel(cardX, cardY, cardWidth, cardHeight, palette.panel, palette.border);
        doc.setTextColor(...palette.muted);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(`ANEXO ${index + 1}`, cardX + 4, cardY + 6);

        doc.setTextColor(...palette.ink);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(doc.splitTextToSize(`${entry.legajo} · ${entry.requisito}`, cardWidth - 8), cardX + 4, cardY + 12);

        const imageY = cardY + 14;

        try {
          const format = entry.src.startsWith('data:image/png') ? 'PNG' : 'JPEG';
          (doc as unknown as { addImage: (...args: unknown[]) => void }).addImage(
            entry.src,
            format,
            cardX + 4,
            imageY,
            cardWidth - 8,
            imageHeight,
            undefined,
            'FAST',
          );
        } catch (error) {
          console.error('Error embedding evidence image in PDF:', error);
          doc.setDrawColor(...palette.border);
          doc.rect(cardX + 4, imageY, cardWidth - 8, imageHeight);
          doc.setTextColor(...palette.muted);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text('No se pudo incrustar la imagen.', cardX + 8, imageY + 22);
        }

        if (entry.comentario) {
          doc.setTextColor(...palette.text);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          const commentLines = doc.splitTextToSize(`Obs.: ${entry.comentario}`, cardWidth - 8).slice(0, 2);
          doc.text(commentLines, cardX + 4, imageY + imageHeight + 8);
        }

        if (column === 1) {
          cursorY += cardHeight + 8;
        }
      });
    };

    const drawLegajoMatrixSection = () => {
      const matrixStartY = ensureSpace(92, '6. Matriz resumida por legajo');
      const matrixHead = ['Legajo', ...items.map((item) => `${item.id}`)];
      const matrixBody = sessionLegajosWithSummary.map((legajo) => [
        legajo.nombre,
        ...items.map((item) => {
          const score = legajo.scores[item.id];
          if (score === 1) return 'SI';
          if (score === 0) return 'NO';
          return '-';
        }),
      ]);

      autoTable(doc, {
        startY: matrixStartY + 4,
        head: [matrixHead],
        body: matrixBody,
        headStyles: {
          fillColor: palette.ink,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
          halign: 'center',
        },
        alternateRowStyles: { fillColor: palette.paper },
        margin: { left: 10, right: 10 },
        styles: {
          fontSize: 6.6,
          cellPadding: 2,
          textColor: palette.text,
          lineColor: palette.border,
          lineWidth: 0.15,
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 34, halign: 'left', fontStyle: 'bold' },
          ...Object.fromEntries(items.map((_, index) => [index + 1, { cellWidth: 7.6 }])),
        },
        didParseCell: (data) => {
          if (data.section !== 'body' || data.column.index === 0) return;

          const value = String(data.cell.raw || '');
          if (value === 'SI') {
            data.cell.styles.textColor = palette.teal;
            data.cell.styles.fontStyle = 'bold';
          } else if (value === 'NO') {
            data.cell.styles.textColor = palette.rose;
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = palette.muted;
          }
        },
      });
    };

    const ensureSpace = (requiredHeight: number, nextSectionTitle: string) => {
      const probeY = (doc.lastAutoTable?.finalY || 0) + 10;
      if (probeY + requiredHeight <= pageHeight - 20) {
        doc.setTextColor(...palette.ink);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(nextSectionTitle, 14, probeY);
        return probeY;
      }

      doc.addPage();
      doc.setFillColor(...palette.paper);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setTextColor(...palette.ink);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(nextSectionTitle, 14, 18);
      return 18;
    };

    const adminDeviationCount = sessionLegajosWithSummary.reduce(
      (acc, legajo) => acc + legajo.desvioItems.filter((item) => itemMatchesRole(item, 'admin')).length,
      0,
    );
    const preEntregaDeviationCount = sessionLegajosWithSummary.reduce(
      (acc, legajo) => acc + legajo.desvioItems.filter((item) => itemMatchesRole(item, 'pre')).length,
      0,
    );
    const ventasDeviationCount = sessionLegajosWithSummary.reduce(
      (acc, legajo) => acc + legajo.desvioItems.filter((item) => itemMatchesRole(item, 'venta')).length,
      0,
    );

    doc.setFillColor(...palette.paper);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFillColor(...palette.ink);
    doc.rect(0, 0, pageWidth, 38, 'F');
    doc.setFillColor(...palette.gold);
    doc.rect(0, 38, pageWidth, 2.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE EJECUTIVO DEL LOTE', 14, 14);
    doc.setFontSize(21);
    doc.text('Auditoria integral de legajos', 14, 29);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Emitido ${formatDate(Date.now())}`, pageWidth - 48, 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...lotTone.color);
    doc.text(`Estado ${lotTone.label}`, pageWidth - 48, 29);

    drawRoundedPanel(14, 48, pageWidth - 28, 32, palette.panel, palette.border);
    doc.setTextColor(...palette.muted);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('LOTE', 20, 56);
    doc.text('SUCURSAL', 74, 56);
    doc.text('OBJETIVO', 128, 56);
    doc.text('FECHA', 168, 56);
    doc.setTextColor(...palette.ink);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(selectedSession.nombre, 48), 20, 64);
    doc.text(selectedSession.sucursal, 74, 66);
    doc.text(`${selectedSession.objetivo}`, 128, 66);
    doc.text(formatDate(selectedSession.updatedAt), 168, 66);

    const cardY = 87;
    const cardGap = 4;
    const cardWidth = (pageWidth - 28 - cardGap * 3) / 4;
    drawStatCard(14, cardY, cardWidth, 31, 'General', `${sessionAggregateSummary.total.toFixed(1)}%`, 'Vision total del lote', palette.gold);
    drawStatCard(14 + cardWidth + cardGap, cardY, cardWidth, 31, 'Administracion', `${sessionAggregateSummary.admin.toFixed(1)}%`, 'Control documental', palette.indigo);
    drawStatCard(14 + (cardWidth + cardGap) * 2, cardY, cardWidth, 31, 'Pre-entrega', `${sessionAggregateSummary.preEntrega.toFixed(1)}%`, 'Entrega y preparacion', palette.teal);
    drawStatCard(14 + (cardWidth + cardGap) * 3, cardY, cardWidth, 31, 'Ventas', `${sessionAggregateSummary.ventas.toFixed(1)}%`, 'Proceso comercial', palette.blue);

    drawRoundedPanel(14, 124, pageWidth - 28, 36, palette.panel, palette.border);
    doc.setTextColor(...palette.ink);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Lectura ejecutiva', 18, 135);
    doc.setTextColor(...palette.text);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const executiveNarrative = [
      `El lote ${selectedSession.nombre} presenta ${sessionAggregateSummary.total.toFixed(1)}% de cumplimiento general y ${completionRate.toFixed(0)}% del objetivo operativo alcanzado.`,
      `Se registran ${finalizedCount} legajo(s) finalizado(s), ${inProgressCount} en proceso y ${pendingCount} pendiente(s).`,
      bestLegajo ? `El mejor desempeno corresponde a ${bestLegajo.nombre} con ${bestLegajo.summary.total.toFixed(0)}% de cumplimiento.` : 'Aun no hay un legajo con desempeno destacado.',
      attentionLegajo ? `El principal foco de seguimiento es ${attentionLegajo.nombre} con ${attentionLegajo.summary.total.toFixed(0)}% de cumplimiento.` : 'Aun no se detecta un foco de seguimiento prioritario.',
      totalComentarios > 0 ? `Se registran ${totalComentarios} punto(s) con observaciones o evidencia complementaria.` : 'No se registran observaciones complementarias relevantes.',
    ].join(' ');
    doc.text(doc.splitTextToSize(executiveNarrative, pageWidth - 38), 18, 144);

    drawRoundedPanel(14, 167, pageWidth - 28, 42, palette.panel, palette.border);
    doc.setTextColor(...palette.ink);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Panorama de cumplimiento', 18, 177);

    [
      { label: 'General', value: sessionAggregateSummary.total, color: palette.ink, deviations: totalDesvios },
      { label: 'Administracion', value: sessionAggregateSummary.admin, color: palette.indigo, deviations: adminDeviationCount },
      { label: 'Pre-entrega', value: sessionAggregateSummary.preEntrega, color: palette.teal, deviations: preEntregaDeviationCount },
      { label: 'Ventas', value: sessionAggregateSummary.ventas, color: palette.blue, deviations: ventasDeviationCount },
    ].forEach((row, index) => {
      const rowY = 186 + index * 7;
      doc.setTextColor(...palette.text);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(row.label, 18, rowY);
      doc.setFillColor(...palette.border);
      doc.roundedRect(52, rowY - 3.7, 96, 3.8, 1.6, 1.6, 'F');
      doc.setFillColor(...row.color);
      doc.roundedRect(52, rowY - 3.7, (Math.min(row.value, 100) / 100) * 96, 3.8, 1.6, 1.6, 'F');
      doc.setTextColor(...row.color);
      doc.text(`${row.value.toFixed(1)}%`, 152, rowY);
      doc.setTextColor(...palette.muted);
      doc.setFont('helvetica', 'normal');
      doc.text(`${row.deviations} desvio(s)`, 170, rowY);
    });

    doc.setTextColor(...palette.ink);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Hallazgos generales mas repetidos', 14, 223);

    autoTable(doc, {
      startY: 227,
      head: [['Hallazgo', 'Repeticiones']],
      body: topDeviationRows.length > 0
        ? topDeviationRows.map(([hallazgo, cantidad]) => [hallazgo, `${cantidad}`])
        : [['Sin desvios recurrentes registrados', '0']],
      headStyles: {
        fillColor: palette.ink,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: { fillColor: palette.paper },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 3, textColor: palette.text, lineColor: palette.border, lineWidth: 0.15 },
      columnStyles: {
        0: { cellWidth: 150 },
        1: { cellWidth: 26, halign: 'center' },
      },
    });

    const tableStartY = ensureSpace(82, '4. Detalle ejecutivo por legajo');
    autoTable(doc, {
      startY: tableStartY + 4,
      head: [['Legajo', 'Estado', 'Total', 'Admin', 'Pre', 'Ventas', 'Avance', 'Alertas']],
      body: sessionLegajosWithSummary.map((legajo) => [
        legajo.nombre,
        statusLabelMap[legajo.status],
        `${legajo.summary.total.toFixed(0)}%`,
        `${legajo.summary.admin.toFixed(0)}%`,
        `${legajo.summary.preEntrega.toFixed(0)}%`,
        `${legajo.summary.ventas.toFixed(0)}%`,
        `${legajo.answered}/${items.length}`,
        `${legajo.desvioItems.length} desvio(s)`,
      ]),
      headStyles: {
        fillColor: palette.ink,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: palette.paper },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 7.5, cellPadding: 2.8, textColor: palette.text, lineColor: palette.border, lineWidth: 0.15 },
      columnStyles: {
        0: { cellWidth: 36 },
        1: { cellWidth: 24 },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 16, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 28, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const rawStatus = sessionLegajosWithSummary[data.row.index]?.status;
          if (rawStatus) {
            data.cell.styles.textColor = statusColorMap[rawStatus];
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.section === 'body' && data.column.index === 2) {
          const score = sessionLegajosWithSummary[data.row.index]?.summary.total ?? 0;
          data.cell.styles.textColor = getPerformanceTone(score).color;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    const detailStartY = ensureSpace(95, '5. Observaciones y desvios relevantes');
    autoTable(doc, {
      startY: detailStartY + 4,
      head: [['Legajo', 'Sintesis operativa']],
      body: sessionLegajosWithSummary.map((legajo) => {
        const deviationLines = legajo.desvioItems.length > 0
          ? `Desvios detectados: ${legajo.desvioItems.map((item, index) => `${index + 1}) ${item.requisito}`).join(' | ')}.`
          : 'Desvios detectados: sin desvios registrados.';

        const commentEntries = items
          .filter((item) => {
            const detail = legajo.itemDetails[item.id];
            return Boolean(detail?.comentario?.trim() || detail?.evidencias?.length);
          })
          .map((item) => {
            const detail = legajo.itemDetails[item.id];
            const parts = [];
            if (detail?.comentario?.trim()) {
              parts.push(detail.comentario.trim());
            }
            if (detail?.evidencias?.length) {
              parts.push(`${detail.evidencias.length} evidencia(s)`);
            }
            return `${item.requisito}: ${parts.join(' / ')}`;
          });

        const commentsText = commentEntries.length > 0
          ? ` Observaciones complementarias: ${commentEntries.join(' | ')}.`
          : '';

        return [
          legajo.nombre,
          `${deviationLines}${commentsText}`.trim(),
        ];
      }),
      headStyles: {
        fillColor: palette.ink,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: { fillColor: palette.paper },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', textColor: palette.text, lineColor: palette.border, lineWidth: 0.15 },
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 148 },
      },
    });

    drawLegajoMatrixSection();
    drawEvidenceSection();

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      const currentPageWidth = doc.internal.pageSize.getWidth();
      const currentPageHeight = doc.internal.pageSize.getHeight();
      doc.setDrawColor(...palette.border);
      doc.line(14, currentPageHeight - 16, currentPageWidth - 14, currentPageHeight - 16);
      doc.setTextColor(...palette.muted);
      doc.setFontSize(8);
      doc.text(`AuditPro | Reporte ejecutivo | Pagina ${i} de ${pageCount}`, currentPageWidth / 2, currentPageHeight - 10, { align: 'center' });
    }

    doc.save(`Auditoria_Lote_${selectedSession.sucursal}_${selectedSession.nombre}_${Date.now()}.pdf`);
    setShowPreview(false);
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden font-sans pb-20">
      <div className="fixed top-0 left-0 w-full h-full opacity-20 pointer-events-none -z-10">
        <div className="absolute top-10 left-10 w-64 h-64 bg-slate-300 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-sky-200 rounded-full blur-[120px]" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-4 pt-3 sm:pt-4">
        <div className="max-w-6xl mx-auto rounded-[28px] border border-white/70 bg-white/75 backdrop-blur-xl shadow-[0_20px_55px_rgba(148,163,184,0.22)] flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shrink-0">A</div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-800 uppercase leading-none">Auditores v2.1</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] font-bold">
                <p className="flex items-center gap-1 text-slate-500">
                  <span className={`w-2 h-2 rounded-full ${isOnline === null ? 'bg-gray-400' : isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {statusLabel}
                </p>
                <span className="text-slate-400">TOTAL AUDITADOS: {totalAudited}</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button
              onClick={() => setMainTab('auditorias')}
              className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] ${mainTab === 'auditorias' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200'}`}
            >
              Auditorias
            </button>
            <button
              onClick={() => setMainTab('preguntas')}
              className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] ${mainTab === 'preguntas' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200'}`}
            >
              Preguntas
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-3 flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                onClick={handleGoBack}
                className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600 shadow-sm"
              >
                <ArrowLeft size={14} />
                Volver
              </button>
            )}
            <span className="rounded-full border border-white/70 bg-white/60 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              {currentViewLabel}
            </span>
          </div>

          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMainTab('auditorias')}
              className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                mainTab === 'auditorias' ? 'bg-slate-900 text-white' : 'border border-white/70 bg-white/80 text-slate-500'
              }`}
            >
              Auditorias
            </button>
            <button
              onClick={() => setMainTab('preguntas')}
              className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                mainTab === 'preguntas' ? 'bg-slate-900 text-white' : 'border border-white/70 bg-white/80 text-slate-500'
              }`}
            >
              Preguntas
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 pt-40 sm:pt-44 space-y-6">
        {mainTab === 'auditorias' ? (
          <>
            {syncMessage && (
              <section className="max-w-6xl mx-auto">
                <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-900 shadow-[0_10px_30px_rgba(217,119,6,0.08)]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="font-semibold">{syncMessage}</p>
                    <button
                      onClick={() => {
                        setSyncMessage('');
                        hydrateSharedData();
                      }}
                      className="rounded-2xl border border-amber-300 bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-amber-900"
                    >
                      Reintentar sincronizacion
                    </button>
                  </div>
                </div>
              </section>
            )}

            {!selectedSession ? (
              <>
                <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
                  <div className="rounded-[34px] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(248,250,252,0.9)_48%,_rgba(226,232,240,0.78)_100%)] backdrop-blur-xl shadow-[0_26px_60px_rgba(148,163,184,0.18)] p-6 sm:p-7">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-slate-700" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.24em]">Panel principal</p>
                    </div>
                    <div className="mt-4 max-w-2xl">
                      <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 leading-[1.02]">
                        Entrá, ubicá tu lote y seguí auditando sin perder el hilo.
                      </h2>
                      <p className="mt-4 text-sm sm:text-[15px] leading-relaxed text-slate-500">
                        Me gusta más que el ingreso siempre sea una portada clara: ver el estado general, arrancar una auditoría nueva o continuar la correcta cuando vos lo decidís.
                      </p>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowCreateSession((prev) => !prev)}
                        className="rounded-2xl bg-slate-900 px-5 py-4 text-sm font-black text-white shadow-xl shadow-slate-900/20"
                      >
                        Nueva auditoria
                      </button>
                      {featuredSession && (
                        <button
                          onClick={() => setSelectedSessionId(featuredSession.id)}
                          className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700"
                        >
                          Continuar ultima auditoria
                        </button>
                      )}
                    </div>

                    {featuredSession && featuredSessionSummary && (
                      <div className="mt-7 rounded-[28px] border border-white/80 bg-white/84 shadow-[0_18px_45px_rgba(148,163,184,0.12)] p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Ultima auditoria</p>
                            <h3 className="mt-2 text-2xl font-black text-slate-900 break-words">{featuredSession.nombre}</h3>
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2">{featuredSession.sucursal}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2">{featuredSession.auditor}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2">{new Date(featuredSession.updatedAt).toLocaleDateString('es-AR')}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedSessionId(featuredSession.id)}
                            className="rounded-2xl bg-slate-900 px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/20"
                          >
                            Abrir lote
                          </button>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="rounded-[22px] border border-slate-200 bg-slate-50/85 p-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Legajos</p>
                            <p className="mt-2 text-2xl font-black text-slate-900">{featuredSessionSummary.total}</p>
                          </div>
                          <div className="rounded-[22px] border border-slate-200 bg-slate-50/85 p-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Finalizados</p>
                            <p className="mt-2 text-2xl font-black text-emerald-600">{featuredSessionSummary.finalizados}</p>
                          </div>
                          <div className="rounded-[22px] border border-slate-200 bg-slate-50/85 p-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">En proceso</p>
                            <p className="mt-2 text-2xl font-black text-sky-600">{featuredSessionSummary.enProceso}</p>
                          </div>
                          <div className="rounded-[22px] border border-slate-200 bg-slate-50/85 p-4">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Promedio</p>
                            <p className="mt-2 text-2xl font-black text-slate-900">{featuredSessionSummary.average.toFixed(0)}%</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-[30px] border border-white/70 bg-slate-900 text-white shadow-[0_24px_60px_rgba(15,23,42,0.24)] p-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Resumen</p>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {(['Jujuy', 'Salta'] as BranchName[]).map((branch) => (
                        <div key={branch} className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-sky-300" />
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">{branch}</p>
                          </div>
                          <p className="mt-2 text-3xl font-black">{branchStats[branch].count}</p>
                          <p className="mt-2 text-xs text-slate-400">Promedio: {branchStats[branch].average.toFixed(1)}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <AnimatePresence>
                  {showCreateSession && (
                    <motion.section
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="glass-card"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <FolderKanban size={16} className="text-indigo-500" />
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.18em]">Crear auditoria</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                          placeholder="Nombre del lote o auditoria"
                          value={newSession.nombre}
                          onChange={(e) => setNewSession({ ...newSession, nombre: e.target.value })}
                          className="glass-input !bg-white"
                        />
                        <input
                          placeholder="Nombre del auditor"
                          value={newSession.auditor}
                          onChange={(e) => setNewSession({ ...newSession, auditor: e.target.value })}
                          className="glass-input !bg-white"
                        />
                        <select
                          value={newSession.sucursal}
                          onChange={(e) => setNewSession({ ...newSession, sucursal: e.target.value as BranchName })}
                          className="glass-input !bg-white"
                        >
                          <option value="Jujuy">Jujuy</option>
                          <option value="Salta">Salta</option>
                        </select>
                        <input
                          type="number"
                          min={1}
                          placeholder="Cantidad estimada"
                          value={newSession.objetivo}
                          onChange={(e) => setNewSession({ ...newSession, objetivo: Number(e.target.value) })}
                          className="glass-input !bg-white"
                        />
                      </div>
                      <div className="mt-4">
                        <button onClick={createSession} className="rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-indigo-200">
                          Crear y comenzar
                        </button>
                      </div>
                    </motion.section>
                  )}
                </AnimatePresence>

                <section className="glass-card !p-0 overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/50">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.18em]">Auditorias en curso</h3>
                  </div>
                  <div className="divide-y divide-slate-200/70">
                    {sessions.length === 0 ? (
                      <div className="p-6 text-sm text-slate-500">Todavía no hay auditorías creadas.</div>
                    ) : (
                      sessions.map((session) => {
                        const finalizados = session.legajos.filter((legajo) => legajo.status === 'finalizado').length;
                        const enProceso = session.legajos.filter((legajo) => legajo.status === 'en_proceso').length;
                        return (
                          <div key={session.id} className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-black text-slate-900">{session.nombre}</p>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                                  {session.sucursal}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
                                <span>Auditor: {session.auditor}</span>
                                <span>Legajos: {session.legajos.length}/{session.objetivo}</span>
                                <span>Finalizados: {finalizados}</span>
                                <span>En proceso: {enProceso}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedSessionId(session.id)}
                              className="rounded-2xl bg-slate-900 px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/20"
                            >
                              Continuar
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </>
            ) : !selectedLegajo ? (
              <>
                <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
                  <div className="rounded-[30px] border border-white/70 bg-white/70 backdrop-blur-xl shadow-[0_22px_50px_rgba(148,163,184,0.18)] p-6">
                    <button
                      onClick={() => setSelectedSessionId(null)}
                      className="inline-flex items-center gap-2 text-sm font-black text-slate-500 mb-4"
                    >
                      <ArrowLeft size={16} />
                      Volver al inicio
                    </button>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Auditoria activa</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{selectedSession.nombre}</h2>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sucursal</p>
                        <p className="mt-2 text-lg font-black text-slate-900">{selectedSession.sucursal}</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Auditor</p>
                        <p className="mt-2 text-lg font-black text-slate-900">{selectedSession.auditor}</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Objetivo</p>
                        <p className="mt-2 text-lg font-black text-slate-900">{selectedSession.objetivo}</p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Legajos cargados</p>
                        <p className="mt-2 text-lg font-black text-slate-900">{selectedSession.legajos.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[30px] border border-white/70 bg-slate-900 text-white shadow-[0_24px_60px_rgba(15,23,42,0.24)] p-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Accion</p>
                    <h3 className="mt-2 text-2xl font-black">Seguimiento de legajos</h3>
                    <p className="mt-3 text-sm text-slate-300">
                      Sumá legajos, retomá los que quedaron a mitad de camino o finalizá los pendientes.
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => setShowCreateLegajo((prev) => !prev)}
                        className="rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-900 shadow-lg shadow-slate-950/20"
                      >
                        + Nuevo legajo
                      </button>
                      <button
                        onClick={() => setShowPreview(true)}
                        className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-sm font-black text-white transition-colors hover:bg-white/15"
                      >
                        Vista previa del lote
                      </button>
                    </div>
                  </div>
                </section>

                <AnimatePresence>
                  {showCreateLegajo && (
                    <motion.section
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="glass-card"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <Plus size={16} className="text-indigo-500" />
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.18em]">Agregar legajo</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                        <input
                          placeholder="Nombre del legajo o persona"
                          value={newLegajoNombre}
                          onChange={(e) => setNewLegajoNombre(e.target.value)}
                          className="glass-input !bg-white"
                        />
                        <button onClick={createLegajo} className="rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-indigo-200">
                          Crear legajo
                        </button>
                      </div>
                    </motion.section>
                  )}
                </AnimatePresence>

                <section className="glass-card !p-0 overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/50 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.18em]">Listado de legajos</h3>
                    <span className="text-xs text-slate-500">{selectedSession.legajos.length} cargado(s)</span>
                  </div>
                  <div className="divide-y divide-slate-200/70">
                    {selectedSession.legajos.length === 0 ? (
                      <div className="p-6 text-sm text-slate-500">Todavía no cargaste legajos en esta auditoría.</div>
                    ) : (
                      selectedSession.legajos.map((legajo) => {
                        const legajoSummary = calculateSummary(legajo.scores, items);
                        return (
                          <div key={legajo.id} className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-black text-slate-900">{legajo.nombre}</p>
                                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                                  legajo.status === 'finalizado'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : legajo.status === 'en_proceso'
                                      ? 'bg-sky-100 text-sky-700'
                                      : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {legajo.status === 'finalizado' ? 'Finalizado' : legajo.status === 'en_proceso' ? 'En proceso' : 'Pendiente'}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
                                <span>Puntaje: {legajoSummary.total.toFixed(0)}%</span>
                                <span>Actualizado: {new Date(legajo.updatedAt).toLocaleString()}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedLegajoId(legajo.id)}
                              className="rounded-2xl bg-slate-900 px-5 py-4 text-sm font-black text-white shadow-lg shadow-slate-900/20"
                            >
                              Abrir legajo
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="rounded-[30px] border border-white/70 bg-white/75 backdrop-blur-xl shadow-[0_22px_50px_rgba(148,163,184,0.18)] px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <button
                        onClick={() => setSelectedLegajoId(null)}
                        className="inline-flex items-center gap-2 text-sm font-black text-slate-500"
                      >
                        <ArrowLeft size={16} />
                        Volver al lote
                      </button>
                      <h2 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">{selectedLegajo.nombre}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        {selectedLegajo.status === 'en_proceso' ? 'En proceso' : selectedLegajo.status === 'finalizado' ? 'Finalizado' : 'Pendiente'}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        {currentProgress.answered}/{currentProgress.total}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="glass-card !p-0 overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-white/40 bg-white/20 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <ListChecks size={16} className="text-indigo-500" />
                      <div>
                        <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest">Puntos de control</h2>
                        <p className="text-xs text-slate-500 mt-1">{currentProgress.answered} de {currentProgress.total} respondidos</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-0 bg-gradient-to-b from-white/10 to-transparent py-1">
                    {items.map((item) => (
                      <AuditRow
                        key={item.id}
                        item={item}
                        score={selectedLegajo.scores[item.id]}
                        detail={selectedLegajo.itemDetails[item.id] ?? createEmptyItemDetail()}
                        onChange={(score) => {
                          updateLegajo(selectedLegajo.id, (legajo) => ({
                            ...legajo,
                            status: 'en_proceso',
                            updatedAt: Date.now(),
                            scores: { ...legajo.scores, [item.id]: score },
                          }));
                          moveToNextAuditItem(item.id);
                        }}
                        onDetailChange={(detail) =>
                          updateLegajo(selectedLegajo.id, (legajo) => ({
                            ...legajo,
                            status: 'en_proceso',
                            updatedAt: Date.now(),
                            itemDetails: { ...legajo.itemDetails, [item.id]: detail },
                          }))
                        }
                      />
                    ))}
                  </div>
                </section>

                <div className="pt-2">
                  <button
                    onClick={handleFinalizeLegajo}
                    disabled={!allItemsAnswered || isSubmitting}
                    className="w-full px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                  >
                    {isSubmitting ? 'Finalizando legajo...' : 'Finalizar legajo'}
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <section className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-6">
            <div className="rounded-[30px] border border-white/70 bg-slate-900 text-white shadow-[0_24px_60px_rgba(15,23,42,0.24)] p-6">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-sky-300" />
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Configuracion</p>
              </div>
              <h2 className="mt-3 text-2xl font-black">Editor de preguntas</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Modificá las preguntas de base. Se guardan para las próximas auditorías y también pueden sincronizarse.
              </p>

              <button
                onClick={saveQuestions}
                disabled={isSavingQuestions}
                className="mt-6 w-full rounded-2xl bg-white px-4 py-4 text-sm font-black text-slate-900 shadow-lg shadow-slate-950/20"
              >
                <span className="inline-flex items-center gap-2">
                  <Save size={16} />
                  {isSavingQuestions ? 'Guardando preguntas...' : 'Guardar preguntas'}
                </span>
              </button>
            </div>

            <div className="glass-card !p-0 overflow-hidden">
              <div className="border-b border-white/50 px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Listado editable</p>
                  <h3 className="mt-1 text-lg font-black text-slate-900">Banco de preguntas</h3>
                </div>
                <button
                  onClick={() => setShowQuestionsForm((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-indigo-200"
                >
                  <Plus size={14} />
                  Agregar
                </button>
              </div>

              <AnimatePresence>
                {showQuestionsForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-6 bg-indigo-50/50 border-b border-indigo-100 overflow-hidden"
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input
                          placeholder="Nombre del requisito"
                          className="glass-input !bg-white"
                          value={newItem.requisito}
                          onChange={(e) => setNewItem({ ...newItem, requisito: e.target.value })}
                        />
                        <input
                          placeholder="Descripcion breve"
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
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black border ${newItem.roles.includes(role) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                          >
                            {role.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <button onClick={addQuestion} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md">
                        Guardar pregunta
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="divide-y divide-slate-200/70">
                {items.map((item) => (
                  <div key={item.id} className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-black text-indigo-500 border border-indigo-100">
                          {item.id}
                        </span>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Pregunta editable</p>
                          <p className="text-sm font-black text-slate-800">{item.requisito}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeQuestion(item.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-600"
                      >
                        <Trash2 size={12} />
                        Quitar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Titulo</label>
                        <input
                          value={item.requisito}
                          onChange={(e) => updateQuestion(item.id, 'requisito', e.target.value)}
                          className="glass-input mt-2 w-full !bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Descripcion</label>
                        <input
                          value={item.descripcion}
                          onChange={(e) => updateQuestion(item.id, 'descripcion', e.target.value)}
                          className="glass-input mt-2 w-full !bg-white"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sectores</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {['Ventas', 'Admin', 'Pre-Entrega'].map((role) => {
                          const isActive = item.roles.includes(role);
                          const nextRoles = isActive ? item.roles.filter((existingRole) => existingRole !== role) : [...item.roles, role];

                          return (
                            <button
                              key={role}
                              onClick={() => updateQuestion(item.id, 'roles', nextRoles)}
                              className={`px-3 py-2 rounded-xl text-[10px] font-black border uppercase tracking-[0.16em] ${isActive ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}
                            >
                              {role}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <AnimatePresence>
        {showPreview && selectedSession && (
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
                <h2 className="font-black text-slate-800 uppercase tracking-tighter text-lg sm:text-xl">Resumen general del lote</h2>
                <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-8 bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]">
                <div className="border-l-4 border-indigo-600 pl-6 py-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">{selectedSession.nombre}</h3>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <span>Sucursal: {selectedSession.sucursal}</span>
                    <span>Auditor: {selectedSession.auditor}</span>
                    <span>Legajos: {selectedSession.legajos.length}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    { label: 'Cumplimiento total lote', value: sessionAggregateSummary.total, color: 'text-slate-800' },
                    { label: 'Cumplimiento Administracion', value: sessionAggregateSummary.admin, color: 'text-indigo-600' },
                    { label: 'Cumplimiento Pre-entrega', value: sessionAggregateSummary.preEntrega, color: 'text-emerald-600' },
                    { label: 'Cumplimiento Ventas', value: sessionAggregateSummary.ventas, color: 'text-sky-600' },
                  ].map((card) => (
                    <div key={card.label} className="bg-white/85 p-4 rounded-2xl border border-white/40 shadow-sm">
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 leading-tight">{card.label}</p>
                      <p className={`text-2xl font-black ${card.color}`}>{card.value.toFixed(0)}%</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
                  <div className="glass-card !bg-white/55 !p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4">Grafico general del lote</p>
                    <SummaryChart summary={sessionAggregateSummary} />
                  </div>

                  <div className="glass-card !bg-white/55 !p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Estado del lote</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/60 bg-white/80 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Finalizados</p>
                        <p className="mt-2 text-2xl font-black text-slate-900">{selectedSession.legajos.filter((legajo) => legajo.status === 'finalizado').length}</p>
                      </div>
                      <div className="rounded-2xl border border-white/60 bg-white/80 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">En proceso</p>
                        <p className="mt-2 text-2xl font-black text-slate-900">{selectedSession.legajos.filter((legajo) => legajo.status === 'en_proceso').length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-indigo-500" />
                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-[0.18em]">Detalle compacto por legajo</h4>
                  </div>

                  <div className="space-y-4">
                    {sessionLegajosWithSummary.map((legajo) => (
                      <div key={legajo.id} className="bg-white/85 rounded-2xl border border-white/50 shadow-sm p-4 sm:p-5">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-500 border border-indigo-100">
                                LEGAJO
                              </span>
                              <h5 className="font-black text-slate-800">{legajo.nombre}</h5>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                              Avance {legajo.answered}/{items.length} · Admin {legajo.summary.admin.toFixed(0)}% · Pre {legajo.summary.preEntrega.toFixed(0)}% · Ventas {legajo.summary.ventas.toFixed(0)}%
                            </p>
                          </div>

                          <span className={`self-start px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] ${
                            legajo.status === 'finalizado' ? 'bg-emerald-100 text-emerald-700' : legajo.status === 'en_proceso' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {legajo.status === 'finalizado' ? 'FINALIZADO' : legajo.status === 'en_proceso' ? 'EN PROCESO' : 'PENDIENTE'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-4 mt-4">
                          <div className="rounded-2xl bg-slate-50/80 border border-slate-200/60 p-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Desvios principales</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {legajo.desvioItems.length > 0
                                ? legajo.desvioItems.map((item) => item.requisito).join(', ')
                                : 'Sin desvios registrados.'}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-slate-50/80 border border-slate-200/60 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Camera size={13} className="text-slate-400" />
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Observaciones breves</p>
                            </div>
                            <p className="text-sm text-slate-700">
                              {legajo.commentedItems > 0
                                ? `${legajo.commentedItems} punto(s) con comentario o evidencia.`
                                : 'Sin comentarios adicionales.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="p-5 sm:p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-4">
                <button onClick={() => setShowPreview(false)} className="flex-1 py-4 font-bold text-slate-500 hover:text-slate-900">
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
    </div>
  );
}
