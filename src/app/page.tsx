
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
import { APP_VERSION } from '@/lib/version';

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
    isABWeekActive?: boolean;
}

type UserSettings = {
    theme?: string;
    startView?: string;
    aiLanguage?: string;
    betaFeaturesEnabled?: boolean;
    profilePicture?: string;
}

type UserData = {
    timetable: TimetableData | { weekA: TimetableData, weekB: TimetableData },
    timetableSettings: TimetableSettings,
    settings: UserSettings,
    displayName?: string;
    groupId?: string;
    groupSettings?: {
        syncTimetable?: boolean;
    }
}

const getWeekNumber = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export default function Page() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { startView, updateSettings } = useTheme();

  const [view, setView] = useState('');
  const [manualWeekToggle, setManualWeekToggle] = useState<'A' | 'B' | null>(null);

  const userDocRef = useMemoFirebase(() => 
    user && !user.isAnonymous ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);

  const { data: userData, isLoading: isUserDataLoading } = useDoc<UserData>(userDocRef);

  const groupDocRef = useMemoFirebase(() => 
    userData?.groupId ? doc(firestore, 'groups', userData.groupId) : null
  , [firestore, userData?.groupId]);
  const { data: groupData } = useDoc<any>(groupDocRef);

  const isPreviewMode = useMemo(() => pathname.startsWith('/creator/'), [pathname]);

  const currentWeekType = useMemo(() => {
    if (manualWeekToggle) return manualWeekToggle;
    const weekNum = getWeekNumber(new Date());
    return weekNum % 2 !== 0 ? 'A' : 'B';
  }, [manualWeekToggle]);

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

  const hasLocalData = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const tt = localStorage.getItem('timetable');
    return !!tt && tt !== '{}';
  }, []);

  useEffect(() => {
    if (isUserLoading) return;
    
    // Redirect to login only if accessing protected routes, otherwise allow root for Welcome/Guest view
    if (!user || user.isAnonymous) {
        if (pathname.startsWith('/workspace') || pathname.startsWith('/admin') || pathname.startsWith('/account')) {
            router.replace('/login');
        }
        // Root page handling for unauthenticated
        if (pathname === '/' && !view) {
            if (hasLocalData) setView('daily');
            else setView(''); // Triggers SetupView below
        }
        return;
    }

    if (!view && !isUserDataLoading) {
        if (userData?.settings?.startView) setView(userData.settings.startView);
        else {
            // Fallback to cache while doc is potentially still empty/missing fields
            const cachedStartView = localStorage.getItem('startView');
            setView(cachedStartView || 'daily');
        }
    }
    
    // Early view setting if we have cache
    if (!view && isUserDataLoading && hasLocalData) {
        const cachedStartView = localStorage.getItem('startView');
        setView(cachedStartView || 'daily');
    }
  }, [user, isUserLoading, userData, isUserDataLoading, router, pathname, view, hasLocalData]);

  const updateUserData = async (data: Partial<UserData>) => {
    // Always update local cache first
    if (typeof window !== 'undefined') {
        if (data.timetable) localStorage.setItem('timetable', JSON.stringify(data.timetable));
        if (data.timetableSettings) localStorage.setItem('timetableSettings', JSON.stringify(data.timetableSettings));
        if (data.settings?.startView) localStorage.setItem('startView', data.settings.startView);
    }

    if (!userDocRef) return;
    const cleaned = cleanData(data);
    await setDoc(userDocRef, cleaned, { merge: true });
  };

  const handleSetupComplete = async (newUserData: Partial<UserData>) => {
    // Update cache
    if (typeof window !== 'undefined') {
        if (newUserData.timetable) localStorage.setItem('timetable', JSON.stringify(newUserData.timetable));
        if (newUserData.timetableSettings) localStorage.setItem('timetableSettings', JSON.stringify(newUserData.timetableSettings));
        if (newUserData.settings?.profilePicture) localStorage.setItem('profilePicture', newUserData.settings.profilePicture);
        if (newUserData.settings?.startView) localStorage.setItem('startView', newUserData.settings.startView);
    }

    if (userDocRef) {
        const cleaned = cleanData(newUserData);
        await setDoc(userDocRef, cleaned, { merge: true });
    }
    setView(newUserData.settings?.startView || startView || 'daily');
  };

  const handleTimetableImport = (importedData: any) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('timetable', JSON.stringify(importedData.timetable));
        localStorage.setItem('timetableSettings', JSON.stringify(importedData.timetableSettings));
    }
    
    if (!userDocRef) {
        window.location.reload();
        return;
    }
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

  const isTimetableSynced = !!(userData?.groupSettings?.syncTimetable && groupData);

  const effectiveTimetable = useMemo(() => {
    if (isPreviewMode) return previewTimetableData;
    if (isTimetableSynced) return groupData?.timetable;
    
    const raw = userData?.timetable;
    if (raw) {
        // @ts-ignore
        if (raw.weekA) return currentWeekType === 'A' ? (raw as any).weekA : (raw as any).weekB;
        return raw as TimetableData;
    }

    // Guest / Cache fallback
    if (typeof window !== 'undefined') {
        const local = localStorage.getItem('timetable');
        if (local) {
            try {
                const parsed = JSON.parse(local);
                if (parsed.weekA) return currentWeekType === 'A' ? parsed.weekA : parsed.weekB;
                return parsed;
            } catch (e) { return {}; }
        }
    }
    return {};
  }, [userData, isPreviewMode, currentWeekType, isTimetableSynced, groupData]);

  const effectiveSettings = useMemo(() => {
    if (isPreviewMode) return { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 };
    if (isTimetableSynced) return groupData?.timetableSettings;
    
    if (userData?.timetableSettings) return userData.timetableSettings;

    // Guest / Cache fallback
    if (typeof window !== 'undefined') {
        const local = localStorage.getItem('timetableSettings');
        if (local) {
            try { return JSON.parse(local); } catch (e) {}
        }
    }
    return { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 };
  }, [userData, isPreviewMode, isTimetableSynced, groupData]);

  // Show loader only if we have NO data at all and we are loading
  if (isUserLoading || (user && isUserDataLoading && !view && !hasLocalData)) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-background p-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary"/>
        <p className="text-muted-foreground mt-4 font-bold uppercase text-[10px]">Scoodol wird geladen...</p>
      </div>
    );
  }

  // Show setup if no data exists (for both users and guests)
  const hasNoData = (!user && !hasLocalData) || (user && !isUserDataLoading && (!userData?.timetable || Object.keys(userData.timetable).length === 0) && !hasLocalData);
  
  if (!view && hasNoData) {
    return <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} initialData={{ settings: { profilePicture: undefined }}} />;
  }

  const renderView = () => {
    switch(view) {
      case 'daily': return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={effectiveSettings} onTimetableUpdate={(nt) => {
          if (isTimetableSynced) return;
          const isAB = effectiveSettings.isABWeekActive;
          if (isAB) {
              const fullTimetable = userData?.timetable || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('timetable') || '{}') : {});
              const updated = currentWeekType === 'A' ? { ...fullTimetable, weekA: nt } : { ...fullTimetable, weekB: nt };
              updateUserData({ timetable: updated });
          } else {
              updateUserData({ timetable: nt });
          }
      }} currentWeek={(isTimetableSynced ? groupData?.timetableSettings?.isABWeekActive : effectiveSettings.isABWeekActive) ? currentWeekType : null} />;
      case 'weekly': return <ClassicTimetableView setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={effectiveSettings} currentWeek={(isTimetableSynced ? groupData?.timetableSettings?.isABWeekActive : effectiveSettings.isABWeekActive) ? currentWeekType : null} onWeekToggle={(w) => setManualWeekToggle(w)} />;
      case 'homework': return <HomeworkPlanner />;
      case 'smart-tool': return <SmartToolsView />;
      case 'settings': return <SettingsView onEditTimetable={() => setView('edit')} isPreview={isPreviewMode} onTimetableImport={handleTimetableImport} timetableSettings={effectiveSettings} onSettingsChange={(ns) => updateUserData({ timetableSettings: ns })} isTimetableSynced={isTimetableSynced} />;
      case 'edit': return <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} initialData={{ timetable: userData?.timetable || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('timetable') || '{}') : {}), timetableSettings: effectiveSettings }} isEditing={true} viewMode="edit" />;
      default: return null;
    }
  }

  return (
    <main className="container mx-auto p-4 md:p-8 relative min-h-screen pb-24">
      {renderView()}
      {view !== 'edit' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50">
          <div className="bg-background/80 backdrop-blur-sm rounded-full p-2 flex justify-around items-center shadow-lg border">
            <Button variant={view === 'daily' || view === 'weekly' ? 'secondary' : 'ghost'} size="icon" className="rounded-full h-14 w-14 flex flex-col gap-1" onClick={() => { setView('daily'); setManualWeekToggle(null); }}><Home className="w-5 h-5" /><span className="text-[10px]">Heute</span></Button>
            <Button variant={view === 'homework' ? 'secondary' : 'ghost'} size="icon" className="rounded-full h-14 w-14 flex flex-col gap-1" onClick={() => setView('homework')}><ListChecks className="w-5 h-5" /><span className="text-[10px]">Aufgaben</span></Button>
            <Button variant={view === 'smart-tool' ? 'secondary' : 'ghost'} size="icon" className="rounded-full h-14 w-14 flex flex-col gap-1" onClick={() => setView('smart-tool')}><Sparkles className="w-5 h-5" /><span className="text-[10px]">Tools</span></Button>
            <Button variant={view === 'settings' ? 'secondary' : 'ghost'} size="icon" className="rounded-full h-14 w-14 flex flex-col gap-1" onClick={() => setView('settings')}><Settings className="w-5 h-5" /><span className="text-[10px]">Einst.</span></Button>
          </div>
        </div>
      )}
    </main>
  );
}
