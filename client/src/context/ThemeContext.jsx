import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'vschool_theme';

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'system';
  } catch {
    return 'system';
  }
};

const systemPrefersDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export const ThemeProvider = ({ children }) => {
  const [preference, setPreference] = useState(readStored);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setTheme = (value) => {
    setPreference(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* storage unavailable — keep in memory only */
    }
  };

  return (
    <ThemeContext.Provider value={{ theme: resolved, preference, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
