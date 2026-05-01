import { useCallback, useState } from 'react';

export const THEMES = { dark: 'dark', light: 'light' };
const STORAGE_KEY = 'dag-theme';

const readInitialTheme = () => {
  if (typeof document === 'undefined') return THEMES.dark;
  const attr = document.documentElement.dataset.theme;
  return attr === THEMES.light ? THEMES.light : THEMES.dark;
};

// Write attribute + storage synchronously so any code that reads
// getComputedStyle (e.g. GraphView's theme effect) sees fresh CSS vars
// on the very next render — child effects fire before parent effects,
// so deferring this to a useEffect would leave the scene reading
// stale colors for one frame.
const applyTheme = (next) => {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch (e) {
    // localStorage unavailable (private mode, etc.) — silently ignore
  }
};

export function useTheme() {
  const [theme, setThemeState] = useState(readInitialTheme);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === THEMES.dark ? THEMES.light : THEMES.dark;
      applyTheme(next);
      return next;
    });
  }, []);

  const setTheme = useCallback((next) => {
    if (next !== THEMES.dark && next !== THEMES.light) return;
    applyTheme(next);
    setThemeState(next);
  }, []);

  return [theme, toggleTheme, setTheme];
}
