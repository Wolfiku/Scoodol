
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import ClassicTimetableView from '@/app/components/classic-timetable-view';
import HomeworkPlanner from '@/app/components/homework-planner';
import { Button } from '@/components/ui/button';
import { Home, ListChecks, Sparkles, Settings, Loader2 } from 'lucide-react';
import SmartToolsView from './components/smart-tools-view';
import SettingsView from './components/settings-view';
import { useTheme } from '@/hooks/use-theme';
import SetupView from './components/setup-view';
import previewTimetableData from "@/app/data/preview-timetable.json";
import { useAuth, useUser, initiateAnonymousSignIn, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

type TimetableEntry = {
  id: string;
  fach: string;
  lehrer?: string;
  room?: string;
  start: string;
  ende: string;
  hauptfach?: boolean;
  notizen?: string;
  materialien?: string;
};

type TimetableData = {
  [key: string]: TimetableEntry[];
};

type TimetableSettings = {
    schoolStartTime: string;
    schoolEndTime: string;
    firstBreakDuration: number;
    secondBreakDuration: number;
}

type UserSettings = {
    theme?: string;
    startView?: string;
    aiLanguage?: string;
    betaFeaturesEnabled?: boolean;
    profilePicture?: string;
}

type UserData = {
    timetable: TimetableData,
    timetableSettings: TimetableSettings,
    settings: UserSettings,
    groupId?: string;
    displayName?: string;
}

export default function Page() {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { setTheme, setStartView: setThemeStartView, setAiLanguage, startView } = useTheme();

  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [appIsReady, setAppIsReady] = useState(false);
  const [localTimetable, setLocalTimetable] = useState<TimetableData | null>(null);
  const [localTimetableSettings, setLocalTimetableSettings] = useState<TimetableSettings | null>(null);
  const [view, setView] = useState('daily');

  const userDocRef = useMemoFirebase(() => 
    user && !user.isAnonymous ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);

  const { data: userData, isLoading: isUserDataLoading } = useDoc<UserData>(userDocRef);
  const isPreviewMode = useMemo(() => pathname.startsWith('/creator/'), [pathname]);

  const cleanData = useCallback((data: any): any => {
    if (data === undefined) return null;
    if (data !== null && typeof data === 'object') {
        if (data.constructor?.name === 'FieldValue' || data.constructor?.name === 'Timestamp') {
            return data;
        }
        const clean: any = Array.isArray(data) ? [] : {};
        for (const key in data) {
            clean[key] = cleanData(data[key]);
        }
        return clean;
    }
    return data;
  }, []);

  useEffect(() => {
    const evaluateState = async () => {
      // 1. Wait for Auth to settle
      if (isUserLoading) return;

      // 2. Prevent interference on auth pages
      if (pathname.includes('/login') || pathname.includes('/register')) {
          return;
      }

      // 3. Handle missing user (Anonymous auto-login)
      if (!user) {
        try {
            await initiateAnonymousSignIn(auth);
        } catch (err) {
            console.error("Auto sign-in failed", err);
        }
        return;
      }

      // 4. Handle Authenticated State
      if (!user.isAnonymous) {
        // Wait for profile to load
        if (isUserDataLoading) return;
        
        const hasCloudData = !!(userData?.timetable && Object.keys(userData.timetable).length > 0);
        const hasLocalFlag = localStorage.getItem('isSetupComplete') === 'true';
        
        setIsSetupComplete(hasCloudData || hasLocalFlag);
        
        if (userData?.settings?.startView && !view) {
            setView(userData.settings.startView);
        }
      } else {
        // Guest user
        const localSetupDone = localStorage.getItem('isSetupComplete') === 'true';
        if (localSetupDone) {
            const tt = localStorage.getItem('timetable');
            const tts = localStorage.getItem('timetableSettings');
            if (tt) setLocalTimetable(JSON.parse(tt));
            if (tts) setLocalTimetableSettings(JSON.parse(tts));
        }
        setIsSetupComplete(localSetupDone);
        
        const savedStartView = localStorage.getItem('startView');
        if (savedStartView && !view) setView(savedStartView);
      }

      setAppIsReady(true);
    };

    evaluateState();
  }, [user, isUserLoading, userData, isUserDataLoading, auth, pathname]);

  const updateUserData = async (data: Partial<UserData>) => {
    const cleaned = cleanData(data);
    if (user && !user.isAnonymous && userDocRef) {
        await setDoc(userDocRef, cleaned, { merge: true });
    } else {
        if(data.timetable) {
            localStorage.setItem('timetable', JSON.stringify(data.timetable));
            setLocalTimetable(data.timetable);
        }
        if(data.timetableSettings) {
            localStorage.setItem('timetableSettings', JSON.stringify(data.timetableSettings));
            setLocalTimetableSettings(data.timetableSettings);
        }
    }
  };

  const handleSetupComplete = async (newUserData: Partial<UserData>) => {
    const cleaned = cleanData(newUserData);
    if (user && !user.isAnonymous && userDocRef) {
      await setDoc(userDocRef, cleaned, { merge: true });
    } else {
      localStorage.setItem('isSetupComplete', 'true');
      if (newUserData.timetable) localStorage.setItem('timetable', JSON.stringify(newUserData.timetable));
      if (newUserData.timetableSettings) localStorage.setItem('timetableSettings', JSON.stringify(newUserData.timetableSettings));
    }
    setIsSetupComplete(true);
    setView(startView || 'daily');
  };

  const handleTimetableImport = (importedData: any) => {
    const dataToSave = cleanData({
      timetable: importedData.timetable,
      timetableSettings: importedData.timetableSettings,
      settings: {
        theme: importedData.theme,
        startView: importedData.startView,
        aiLanguage: importedData.aiLanguage,
        betaFeaturesEnabled: importedData.betaFeaturesEnabled === 'true',
        profilePicture: importedData.profilePicture,
      }
    });
    
    if (user && !user.isAnonymous && userDocRef) {
        setDoc(userDocRef, dataToSave, { merge: true }).then(() => window.location.reload());
    } else {
        localStorage.setItem('isSetupComplete', 'true');
        if (importedData.timetable) localStorage.setItem('timetable', JSON.stringify(importedData.timetable));
        if (importedData.timetableSettings) localStorage.setItem('timetableSettings', JSON.stringify(importedData.timetableSettings));
        window.location.reload();
    }
  };

  if (!appIsReady) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-background text-foreground p-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary"/>
        <p className="text-muted-foreground mt-4 animate-pulse">Initialisiere Scoodol...</p>
      </div>
    );
  }

  if (isSetupComplete === false) {
    return <SetupView 
        onSetupComplete={handleSetupComplete} 
        onTimetableImport={handleTimetableImport} 
        initialData={{ settings: { profilePicture: localStorage.getItem('profilePicture') || undefined }}}
    />;
  }

  const currentTimetable = (user && !user.isAnonymous) ? (userData?.timetable || {}) : (localTimetable || {});
  const currentSettings = (user && !user.isAnonymous) ? (userData?.timetableSettings || { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 }) : (localTimetableSettings || { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 });

  const renderView = () => {
    const effectiveTimetable = isPreviewMode ? previewTimetableData : currentTimetable;
    const effectiveSettings = isPreviewMode ? { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 } : currentSettings;

    switch(view) {
      case 'daily': return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={effectiveSettings} onTimetableUpdate={(nt) => updateUserData({ timetable: nt })} />;
      case 'weekly': return <ClassicTimetableView setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={effectiveSettings} />;
      case 'homework': return <HomeworkPlanner />;
      case 'smart-tool': return <SmartToolsView />;
      case 'settings': return <SettingsView onEditTimetable={() => setView('edit')} isPreview={isPreviewMode} onTimetableImport={handleTimetableImport} timetableSettings={effectiveSettings} onSettingsChange={(ns) => updateUserData({ timetableSettings: ns })} isTimetableSynced={false} />;
      case 'edit': return <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} initialData={{ timetable: currentTimetable, timetableSettings: currentSettings }} isEditing={true} viewMode="edit" />;
      default: return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={effectiveSettings} onTimetableUpdate={(nt) => updateUserData({ timetable: nt })} />;
    }
  }

  return (
    <main className="container mx-auto p-4 md:p-8 relative min-h-screen pb-24">
      {renderView()}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-50">
        <div className="bg-background/80 backdrop-blur-sm rounded-full p-2 flex justify-around items-center shadow-lg border">
          <Button variant={view === 'daily' || view === 'weekly' ? 'secondary' : 'ghost'} size="icon" className="rounded-full h-14 w-14 flex flex-col gap-1" onClick={() => setView('daily')}><Home className="w-5 h-5" /><span className="text-[10px]">Heute</span></Button>
          <Button variant={view === 'homework' ? 'secondary' : 'ghost'} size="icon" className="rounded-full h-14 w-14 flex flex-col gap-1" onClick={() => setView('homework')}><ListChecks className="w-5 h-5" /><span className="text-[10px]">Aufgaben</span></Button>
          <Button variant={view === 'smart-tool' ? 'secondary' : 'ghost'} size="icon" className="rounded-full h-14 w-14 flex flex-col gap-1" onClick={() => setView('smart-tool')}><Sparkles className="w-5 h-5" /><span className="text-[10px]">Tools</span></Button>
          <Button variant={view === 'settings' ? 'secondary' : 'ghost'} size="icon" className="rounded-full h-14 w-14 flex flex-col gap-1" onClick={() => setView('settings')}><Settings className="w-5 h-5" /><span className="text-[10px]">Einst.</span></Button>
        </div>
      </div>
    </main>
  );
}
