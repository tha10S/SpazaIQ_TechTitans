import React, { createContext, useContext, useMemo, useState } from 'react';
import { lightColors, darkColors, spacing, radius, buildTypography } from './theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('light'); 

  const value = useMemo(() => {
    const colors = mode === 'dark' ? darkColors : lightColors;
    return {
      mode,
      isDark: mode === 'dark',
      colors,
      spacing,
      radius,
      typography: buildTypography(colors),
      toggleTheme: () => setMode((m) => (m === 'light' ? 'dark' : 'light')),
      setMode,
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside a <ThemeProvider>');
  }
  return ctx;
}