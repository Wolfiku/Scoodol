
"use client"

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

type Theme = 'light' | 'dark' | string;

type ThemeProviderState = {
  theme: Theme;
  resolvedTheme?: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>('light');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (storedTheme) {
      setThemeState(storedTheme);
    } else {
      setThemeState(prefersDark ? 'dark' : 'light');
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  };
  
  const resolvedTheme = useMemo(() => {
      if (theme.startsWith('dark')) return 'dark';
      if (theme.startsWith('light')) return 'light';
      return theme as 'light' | 'dark';
  }, [theme]);


  useEffect(() => {
    if (isMounted) {
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(resolvedTheme);

      const colorTheme = theme.split('-')[1];
      
      // remove old themes
      const themes = ['ocean', 'sunset', 'forest'];
      themes.forEach(t => document.body.removeAttribute(`data-theme`));

      if (colorTheme) {
          document.body.setAttribute(`data-theme`, colorTheme);
      } else {
          document.body.setAttribute('data-theme', 'default');
      }

    }
  }, [theme, resolvedTheme, isMounted]);

  const value = { theme, resolvedTheme, setTheme };

  if (!isMounted) {
    return null; // or a loading spinner
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
