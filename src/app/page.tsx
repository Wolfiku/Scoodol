
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import ClassicTimetableView from '@/app/components/classic-timetable-view';
import HomeworkPlanner from '@/app/components/homework-planner';
import { Button } from '@/components/ui/button';
import { Home, ListChecks, Sparkles, Settings, Info, Timer, Loader2, LayoutGrid } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import SmartToolsView from './components/smart-tools-view';
import SettingsView from './components/settings-view';
import { useTheme } from '@/hooks/use-theme';
import SetupView from './components/setup-view';
import initialTimetableData from "@/app/data/timetable.json";
import previewTimetableData from "@/app/data/preview-timetable.json";
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Link from 'next/link';
import { useAuth, useUser, initiateAnonymousSignIn, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

const APP_VERSION = '1.4.2';

const GeminiSparkle = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24" fill="currentColor" className="inline-block align-baseline ml-1">
        <path d="M12 2.75L13.25 10.75L21.25 12L13.25 13.25L12 21.25L10.75 13.25L2.75 12L10.75 10.75L12 2.75Z" />
    </svg>
);

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
}

export default function Page() {
  // All hooks are now at the top level
  const router = useRouter();
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();

  const [view, setView] = useState('daily');
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [localTimetable, setLocalTimetable] = useState(initialTimetableData);
  const [localTimetableSettings, setLocalTimetableSettings] = useState({ schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 });
  const [localSettings, setLocalSettings] = useState<UserSettings>({});
  
  const { setTheme, setStartView: setThemeStartView, setAiLanguage, startView } = useTheme();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => 
    user && !user.isAnonymous ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);

  const { data: userData, isLoading: isUserDataLoading } = useDoc<UserData>(userDocRef);
  
  const isPreviewMode = useMemo(() => pathname.startsWith('/creator/'), [pathname]);


  // Effect for initial loading and setup check
  useEffect(() => {
    const checkSetup = async () => {
      // Don't do anything until Firebase auth state is resolved
      if (isUserLoading) return;

      if (user) {
        if (user.isAnonymous) {
          // Anonymous user: check local storage
          const localSetupDone = !!localStorage.getItem('isSetupComplete');
          setIsSetupComplete(localSetupDone);
          setIsLoading(false);
        } else {
          // Registered user: wait for their data from Firestore
          if (isUserDataLoading) return; // Still waiting for Firestore doc
          
          // Firestore data has loaded (or not)
          setIsSetupComplete(!!userData);
          setIsLoading(false);
        }
      } else {
        // No user at all, initiate anonymous sign-in
        await initiateAnonymousSignIn(auth);
        // The onAuthStateChanged listener will trigger a re-run of this effect
      }
    };

    checkSetup();
  }, [user, isUserLoading, userData, isUserDataLoading, auth]);

  // Set initial view based on path or startView setting
  useEffect(() => {
    if (isLoading) return; // Don't set view until loading is finished
    
    const path = window.location.pathname;
    const isCreatorMode = path.startsWith('/creator/');
    const isEditMode = path.startsWith('/edit/');

    if (isEditMode) {
      setView('edit');
    } else if (isCreatorMode) {
      // Preview mode handled by isPreviewMode memo
    } else if (isSetupComplete) {
      const effectiveStartView = (user && !user.isAnonymous ? userData?.settings?.startView : startView) || 'daily';
      setView(effectiveStartView);
    }
  }, [isLoading, isSetupComplete, user, userData, startView, pathname]);


  const updateUserData = (data: Partial<UserData>) => {
    if (user && !user.isAnonymous && userDocRef) {
        setDoc(userDocRef, data, { merge: true });
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

  const handleSetupComplete = (newUserData: Partial<UserData>) => {
    if (user && !user.isAnonymous && userDocRef) {
      setDoc(userDocRef, newUserData, { merge: true });
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
        setDoc(userDocRef, dataToSave, { merge: true }).then(() => {
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

        if (!localStorage.getItem('isSetupComplete')) {
            localStorage.setItem('isSetupComplete', 'true');
        }
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
        setView(newView);
    }
  };

  const getInitialDataForSetup = () => {
      if (user && !user.isAnonymous && userData) {
          return { timetable: userData.timetable, timetableSettings: userData.timetableSettings, settings: userData.settings };
      }
      return { timetable: localTimetable, timetableSettings: localTimetableSettings, settings: localSettings };
  }
  
  const currentTimetable = useMemo(() => {
    if (user && !user.isAnonymous) return userData?.timetable || {};
    return localTimetable;
  }, [user, userData, localTimetable]);

  const currentTimetableSettings = useMemo(() => {
    if (user && !user.isAnonymous) return userData?.timetableSettings || { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 };
    return localTimetableSettings;
  }, [user, userData, localTimetableSettings]);


  // --- Render Logic ---
  
  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-background text-foreground p-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary"/>
        <p className="text-muted-foreground mt-4">Lade Scoodol...</p>
      </div>
    );
  }

  if (!isSetupComplete) {
    return <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} />;
  }

  const renderView = () => {
    const effectiveTimetable = isPreviewMode ? previewTimetableData : currentTimetable;

    switch(view) {
      case 'daily':
        return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={currentTimetableSettings} onTimetableUpdate={(newTimetable) => updateUserData({ timetable: newTimetable })} />;
      case 'weekly':
        return <ClassicTimetableView setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={currentTimetableSettings} />;
      case 'homework':
        return <HomeworkPlanner />;
      case 'smart-tool':
        return <SmartToolsView />;
      case 'settings':
        return <SettingsView onEditTimetable={handleEditTimetable} isPreview={isPreviewMode} onTimetableImport={handleTimetableImport} timetableSettings={currentTimetableSettings} onSettingsChange={(newSettings) => updateUserData({ timetableSettings: newSettings })} />;
      case 'edit':
        return <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} initialData={getInitialDataForSetup()} isEditing={true} viewMode="edit" />;
      default:
        return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={effectiveTimetable} timetableSettings={currentTimetableSettings} onTimetableUpdate={(newTimetable) => updateUserData({ timetable: newTimetable })} />;
    }
  }

  const isHomeView = view === 'daily' || view === 'weekly';
  const effectiveStartView = (user && !user.isAnonymous ? userData?.settings?.startView : startView) || 'daily';

  return (
    <>
      <main className="container mx-auto p-4 md:p-8 relative min-h-screen pb-24">
        {renderView()}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-8 z-50">
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
