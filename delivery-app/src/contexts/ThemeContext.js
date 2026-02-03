import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { getAppTheme, saveAppTheme } from '../stores/storage';

const ThemeContext = createContext({
  themeMode: 'system',
  isDark: false,
  setThemeMode: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState('system');
  const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';

  useEffect(() => {
    getAppTheme().then(setThemeModeState);
  }, []);

  const setThemeMode = useCallback(async (mode) => {
    setThemeModeState(mode);
    await saveAppTheme(mode);
  }, []);

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
