
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { CustomAfternoonLesson } from '@/app/components/afternoon-lessons-dialog';
import AfternoonEditorView from './components/afternoon-editor-view';
import { generateTimeSlots } from '@/app/components/setup-view';

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
  isCustomAfternoon?: boolean;
  afternoonType?: string;
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
    afternoonStartTime?: string;
    afternoonLessonDuration?: number;
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
    },
    customAfternoon?: CustomAfternoonLesson[];
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
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('startView') || '';
    }
    return '';
  });
  const [hasLocalData, setHasLocalData] = useState(() => {
    if (typeof window !== 'undefined') {
      const tt = localStorage.getItem('timetable');
      return !!tt && tt !== '{}';
    }
    return false;
  });
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

  // Sync DB snapshots to cache immediately to ensure instantaneous future loads
  useEffect(() => {
    if (userData) {
      if (userData.timetable) localStorage.setItem('timetable', JSON.stringify(userData.timetable));
      if (userData.timetableSettings) localStorage.setItem('timetableSettings', JSON.stringify(userData.timetableSettings));
      if (userData.customAfternoon) localStorage.setItem('customAfternoon', JSON.stringify(userData.customAfternoon));
      if (userData.groupSettings?.syncTimetable !== undefined) localStorage.setItem('syncTimetable', String(userData.groupSettings.syncTimetable));
      if (userData.groupId) localStorage.setItem('groupId', userData.groupId);
    }
  }, [userData]);

  useEffect(() => {
    if (groupData) {
      if (groupData.timetable) localStorage.setItem('cached_group_timetable', JSON.stringify(groupData.timetable));
      if (groupData.timetableSettings) localStorage.setItem('cached_group_timetableSettings', JSON.stringify(groupData.timetableSettings));
    }
  }, [groupData]);

  // Safely initialize client-side state
  useEffect(() => {
    setIsMounted(true);
    const cachedStartView = localStorage.getItem('startView');
    if (cachedStartView && !view) setView(cachedStartView);
    else if (!view) setView('daily');

    const tt = localStorage.getItem('timetable');
    setHasLocalData(!!tt && tt !== '{}');
  }, [view]);

  useEffect(() => {
    if (!isMounted || isUserLoading) return;
    
    // Redirect to login only if accessing protected routes, otherwise allow root for Welcome/Guest view
    if (!user || user.isAnonymous) {
        if (pathname.startsWith('/workspace') || pathname.startsWith('/admin') || pathname.startsWith('/account')) {
            router.replace('/login');
        }
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
        if (data.customAfternoon) localStorage.setItem('customAfternoon', JSON.stringify(data.customAfternoon));
        if (data.settings?.startView) localStorage.setItem('startView', data.settings.startView);
    }

    if (!userDocRef) return;
    
    // Safely update nested fields without overwriting everything
    const updates: any = {};
    if (data.timetable) updates.timetable = data.timetable;
    if (data.timetableSettings) updates.timetableSettings = data.timetableSettings;
    if (data.customAfternoon) updates.customAfternoon = data.customAfternoon;
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
        if (newUserData.customAfternoon) localStorage.setItem('customAfternoon', JSON.stringify(newUserData.customAfternoon));
        if (newUserData.settings?.profilePicture) localStorage.setItem('profilePicture', newUserData.settings.profilePicture);
        if (newUserData.settings?.startView) localStorage.setItem('startView', newUserData.settings.startView);
    }

    if (userDocRef) {
        const updates: any = {};
        if (newUserData.timetable) updates.timetable = newUserData.timetable;
        if (newUserData.timetableSettings) updates.timetableSettings = newUserData.timetableSettings;
        if (newUserData.customAfternoon) updates.customAfternoon = newUserData.customAfternoon;
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
        if (importedData.customAfternoon) localStorage.setItem('customAfternoon', JSON.stringify(importedData.customAfternoon));
    }
    
    if (!userDocRef) {
        window.location.reload();
        return;
    }
    
    const updates: any = {
        timetable: importedData.timetable,
        timetableSettings: importedData.timetableSettings,
        customAfternoon: importedData.customAfternoon || [],
        'settings.theme': importedData.theme,
        'settings.startView': importedData.startView,
        'settings.aiLanguage': importedData.aiLanguage,
        'settings.betaFeaturesEnabled': importedData.betaFeaturesEnabled === 'true',
        'settings.profilePicture': importedData.profilePicture,
    };
    
    updateDoc(userDocRef, updates).then(() => window.location.reload());
  };

  const isTimetableSynced = useMemo(() => {
    if (userData?.groupSettings?.syncTimetable !== undefined) {
      return !!userData.groupSettings.syncTimetable;
    }
    if (typeof window !== 'undefined') {
      return localStorage.getItem('syncTimetable') === 'true';
    }
    return false;
  }, [userData?.groupSettings?.syncTimetable]);

  const prevSettingsRef = useRef<TimetableSettings>({ schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 });
  const prevSettingsStringRef = useRef<string>('');

  const effectiveSettings = useMemo(() => {
    if (isPreviewMode) return { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 };
    
    let result: TimetableSettings = { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 };

    if (isTimetableSynced) {
      if (groupData?.timetableSettings) {
        result = groupData.timetableSettings;
      } else if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('cached_group_timetableSettings');
        if (cached) {
          try { result = JSON.parse(cached); } catch (e) {}
        }
      }
    } else if (userData?.timetableSettings) {
      result = userData.timetableSettings;
    } else if (typeof window !== 'undefined') {
      const local = localStorage.getItem('timetableSettings');
      if (local) {
        try { result = JSON.parse(local); } catch (e) {}
      }
    }

    const str = JSON.stringify(result);
    if (str === prevSettingsStringRef.current) {
      return prevSettingsRef.current;
    }
    prevSettingsStringRef.current = str;
    prevSettingsRef.current = result;
    return result;
  }, [userData?.timetableSettings, isPreviewMode, isTimetableSynced, groupData?.timetableSettings]);

  const prevMergedTimetableRef = useRef<TimetableData>({});
  const prevMergedStringRef = useRef<string>('');

  const effectiveTimetable = useMemo(() => {
    if (isPreviewMode) return previewTimetableData;
    
    let baseTimetable: TimetableData = {};
    if (isTimetableSynced) {
        if (groupData?.timetable) {
          baseTimetable = groupData.timetable;
        } else if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('cached_group_timetable');
          if (cached) {
            try { baseTimetable = JSON.parse(cached); } catch (e) {}
          }
        }
    } else {
        const raw = userData?.timetable;
        if (raw) {
            // @ts-ignore
            if (raw.weekA) baseTimetable = currentWeekType === 'A' ? (raw as any).weekA : (raw as any).weekB;
            else baseTimetable = raw as TimetableData;
        } else if (typeof window !== 'undefined') {
            const local = localStorage.getItem('timetable');
            if (local) {
                try {
                    const parsed = JSON.parse(local);
                    if (parsed.weekA) baseTimetable = currentWeekType === 'A' ? parsed.weekA : parsed.weekB;
                    else baseTimetable = parsed;
                } catch (e) {}
            }
        }
    }

    // Get personal custom afternoon lessons
    let afternoonLessons: CustomAfternoonLesson[] = [];
    if (userData?.customAfternoon && Array.isArray(userData.customAfternoon)) {
        afternoonLessons = userData.customAfternoon;
    } else if (typeof window !== 'undefined') {
        const local = localStorage.getItem('customAfternoon');
        if (local) {
            try { afternoonLessons = JSON.parse(local); } catch (e) {}
        }
    }

    const weekDaysList = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
    const slots = generateTimeSlots(effectiveSettings);

    const merged: TimetableData = {};
    weekDaysList.forEach((day) => {
        const existingDay = baseTimetable[day] || [];
        // Populate standard slots
        merged[day] = slots.map((slot, idx) => {
            const existingEntry = existingDay[idx];
            return {
                id: existingEntry?.id || `${day.slice(0, 2).toLowerCase()}-${idx + 1}`,
                fach: existingEntry?.fach || '',
                lehrer: existingEntry?.lehrer || '',
                room: existingEntry?.room || '',
                start: slot.start,
                ende: slot.ende,
                hauptfach: existingEntry?.hauptfach || false,
                notizen: existingEntry?.notizen || '',
                materialien: existingEntry?.materialien || '',
            };
        });

        // Overlay custom afternoon lessons for this day and week
        const dayLessons = afternoonLessons.filter(
            (l) => l.day === day && (!l.weekType || l.weekType === 'ALL' || l.weekType === currentWeekType)
        );

        dayLessons.forEach((lesson) => {
            let targetSlot = lesson.slotIndex !== undefined ? lesson.slotIndex : 6;
            if (targetSlot < 0 || targetSlot >= 10) targetSlot = 6;

            merged[day][targetSlot] = {
                id: lesson.id || `custom-afternoon-${day}-${targetSlot}`,
                fach: lesson.fach,
                lehrer: lesson.lehrer || '',
                room: lesson.room || '',
                start: lesson.start || slots[targetSlot]?.start || '',
                ende: lesson.ende || slots[targetSlot]?.ende || '',
                hauptfach: !!lesson.hauptfach,
                isCustomAfternoon: true,
                afternoonType: 'Nachmittagsunterricht',
                notizen: lesson.notes || '',
            };
        });
    });

    const str = JSON.stringify(merged);
    if (str === prevMergedStringRef.current && Object.keys(prevMergedTimetableRef.current).length > 0) {
      return prevMergedTimetableRef.current;
    }
    prevMergedStringRef.current = str;
    prevMergedTimetableRef.current = merged;
    return merged;
  }, [userData, isPreviewMode, currentWeekType, isTimetableSynced, groupData, effectiveSettings]);

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
            <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} initialData={{ settings: { profilePicture: undefined }, customAfternoon: userData?.customAfternoon }} />
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
      case 'settings': return <SettingsView onEditTimetable={() => setView('edit')} onEditAfternoon={() => setView('afternoon')} isPreview={isPreviewMode} onTimetableImport={handleTimetableImport} timetableSettings={effectiveSettings} onSettingsChange={(ns) => updateUserData({ timetableSettings: ns })} isTimetableSynced={isTimetableSynced} customAfternoonLessons={userData?.customAfternoon} onCustomAfternoonChange={(na) => updateUserData({ customAfternoon: na })} />;
      case 'edit': return <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} initialData={{ timetable: userData?.timetable || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('timetable') || '{}') : {}), timetableSettings: effectiveSettings, customAfternoon: userData?.customAfternoon }} isEditing={true} viewMode="edit" />;
      case 'afternoon': return <AfternoonEditorView onBack={() => setView('settings')} onSave={(na) => updateUserData({ customAfternoon: na })} initialLessons={userData?.customAfternoon} timetableSettings={effectiveSettings} baseTimetable={isTimetableSynced && groupData?.timetable ? groupData.timetable : (userData?.timetable || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('timetable') || '{}') : {}))} />;
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
      
      {view !== 'edit' && view !== 'afternoon' && view !== '' && (
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
