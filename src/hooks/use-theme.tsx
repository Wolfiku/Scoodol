
"use client"

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

type Theme = 'light' | 'dark' | string;
type ColorTheme = 'default' | 'ocean' | 'sunset' | 'forest';
type StartView = 'daily' | 'weekly' | 'homework';

type ThemeProviderState = {
  theme: Theme;
  resolvedTheme: 'light' | 'dark' | undefined;
  colorTheme: ColorTheme;
  setTheme: (theme: Theme) => void;
  setColorTheme: (colorTheme: ColorTheme | string) => void;
  startView: StartView;
  setStartView: (view: StartView) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme | undefined>(undefined);
  const [startView, setStartViewState] = useState<StartView>('daily');
  const [isMounted, setIsMounted] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const isPreviewMode = sessionStorage.getItem('previewMode') === 'true';
    setIsPreview(isPreviewMode);

    let initialTheme: Theme;
    let initialStartView: StartView;

    if (isPreviewMode) {
      initialTheme = 'light';
      initialStartView = 'daily';
    } else {
      const storedTheme = localStorage.getItem('theme');
      const storedStartView = localStorage.getItem('startView') as StartView | null;
      
      initialTheme = storedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      initialStartView = storedStartView || 'daily';
    }

    setThemeState(initialTheme);
    setStartViewState(initialStartView);
  }, []);
  
  const setTheme = (newTheme: Theme) => {
    if (isPreview) return; 
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  };

  const setStartView = (newView: StartView) => {
      if(isPreview) return;
      localStorage.setItem('startView', newView);
      setStartViewState(newView);
  }

  const setColorTheme = (newColorTheme: ColorTheme | string) => {
    if (isPreview) return; 
    const currentMode = resolvedTheme;
    if (newColorTheme === 'default') {
      if (currentMode) setTheme(currentMode);
    } else {
      if (currentMode) setTheme(`${currentMode}-${newColorTheme}`);
    }
  }
  
  const [resolvedTheme, colorTheme] = useMemo((): [('light' | 'dark') | undefined, ColorTheme] => {
      if (!theme) return [undefined, 'default'];
      if (isPreview) return ['light', 'default'];

      const parts = theme.split('-');
      const mode = (parts[0] === 'dark' ? 'dark' : 'light') as 'light' | 'dark';
      const color = (parts[1] || 'default') as ColorTheme;
      return [mode, color];
  }, [theme, isPreview]);


  useEffect(() => {
    if (isMounted && resolvedTheme) {
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(resolvedTheme);

      document.body.removeAttribute(`data-theme`);

      if (colorTheme && colorTheme !== 'default') {
          document.body.setAttribute(`data-theme`, colorTheme);
      } else {
          document.body.setAttribute('data-theme', 'default');
      }

    }
  }, [theme, resolvedTheme, colorTheme, isMounted]);

  const value = { 
      theme: theme || 'light', 
      resolvedTheme, 
      colorTheme, 
      setTheme, 
      setColorTheme,
      startView,
      setStartView
    };

  if (!theme) {
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
