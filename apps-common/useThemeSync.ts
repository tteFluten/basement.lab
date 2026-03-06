import { useEffect } from 'react';

/**
 * Syncs the app's data-theme attribute with the hub's stored theme preference.
 * On mount: reads 'basement-lab-theme' from localStorage.
 * On change: listens for storage events fired when the hub toggles the theme.
 */
export function useThemeSync() {
  useEffect(() => {
    const apply = (theme: string) => {
      document.documentElement.setAttribute('data-theme', theme);
    };

    apply(localStorage.getItem('basement-lab-theme') || 'dark');

    const handler = (e: StorageEvent) => {
      if (e.key === 'basement-lab-theme' && e.newValue) apply(e.newValue);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
}
