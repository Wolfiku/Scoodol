
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
    user && !user.isAnonymous ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);

  const { data: userSettingsDoc } = useDoc<{settings: UserSettings}>(settingsDocRef);
  
  useEffect(() => {
    setIsMounted(true);
    let initialTheme = 'light';
    let initialStartView = 'daily';
    let initialAiLanguage = 'German';
    let initialBeta = false;

    // Local-first approach (Load from cache immediately)
    try {
        const localTheme = localStorage.getItem('theme');
        if (localTheme) initialTheme = localTheme;
        else initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

        initialStartView = (localStorage.getItem('startView') as StartView) || 'daily';
        initialAiLanguage = (localStorage.getItem('aiLanguage') as AiLanguage) || 'German';
        initialBeta = localStorage.getItem('betaFeaturesEnabled') === 'true';

    } catch (e) {}

    setThemeState(initialTheme);
    setStartViewState(initialStartView);
    setAiLanguageState(initialAiLanguage);
    setBetaFeaturesEnabledState(initialBeta);

  }, []);

  // Sync from Firestore when available
   useEffect(() => {
    if (userSettingsDoc?.settings) {
      const { theme, startView, aiLanguage, betaFeaturesEnabled } = userSettingsDoc.settings;
      if (theme) setThemeState(theme);
      if (startView) setStartViewState(startView);
      if (aiLanguage) setAiLanguageState(aiLanguage);
      if (betaFeaturesEnabled !== undefined) setBetaFeaturesEnabledState(betaFeaturesEnabled);
    }
  }, [userSettingsDoc]);


  const updateSettings = (newSettings: Partial<UserSettings>) => {
      // Optimistically update local state
      if (newSettings.theme) setThemeState(newSettings.theme);
      if (newSettings.startView) setStartViewState(newSettings.startView);
      if (newSettings.aiLanguage) setAiLanguageState(newSettings.aiLanguage);
      if (newSettings.betaFeaturesEnabled !== undefined) setBetaFeaturesEnabledState(newSettings.betaFeaturesEnabled);

      // ALWAYS update local storage cache immediately
      if (typeof window !== 'undefined') {
          if (newSettings.theme) localStorage.setItem('theme', newSettings.theme);
          if (newSettings.startView) localStorage.setItem('startView', newSettings.startView);
          if (newSettings.aiLanguage) localStorage.setItem('aiLanguage', newSettings.aiLanguage);
          if (newSettings.betaFeaturesEnabled !== undefined) localStorage.setItem('betaFeaturesEnabled', String(newSettings.betaFeaturesEnabled));
      }

      // Sync with Firestore if logged in
      if (user && !user.isAnonymous && settingsDocRef) {
          const currentSettings = userSettingsDoc?.settings || {};
          const settingsToUpdate = { settings: { ...currentSettings, ...newSettings }};
          setDoc(settingsDocRef, settingsToUpdate, { merge: true });
      }
  }

  const setTheme = (newTheme: Theme) => {
    updateSettings({ theme: newTheme });
  };

  const setStartView = (newView: StartView) => {
    updateSettings({ startView: newView });
  };
  
  const setAiLanguage = (newLanguage: AiLanguage) => {
    updateSettings({ aiLanguage: newLanguage });
  };
  
  const setBetaFeaturesEnabled = (enabled: boolean) => {
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
