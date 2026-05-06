import { useEffect, useState, useCallback } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'preguntas' }
  | { name: 'lote'; sessionId: string }
  | { name: 'legajo'; sessionId: string; legajoId: string }
  | { name: 'preview'; sessionId: string }
  | { name: 'formacion' };

function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\//, '') || '';
  const parts = path.split('/');

  if (parts[0] === 'preguntas') return { name: 'preguntas' };
  if (parts[0] === 'formacion') return { name: 'formacion' };
  if (parts[0] === 'lote' && parts[1]) {
    if (parts[2] === 'legajo' && parts[3]) {
      return { name: 'legajo', sessionId: parts[1], legajoId: parts[3] };
    }
    if (parts[2] === 'preview') {
      return { name: 'preview', sessionId: parts[1] };
    }
    return { name: 'lote', sessionId: parts[1] };
  }
  return { name: 'home' };
}

export function useHashRouter() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path;
  }, []);

  const goHome = useCallback(() => navigate('/'), [navigate]);
  const goPreguntas = useCallback(() => navigate('/preguntas'), [navigate]);
  const goFormacion = useCallback(() => navigate('/formacion'), [navigate]);
  const goLote = useCallback((sessionId: string) => navigate(`/lote/${sessionId}`), [navigate]);
  const goLegajo = useCallback(
    (sessionId: string, legajoId: string) => navigate(`/lote/${sessionId}/legajo/${legajoId}`),
    [navigate],
  );
  const goPreview = useCallback(
    (sessionId: string) => navigate(`/lote/${sessionId}/preview`),
    [navigate],
  );
  const goBack = useCallback(() => window.history.back(), []);

  return { route, navigate, goHome, goPreguntas, goFormacion, goLote, goLegajo, goPreview, goBack };
}
