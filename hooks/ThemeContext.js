import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const lightColors = {
  background: "#FFFFFF",
  card: "#F3F4F6",
  text: "#111827",
  textMuted: "#6B7280",
  primary: "#004B49",
  border: "#E5E7EB",
};

const darkColors = {
  background: "#0F172A",
  card: "#1E293B",
  text: "#F9FAFB",
  textMuted: "#9CA3AF",
  primary: "#2DD4BF",
  border: "#334155",
};

const ThemeContext = createContext({
  isDark: false,
  colors: lightColors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  // load saved preference
  useEffect(() => {
    AsyncStorage.getItem("isDark").then((v) => {
      if (v !== null) setIsDark(v === "true");
    });
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      AsyncStorage.setItem("isDark", String(!prev));
      return !prev;
    });
  };

  const value = useMemo(
    () => ({ isDark, toggleTheme, colors: isDark ? darkColors : lightColors }),
    [isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);