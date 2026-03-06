// Side-effect module: auto-syncs data-theme on <html> from hub's localStorage.
// Import once in your app's entry point (index.tsx).
function applyTheme(theme: string) {
  document.documentElement.setAttribute('data-theme', theme);
}

applyTheme(localStorage.getItem('basement-lab-theme') || 'dark');

window.addEventListener('storage', (e: StorageEvent) => {
  if (e.key === 'basement-lab-theme' && e.newValue) applyTheme(e.newValue);
});
