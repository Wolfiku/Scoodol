
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
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { APP_VERSION } from '@/app/lib/version';

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
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { startView } = useTheme();

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

    // NO GUEST ACCOUNTS: Redirect to login if no user is present
    if (!user || user.isAnonymous) {
        if (!pathname.startsWith('/login') && !pathname.startsWith('/register') && !pathname.startsWith('/public')) {
            router.replace('/login');
        }
        return;
    }

    // Set initial view once user and data are loaded
    if (!view && !isUserDataLoading) {
        if (userData?.settings?.startView) {
            setView(userData.settings.startView);
        } else {
            setView('daily');
        }
    }
  }, [user, isUserLoading, userData, isUserDataLoading, router, pathname, view]);

  const updateUserData = async (data: Partial<UserData>) => {
    if (!userDocRef) return;
    const cleaned = cleanData(data);
    await setDoc(userDocRef, cleaned, { merge: true });
  };

  const handleSetupComplete = async (newUserData: Partial<UserData>) => {
    if (!userDocRef) return;
    const cleaned = cleanData(newUserData);
    await setDoc(userDocRef, cleaned, { merge: true });
    setView(startView || 'daily');
  };

  const handleTimetableImport = (importedData: any) => {
    if (!userDocRef) return;
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
    setDoc(userDocRef, dataToSave, { merge: true }).then(() => window.location.reload());
  };

  if (isUserLoading || (user && isUserDataLoading && !view)) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-background text-foreground p-4 relative overflow-hidden">
        <div className="flex flex-col items-center animate-in fade-in duration-500">
            <Loader2 className="w-12 h-12 animate-spin text-primary"/>
            <p className="text-muted-foreground mt-4 animate-pulse font-bold tracking-widest uppercase text-[10px]">Scoodol wird geladen...</p>
        </div>
        
        {/* Footer info for the loading screen */}
        <div className="absolute bottom-8 left-8 text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] select-none">
            @wolfikuproduction
        </div>
        <div className="absolute bottom-8 right-8 text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest select-none">
            v{APP_VERSION}
        </div>
      </div>
    );
  }

  // Show Setup if authenticated but no data yet
  if (user && !isUserDataLoading && (!userData?.timetable || Object.keys(userData.timetable).length === 0)) {
    return <SetupView 
        onSetupComplete={handleSetupComplete} 
        onTimetableImport={handleTimetableImport} 
        initialData={{ settings: { profilePicture: undefined }}}
    />;
  }

  const renderView = () => {
    const effectiveTimetable = isPreviewMode ? previewTimetableData : (userData?.timetable || {});
    const effectiveSettings = isPreviewMode ? { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 } : (userData?.timetableSettings || { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 });

    switch(view) {
      case 'daily': return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={effectiveSettings} onTimetableUpdate={(nt) => updateUserData({ timetable: nt })} />;
      case 'weekly': return <ClassicTimetableView setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={effectiveSettings} />;
      case 'homework': return <HomeworkPlanner />;
      case 'smart-tool': return <SmartToolsView />;
      case 'settings': return <SettingsView onEditTimetable={() => setView('edit')} isPreview={isPreviewMode} onTimetableImport={handleTimetableImport} timetableSettings={effectiveSettings} onSettingsChange={(ns) => updateUserData({ timetableSettings: ns })} isTimetableSynced={false} />;
      case 'edit': return <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} initialData={{ timetable: userData?.timetable, timetableSettings: userData?.timetableSettings }} isEditing={true} viewMode="edit" />;
      default: return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={effectiveSettings} onTimetableUpdate={(nt) => updateUserData({ timetable: nt })} />;
    }
  }

  if (!user) return null;

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
