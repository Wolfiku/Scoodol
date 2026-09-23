
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
import { doc, updateDoc } from 'firebase/firestore';
import { APP_VERSION } from '@/app/lib/version';
import { ReleaseNotesDialog } from '@/components/release-notes-dialog';
import { cn } from '@/lib/utils';

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
  const { startView: themeStartView } = useTheme();

  const [isMounted, setIsMounted] = useState(false);
  const [view, setView] = useState('');
  const [hasLocalData, setHasLocalData] = useState(false);
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

  // Safely initialize client-side state
  useEffect(() => {
    setIsMounted(true);
    const cachedStartView = localStorage.getItem('startView');
    if (cachedStartView) setView(cachedStartView);

    const tt = localStorage.getItem('timetable');
    setHasLocalData(!!tt && tt !== '{}');
  }, []);

  useEffect(() => {
    if (!isMounted || isUserLoading) return;
    
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
            const cachedStartView = localStorage.getItem('startView');
            setView(cachedStartView || 'daily');
        }
    }
  }, [user, isUserLoading, userData, isUserDataLoading, router, pathname, view, hasLocalData, isMounted]);

  const updateUserData = async (data: Partial<UserData>) => {
    // Always update local cache first
    if (typeof window !== 'undefined') {
        if (data.timetable) localStorage.setItem('timetable', JSON.stringify(data.timetable));
        if (data.timetableSettings) localStorage.setItem('timetableSettings', JSON.stringify(data.timetableSettings));
        if (data.settings?.startView) localStorage.setItem('startView', data.settings.startView);
    }

    if (!userDocRef) return;
    
    // Safely update nested fields without overwriting everything
    const updates: any = {};
    if (data.timetable) updates.timetable = data.timetable;
    if (data.timetableSettings) updates.timetableSettings = data.timetableSettings;
    if (data.settings) {
        Object.keys(data.settings).forEach(key => {
            updates[`settings.${key}`] = (data.settings as any)[key];
        });
    }
    if (data.displayName) updates.displayName = data.displayName;
    if (data.groupId) updates.groupId = data.groupId;
    
    if (Object.keys(updates).length > 0) {
        await updateDoc(userDocRef, updates);
    }
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
        const updates: any = {};
        if (newUserData.timetable) updates.timetable = newUserData.timetable;
        if (newUserData.timetableSettings) updates.timetableSettings = newUserData.timetableSettings;
        if (newUserData.settings) {
            Object.keys(newUserData.settings).forEach(key => {
                updates[`settings.${key}`] = (newUserData.settings as any)[key];
            });
        }
        await updateDoc(userDocRef, updates);
    }
    setView(newUserData.settings?.startView || themeStartView || 'daily');
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
    
    const updates: any = {
        timetable: importedData.timetable,
        timetableSettings: importedData.timetableSettings,
        'settings.theme': importedData.theme,
        'settings.startView': importedData.startView,
        'settings.aiLanguage': importedData.aiLanguage,
        'settings.betaFeaturesEnabled': importedData.betaFeaturesEnabled === 'true',
        'settings.profilePicture': importedData.profilePicture,
    };
    
    updateDoc(userDocRef, updates).then(() => window.location.reload());
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

  // Initial Loader to match server during hydration
  if (!isMounted || ((isUserLoading || isUserDataLoading) && !hasLocalData && !view)) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-background p-4 relative">
        <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary"/>
            <p className="text-muted-foreground mt-4 font-bold uppercase text-[10px]">Scoodol wird geladen...</p>
        </div>

        {/* Branding Footer */}
        <div className="absolute bottom-8 left-8 right-8 flex justify-between items-center text-[10px] text-muted-foreground/60 font-black uppercase tracking-widest pointer-events-none">
          <span>Version {APP_VERSION}</span>
          <span>@wolfikuproduction</span>
        </div>
      </div>
    );
  }

  // Show setup if no data exists (for both users and guests)
  const hasNoData = (!user && !hasLocalData && !view) || (user && !isUserDataLoading && (!userData?.timetable || Object.keys(userData.timetable).length === 0) && !hasLocalData && !view);
  
  if (!view && hasNoData) {
    return (
        <>
            <ReleaseNotesDialog />
            <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} initialData={{ settings: { profilePicture: undefined }}} />
        </>
    );
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

  const NavButton = ({ targetView, icon: Icon, label }: { targetView: string, icon: any, label: string }) => {
    const isActive = view === targetView || (targetView === 'daily' && view === 'weekly');
    return (
      <button 
        onClick={() => {
            if (targetView === 'daily') setManualWeekToggle(null);
            setView(targetView);
        }}
        className={cn(
          "flex flex-col items-center justify-center py-2 px-1 transition-all rounded-lg flex-1",
          isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-secondary/80"
        )}
      >
        <Icon className={cn("w-5 h-5 mb-1", isActive ? "stroke-[2px]" : "stroke-[1.5px]")} />
        <span className={cn("text-[11px] leading-tight", isActive ? "opacity-100" : "opacity-70")}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <main className="container mx-auto p-4 md:p-8 relative min-h-screen pb-24">
      <ReleaseNotesDialog />
      {renderView()}
      
      {view !== 'edit' && view !== '' && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-50 flex justify-center pointer-events-none">
          <nav className="bg-card/80 backdrop-blur-md border-2 border-border rounded-xl p-1.5 flex gap-1 w-full max-w-sm shadow-xl pointer-events-auto">
            <NavButton targetView="daily" icon={Home} label="Heute" />
            <NavButton targetView="homework" icon={ListChecks} label="Planer" />
            <NavButton targetView="smart-tool" icon={Sparkles} label="Tools" />
            <NavButton targetView="settings" icon={Settings} label="Optionen" />
          </nav>
        </div>
      )}
    </main>
  );
}
