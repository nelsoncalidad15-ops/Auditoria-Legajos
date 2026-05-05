import { AuditData, AuditItem, AuditSession } from '../types';

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

const postToWebApp = async (payload: unknown) => {
  if (!WEB_APP_URL) {
    return { success: true, localOnly: true };
  }

  await fetch(WEB_APP_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  return { success: true };
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
    return await postToWebApp({
      type: 'sessions_snapshot',
      payload: {
        updatedAt: Date.now(),
        sessions,
      },
    });
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

    return data.sessions as AuditSession[];
  } catch (error) {
    console.error('Error loading sessions snapshot:', error);
    return null;
  }
};
