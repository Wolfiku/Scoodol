
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
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { signInAnonymously } from '@/firebase/non-blocking-login';

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
    displayName?: string;
}

export default function Page() {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { startView } = useTheme();

  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [appIsReady, setAppIsReady] = useState(false);
  const [view, setView] = useState('');

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
    if (isUserLoading) return;

    // Trigger anonymous sign-in if no user exists at all
    if (!user) {
        signInAnonymously(auth);
        return;
    }

    // Wait for permanent profile data if logged in
    if (!user.isAnonymous && isUserDataLoading) return;

    // Check setup state
    let setupDone = false;
    if (!user.isAnonymous) {
        // Registered users: check cloud data
        setupDone = !!(userData?.timetable && Object.keys(userData.timetable).length > 0);
    } else {
        // Guests: check local storage
        try {
            const localTimetable = localStorage.getItem('timetable');
            setupDone = !!(localTimetable && localTimetable !== '{}');
        } catch (e) {
            setupDone = false;
        }
    }
    
    setIsSetupComplete(setupDone);
    
    // Set initial view
    if (!view) {
        if (!user.isAnonymous && userData?.settings?.startView) {
            setView(userData.settings.startView);
        } else {
            const localStartView = localStorage.getItem('startView');
            setView(localStartView || 'daily');
        }
    }

    setAppIsReady(true);
  }, [user, isUserLoading, userData, isUserDataLoading, auth, view]);

  const updateUserData = async (data: Partial<UserData>) => {
    const cleaned = cleanData(data);
    if (userDocRef) {
        await setDoc(userDocRef, cleaned, { merge: true });
    } else {
        // Guest mode: save locally
        if (data.timetable) localStorage.setItem('timetable', JSON.stringify(data.timetable));
        if (data.timetableSettings) localStorage.setItem('timetableSettings', JSON.stringify(data.timetableSettings));
        if (data.settings) {
            if (data.settings.theme) localStorage.setItem('theme', data.settings.theme);
            if (data.settings.startView) localStorage.setItem('startView', data.settings.startView);
        }
    }
  };

  const handleSetupComplete = async (newUserData: Partial<UserData>) => {
    const cleaned = cleanData(newUserData);
    if (userDocRef) {
      await setDoc(userDocRef, cleaned, { merge: true });
    } else {
        // Save locally for guests
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
    
    if (userDocRef) {
        setDoc(userDocRef, dataToSave, { merge: true }).then(() => window.location.reload());
    } else {
        // Local import
        localStorage.setItem('timetable', JSON.stringify(importedData.timetable));
        localStorage.setItem('timetableSettings', JSON.stringify(importedData.timetableSettings));
        window.location.reload();
    }
  };

  if (isUserLoading || (!appIsReady && user)) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-background text-foreground p-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary"/>
        <p className="text-muted-foreground mt-4 animate-pulse font-bold tracking-widest uppercase text-xs">Scoodol wird geladen...</p>
      </div>
    );
  }

  // Show Setup if not complete (works for both guests and members)
  if (isSetupComplete === false) {
    return <SetupView 
        onSetupComplete={handleSetupComplete} 
        onTimetableImport={handleTimetableImport} 
        initialData={{ settings: { profilePicture: undefined }}}
    />;
  }

  // Get effective data (Cloud for members, Local for guests)
  const getLocalData = (key: string, fallback: any) => {
      try {
          const item = localStorage.getItem(key);
          return item ? JSON.parse(item) : fallback;
      } catch (e) { return fallback; }
  }

  const currentTimetable = !user?.isAnonymous ? (userData?.timetable || {}) : getLocalData('timetable', {});
  const currentSettings = !user?.isAnonymous ? (userData?.timetableSettings || { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 }) : getLocalData('timetableSettings', { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 });

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
