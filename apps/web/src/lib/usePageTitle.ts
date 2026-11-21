import { useEffect } from 'react';

/** Keeps the document title in sync with the current page (screen readers announce it). */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Turnify` : 'Turnify — Turnos sin vueltas';
  }, [title]);
}
