import { AuditData, AuditItem, AuditSession, EvidenceAsset } from '../types';

const WEB_APP_URL = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL?.trim() || '';

export const hasGoogleSheetsConfig = Boolean(WEB_APP_URL);

const createResourceUrl = (resource: string) => {
  const separator = WEB_APP_URL.includes('?') ? '&' : '?';
  return `${WEB_APP_URL}${separator}resource=${resource}&t=${Date.now()}`;
};

const normalizeItemsForCompare = (items: AuditItem[]) =>
  items.map((item) => ({
    id: Number(item.id),
    requisito: item.requisito?.trim() || '',
    descripcion: item.descripcion?.trim() || '',
    roles: [...(item.roles || [])].map((role) => role.trim()).sort(),
  }));

const sortSessionsByUpdatedAt = (sessions: AuditSession[]) =>
  [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

const dedupeSessionsById = (sessions: AuditSession[]) => {
  const byId = new Map<string, AuditSession>();

  sessions.forEach((session) => {
    const existing = byId.get(session.id);
    if (!existing || session.updatedAt >= existing.updatedAt) {
      byId.set(session.id, session);
    }
  });

  return sortSessionsByUpdatedAt(Array.from(byId.values()));
};

const postToWebApp = async (payload: unknown) => {
  if (!WEB_APP_URL) {
    return { success: true, localOnly: true };
  }

  const response = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`WEB_APP_POST_HTTP_${response.status}`);
  }

  const rawText = await response.text();
  if (!rawText.trim()) {
    return { success: true };
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    console.error('Invalid POST response from web app:', rawText);
    throw new Error('WEB_APP_POST_INVALID_JSON');
  }
};

export const testConnection = async () => {
  if (!WEB_APP_URL) return false;

  try {
    const response = await fetch(WEB_APP_URL, { method: 'GET' });
    return response.ok;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
};

export const saveToSheets = async (data: AuditData) => {
  try {
    return await postToWebApp({
      type: 'audit',
      payload: data,
      ...data,
    });
  } catch (error) {
    console.error('Error saving audit:', error);
    throw error;
  }
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error('FILE_READ_ERROR'));
    reader.readAsDataURL(file);
  });

export interface EvidenceUploadContext {
  auditoriaId?: string;
  auditoriaNombre?: string;
  sucursal?: string;
  legajoId?: string;
  legajoNombre?: string;
  itemId?: number;
  itemRequisito?: string;
}

export const uploadEvidence = async (file: File, context: EvidenceUploadContext): Promise<EvidenceAsset> => {
  if (!WEB_APP_URL) {
    const reader = new FileReader();
    return await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error || new Error('FILE_READ_ERROR'));
      reader.readAsDataURL(file);
    });
  }

  const dataBase64 = await fileToBase64(file);
  const response = await postToWebApp({
    type: 'upload_evidence',
    payload: {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataBase64,
      sizeBytes: file.size,
      ...context,
    },
  });

  if (!response || typeof response !== 'object' || !(response as { evidence?: unknown }).evidence) {
    throw new Error('EVIDENCE_UPLOAD_INVALID_RESPONSE');
  }

  return (response as { evidence: EvidenceAsset }).evidence;
};

export const saveQuestionsConfig = async (items: AuditItem[]) => {
  try {
    const result = await postToWebApp({
      type: 'questions_config',
      payload: {
        updatedAt: Date.now(),
        items,
      },
    });

    if (!WEB_APP_URL) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 900));

    const remoteItems = await loadQuestionsConfig();
    const localSnapshot = JSON.stringify(normalizeItemsForCompare(items));
    const remoteSnapshot = JSON.stringify(normalizeItemsForCompare(remoteItems || []));

    if (!remoteItems || localSnapshot !== remoteSnapshot) {
      throw new Error('QUESTIONS_CONFIG_NOT_PERSISTED');
    }

    return result;
  } catch (error) {
    console.error('Error saving questions config:', error);
    throw error;
  }
};

export const saveSessionsSnapshot = async (sessions: AuditSession[]) => {
  try {
    const normalizedSessions = dedupeSessionsById(sessions);
    const result = await Promise.all(
      normalizedSessions.map((session) =>
        postToWebApp({
          type: 'session_record',
          payload: {
            session,
          },
        }),
      ),
    );

    if (!WEB_APP_URL) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 900));

    const remoteSessions = await loadSessionsSnapshot();
    const localSnapshot = JSON.stringify(normalizedSessions);
    const remoteSnapshot = JSON.stringify(dedupeSessionsById(remoteSessions || []));

    if (!remoteSessions || localSnapshot !== remoteSnapshot) {
      throw new Error('SESSIONS_SNAPSHOT_NOT_PERSISTED');
    }

    return result;
  } catch (error) {
    console.error('Error saving sessions snapshot:', error);
    throw error;
  }
};

const fetchWebAppJson = async (resource: string) => {
  const response = await fetch(createResourceUrl(resource), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`WEB_APP_HTTP_${response.status}`);
  }

  const rawText = await response.text();
  if (!rawText.trim()) {
    throw new Error(`WEB_APP_EMPTY_${resource.toUpperCase()}`);
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    console.error(`Invalid JSON for resource ${resource}:`, rawText);
    throw new Error(`WEB_APP_INVALID_JSON_${resource.toUpperCase()}`);
  }
};

export const loadQuestionsConfig = async () => {
  if (!WEB_APP_URL) return null;

  try {
    const data = await fetchWebAppJson('questions');
    if (!Array.isArray(data?.items)) return null;

    return data.items as AuditItem[];
  } catch (error) {
    console.error('Error loading questions config:', error);
    return null;
  }
};

export const loadSessionsSnapshot = async () => {
  if (!WEB_APP_URL) return null;

  try {
    const data = await fetchWebAppJson('sessions');
    if (!Array.isArray(data?.sessions)) return null;

    return dedupeSessionsById(data.sessions as AuditSession[]);
  } catch (error) {
    console.error('Error loading sessions snapshot:', error);
    return null;
  }
};
