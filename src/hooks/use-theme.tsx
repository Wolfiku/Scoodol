
"use client"

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

type Theme = 'light' | 'dark' | string;
type ColorTheme = 'default' | 'ocean' | 'sunset' | 'forest';

type ThemeProviderState = {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  colorTheme: ColorTheme;
  setTheme: (theme: Theme) => void;
  setColorTheme: (colorTheme: ColorTheme | string) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>('light');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      setThemeState(storedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setThemeState(prefersDark ? 'dark' : 'light');
    }
  }, []);
  
  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  };

  const setColorTheme = (newColorTheme: ColorTheme | string) => {
    const currentMode = resolvedTheme;
    if (newColorTheme === 'default') {
      setTheme(currentMode);
    } else {
      setTheme(`${currentMode}-${newColorTheme}`);
    }
  }
  
  const [resolvedTheme, colorTheme] = useMemo((): ['light' | 'dark', ColorTheme] => {
      const parts = theme.split('-');
      const mode = (parts[0] === 'dark' ? 'dark' : 'light') as 'light' | 'dark';
      const color = (parts[1] || 'default') as ColorTheme;
      return [mode, color];
  }, [theme]);


  useEffect(() => {
    if (isMounted) {
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(resolvedTheme);

      // remove old themes
      document.body.removeAttribute(`data-theme`);

      if (colorTheme && colorTheme !== 'default') {
          document.body.setAttribute(`data-theme`, colorTheme);
      } else {
          document.body.setAttribute('data-theme', 'default');
      }

    }
  }, [theme, resolvedTheme, colorTheme, isMounted]);

  const value = { theme, resolvedTheme, colorTheme, setTheme, setColorTheme };

  if (!isMounted) {
    // Return a skeleton or null to avoid hydration mismatch
    return null;
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
