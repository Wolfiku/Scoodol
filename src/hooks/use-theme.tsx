
"use client"

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

type Theme = 'light' | 'dark' | string;
type ColorTheme = 'default' | 'ocean' | 'sunset' | 'forest';
type StartView = 'daily' | 'weekly' | 'homework';
type AiLanguage = 'German' | 'English';

type UserSettings = {
    theme?: Theme;
    colorTheme?: ColorTheme;
    startView?: StartView;
    aiLanguage?: AiLanguage;
    betaFeaturesEnabled?: boolean;
}

type ThemeProviderState = {
  theme: Theme;
  resolvedTheme: 'light' | 'dark' | undefined;
  colorTheme: ColorTheme;
  setTheme: (theme: Theme) => void;
  setColorTheme: (colorTheme: ColorTheme | string) => void;
  startView: StartView;
  setStartView: (view: StartView) => void;
  aiLanguage: AiLanguage;
  setAiLanguage: (language: AiLanguage) => void;
  betaFeaturesEnabled: boolean;
  setBetaFeaturesEnabled: (enabled: boolean) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isMounted, setIsMounted] = useState(false);
  
  const [theme, setThemeState] = useState<Theme>('light');
  const [startView, setStartViewState] = useState<StartView>('daily');
  const [aiLanguage, setAiLanguageState] = useState<AiLanguage>('German');
  const [betaFeaturesEnabled, setBetaFeaturesEnabledState] = useState(false);

  const { user } = useUser();
  const firestore = useFirestore();
  
  const settingsDocRef = useMemoFirebase(() => 
    user ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);

  const { data: userSettings } = useDoc<{settings: UserSettings}>(settingsDocRef);
  
  useEffect(() => {
    setIsMounted(true);
    
    if (user && user.isAnonymous) {
        const localTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        const localStartView = localStorage.getItem('startView') as StartView || 'daily';
        const localAiLanguage = localStorage.getItem('aiLanguage') as AiLanguage || 'German';
        const localBeta = localStorage.getItem('betaFeaturesEnabled') === 'true';

        setThemeState(localTheme);
        setStartViewState(localStartView);
        setAiLanguageState(localAiLanguage);
        setBetaFeaturesEnabledState(localBeta);

    } else if (userSettings?.settings) {
      const { theme, startView, aiLanguage, betaFeaturesEnabled } = userSettings.settings;
      setThemeState(theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
      setStartViewState(startView || 'daily');
      setAiLanguageState(aiLanguage || 'German');
      setBetaFeaturesEnabledState(betaFeaturesEnabled || false);
    }
  }, [userSettings, user]);

  const updateSettings = (newSettings: Partial<UserSettings>) => {
      if (user && !user.isAnonymous && settingsDocRef) {
          const currentSettings = userSettings?.settings || {};
          const settingsToUpdate = { settings: { ...currentSettings, ...newSettings }};
          setDoc(settingsDocRef, settingsToUpdate, { merge: true });
      } else {
          if (newSettings.theme) localStorage.setItem('theme', newSettings.theme);
          if (newSettings.startView) localStorage.setItem('startView', newSettings.startView);
          if (newSettings.aiLanguage) localStorage.setItem('aiLanguage', newSettings.aiLanguage);
          if (newSettings.betaFeaturesEnabled !== undefined) localStorage.setItem('betaFeaturesEnabled', String(newSettings.betaFeaturesEnabled));
      }
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    updateSettings({ theme: newTheme });
  };

  const setStartView = (newView: StartView) => {
    setStartViewState(newView);
    updateSettings({ startView: newView });
  };
  
  const setAiLanguage = (newLanguage: AiLanguage) => {
    setAiLanguageState(newLanguage);
    updateSettings({ aiLanguage: newLanguage });
  };
  
  const setBetaFeaturesEnabled = (enabled: boolean) => {
    setBetaFeaturesEnabledState(enabled);
    updateSettings({ betaFeaturesEnabled: enabled });
  };

  const setColorTheme = (newColorTheme: ColorTheme | string) => {
    const currentMode = resolvedTheme;
    let finalTheme: Theme;
    if (newColorTheme === 'default') {
      finalTheme = currentMode || 'light';
    } else {
      finalTheme = `${currentMode}-${newColorTheme}`;
    }
    setTheme(finalTheme);
    updateSettings({ theme: finalTheme, colorTheme: newColorTheme as ColorTheme });
  }
  
  const [resolvedTheme, colorTheme] = useMemo((): [('light' | 'dark'), ColorTheme] => {
      const parts = theme.split('-');
      const mode = (parts[0] === 'dark' ? 'dark' : 'light') as 'light' | 'dark';
      const color = (parts.length > 1 ? parts[1] : 'default') as ColorTheme;
      return [mode, color];
  }, [theme]);

  useEffect(() => {
    if (isMounted && resolvedTheme) {
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(resolvedTheme);
      document.body.dataset.theme = colorTheme;
    }
  }, [resolvedTheme, colorTheme, isMounted]);

  const value = { 
      theme, 
      resolvedTheme, 
      colorTheme, 
      setTheme, 
      setColorTheme,
      startView,
      setStartView,
      aiLanguage,
      setAiLanguage,
      betaFeaturesEnabled,
      setBetaFeaturesEnabled,
      updateSettings,
    };

  if (!isMounted) {
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
