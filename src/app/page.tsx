"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import ClassicTimetableView from '@/app/components/classic-timetable-view';
import HomeworkPlanner from '@/app/components/homework-planner';
import { Button } from '@/components/ui/button';
import { Home, ListChecks, Sparkles, Settings, Timer, Loader2 } from 'lucide-react';
import SmartToolsView from './components/smart-tools-view';
import SettingsView from './components/settings-view';
import { useTheme } from '@/hooks/use-theme';
import SetupView from './components/setup-view';
import previewTimetableData from "@/app/data/preview-timetable.json";
import { useToast } from '@/hooks/use-toast';
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

type GroupSettings = {
    syncTimetable?: boolean;
    showInGroup?: boolean;
    shareHomework?: boolean;
}

type UserData = {
    timetable: TimetableData,
    timetableSettings: TimetableSettings,
    settings: UserSettings,
    groupId?: string;
    groupSettings?: GroupSettings;
    displayName?: string;
}

type GroupData = {
    timetable: TimetableData,
    timetableSettings: TimetableSettings,
    name?: string;
}

export default function Page() {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const { setTheme, setStartView: setThemeStartView, setAiLanguage, startView } = useTheme();

  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [appIsReady, setAppIsReady] = useState(false);

  const [localTimetable, setLocalTimetable] = useState<TimetableData | null>(null);
  const [localTimetableSettings, setLocalTimetableSettings] = useState<TimetableSettings | null>(null);
  const [localSettings, setLocalSettings] = useState<UserSettings | null>(null);
  
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path.startsWith('/edit/')) return 'edit';
    }
    return 'daily';
  });

  const userDocRef = useMemoFirebase(() => 
    user && !user.isAnonymous ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);

  const { data: userData, isLoading: isUserDataLoading } = useDoc<UserData>(userDocRef);

  const groupDocRef = useMemoFirebase(() => 
    userData?.groupId ? doc(firestore, 'groups', userData.groupId) : null
  , [firestore, userData?.groupId]);

  const { data: groupData, isLoading: isGroupDataLoading } = useDoc<GroupData>(groupDocRef);
  
  const isPreviewMode = useMemo(() => pathname.startsWith('/creator/'), [pathname]);

  // 1. Initial Load: Get what we have locally
  useEffect(() => {
    try {
      const localSetupDone = localStorage.getItem('isSetupComplete') === 'true';
      if (localSetupDone) {
        const tt = localStorage.getItem('timetable');
        if (tt) setLocalTimetable(JSON.parse(tt));
        const tts = localStorage.getItem('timetableSettings');
        if (tts) setLocalTimetableSettings(JSON.parse(tts));
        
        setLocalSettings({
            theme: localStorage.getItem('theme') || undefined,
            startView: (localStorage.getItem('startView') as UserSettings['startView']) || undefined,
            aiLanguage: (localStorage.getItem('aiLanguage') as UserSettings['aiLanguage']) || undefined,
            profilePicture: localStorage.getItem('profilePicture') || undefined
        });
      }
    } catch (e) {
      console.error("Failed to parse local storage data:", e);
    }
  }, []);

  // 2. Auth & Setup State Logic
  useEffect(() => {
    const evaluateState = async () => {
      if (isUserLoading) return;

      // Handle missing user
      if (!user) {
        // Prevent infinite loop if sign-in fails
        try {
            await initiateAnonymousSignIn(auth);
        } catch (err) {
            console.error("Anonymous sign-in failed", err);
        }
        return;
      }

      // If user is logged in (real or anonymous), check for data
      if (!user.isAnonymous) {
        // Wait for cloud data to finish loading
        if (isUserDataLoading) return;
        
        const hasCloudTimetable = !!(userData?.timetable && Object.keys(userData.timetable).length > 0);
        const hasLocalFlag = localStorage.getItem('isSetupComplete') === 'true';
        
        setIsSetupComplete(hasCloudTimetable || hasLocalFlag);
        
        // Apply remote settings to local view if it's our first load
        if (userData?.settings?.startView && !localSettings?.startView) {
            setView(userData.settings.startView as any);
        }
      } else {
        // For anonymous, we purely trust the local storage flag
        const localSetupDone = localStorage.getItem('isSetupComplete') === 'true';
        setIsSetupComplete(localSetupDone);
        
        const savedStartView = localStorage.getItem('startView') as UserSettings['startView'];
        if (savedStartView) setView(savedStartView as any);
      }

      setAppIsReady(true);
    };

    evaluateState();
  }, [user, isUserLoading, userData, isUserDataLoading, auth, localSettings?.startView]);

  const cleanData = (data: any): any => {
    if (data === undefined) return null;
    if (data !== null && typeof data === 'object') {
        // Preserve Firebase internal types
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
  };

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
        if(data.settings) {
            const newSettings = {...localSettings, ...data.settings };
            setLocalSettings(newSettings);
            if (newSettings.theme) localStorage.setItem('theme', newSettings.theme);
            if (newSettings.startView) localStorage.setItem('startView', newSettings.startView);
            if (newSettings.aiLanguage) localStorage.setItem('aiLanguage', newSettings.aiLanguage);
        }
    }
  }

  const handleSetupComplete = async (newUserData: Partial<UserData>) => {
    const cleaned = cleanData(newUserData);
    if (user && !user.isAnonymous && userDocRef) {
      await setDoc(userDocRef, cleaned, { merge: true });
    } else {
      localStorage.setItem('isSetupComplete', 'true');
      if (newUserData.timetable) localStorage.setItem('timetable', JSON.stringify(newUserData.timetable));
      if (newUserData.timetableSettings) localStorage.setItem('timetableSettings', JSON.stringify(newUserData.timetableSettings));
      if (newUserData.settings?.profilePicture) localStorage.setItem('profilePicture', newUserData.settings.profilePicture);
    }
    setIsSetupComplete(true);
    setView(startView || 'daily');
  }

  const handleTimetableImport = (importedData: any) => {
    const dataToSave: Partial<UserData> = {
      timetable: importedData.timetable,
      timetableSettings: importedData.timetableSettings,
      settings: {
        theme: importedData.theme,
        startView: importedData.startView,
        aiLanguage: importedData.aiLanguage,
        betaFeaturesEnabled: importedData.betaFeaturesEnabled === 'true',
        profilePicture: importedData.profilePicture,
      }
    };
    
    if (user && !user.isAnonymous && userDocRef) {
        setDoc(userDocRef, cleanData(dataToSave), { merge: true }).then(() => {
             window.location.reload();
        });
    } else {
        if (importedData.timetable) localStorage.setItem('timetable', JSON.stringify(importedData.timetable));
        if (importedData.timetableSettings) localStorage.setItem('timetableSettings', JSON.stringify(importedData.timetableSettings));
        if (importedData.homeworks) localStorage.setItem('homeworks', JSON.stringify(importedData.homeworks)); 
        if (importedData.theme) setTheme(importedData.theme);
        if (importedData.startView) setThemeStartView(importedData.startView);
        if (importedData.aiLanguage) setAiLanguage(importedData.aiLanguage);
        if (importedData.betaFeaturesEnabled) localStorage.setItem('betaFeaturesEnabled', importedData.betaFeaturesEnabled);
        if (importedData.profilePicture) localStorage.setItem('profilePicture', importedData.profilePicture);

        localStorage.setItem('isSetupComplete', 'true');
        window.location.reload();
    }
  }

  const handleEditTimetable = () => {
    setView('edit');
  }

  const handleNavClick = (newView: string) => {
    if (newView.startsWith('/')) {
        router.push(newView);
    } else {
        setView(newView as any);
    }
  };

  const { currentTimetable, currentTimetableSettings, isTimetableSynced } = useMemo(() => {
    const isSynced = !!(userData?.groupSettings?.syncTimetable && groupData);
    
    if (isSynced && groupData) {
        return {
            currentTimetable: groupData.timetable,
            currentTimetableSettings: groupData.timetableSettings,
            isTimetableSynced: true
        }
    }
    
    const remoteTT = userData?.timetable || {};
    const remoteTTS = userData?.timetableSettings || { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 };
    
    return {
      currentTimetable: (user && !user.isAnonymous) ? remoteTT : (localTimetable || {}),
      currentTimetableSettings: (user && !user.isAnonymous) ? remoteTTS : (localTimetableSettings || { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 }),
      isTimetableSynced: false
    };
  }, [user, userData, localTimetable, localTimetableSettings, groupData]);

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

  const renderView = () => {
    const effectiveTimetable = isPreviewMode ? previewTimetableData : currentTimetable;
    const effectiveSettings = isPreviewMode ? { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 } : currentTimetableSettings;

    switch(view) {
      case 'daily':
        return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={effectiveSettings} onTimetableUpdate={(newTimetable) => updateUserData({ timetable: newTimetable })} />;
      case 'weekly':
        return <ClassicTimetableView setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={effectiveSettings} />;
      case 'homework':
        return <HomeworkPlanner />;
      case 'smart-tool':
        return <SmartToolsView />;
      case 'settings':
        return <SettingsView 
                    onEditTimetable={handleEditTimetable} 
                    isPreview={isPreviewMode} 
                    onTimetableImport={handleTimetableImport} 
                    timetableSettings={effectiveSettings} 
                    onSettingsChange={(newSettings) => updateUserData({ timetableSettings: newSettings })}
                    isTimetableSynced={isTimetableSynced}
                />;
      case 'edit':
        return <SetupView 
                    onSetupComplete={handleSetupComplete} 
                    onTimetableImport={handleTimetableImport} 
                    initialData={{
                        timetable: currentTimetable,
                        timetableSettings: currentTimetableSettings,
                        settings: { profilePicture: (userData?.settings?.profilePicture || localSettings?.profilePicture) }
                    }} 
                    isEditing={true} 
                    viewMode="edit" 
                />;
      default:
        return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={effectiveSettings} onTimetableUpdate={(newTimetable) => updateUserData({ timetable: newTimetable })} />;
    }
  }

  const isHomeView = view === 'daily' || view === 'weekly';
  const effectiveStartView = (user && !user.isAnonymous ? userData?.settings?.startView : startView) || 'daily';

  return (
    <>
      <main className="container mx-auto p-4 md:p-8 relative min-h-screen pb-24">
        {renderView()}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-50">
          <div className="bg-background/80 backdrop-blur-sm rounded-full p-2 flex justify-around items-center shadow-lg border">
            <Button
              variant={isHomeView ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-full h-14 w-14 flex flex-col gap-1"
              onClick={() => handleNavClick(effectiveStartView)}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] whitespace-nowrap">Heute</span>
            </Button>
            <Button
              variant={view === 'homework' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-full h-14 w-14 flex flex-col gap-1"
              onClick={() => handleNavClick('homework')}
            >
              <ListChecks className="w-5 h-5" />
              <span className="text-[10px] whitespace-nowrap">Aufgaben</span>
            </Button>
            <Button
              variant={view === 'smart-tool' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-full h-14 w-14 flex flex-col gap-1"
              onClick={() => handleNavClick('smart-tool')}
            >
              <Sparkles className="w-5 h-5" />
              <span className="text-[10px] whitespace-nowrap">Tools</span>
            </Button>
             <Button
              variant={view === 'settings' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-full h-14 w-14 flex flex-col gap-1"
              onClick={() => handleNavClick('settings')}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] whitespace-nowrap">Einst.</span>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
