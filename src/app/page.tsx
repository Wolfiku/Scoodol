
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import ClassicTimetableView from '@/app/components/classic-timetable-view';
import HomeworkPlanner from '@/app/components/homework-planner';
import { Button } from '@/components/ui/button';
import { Home, ListChecks, Sparkles, Settings, Info, Timer } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import SmartToolsView from './components/smart-tools-view';
import SettingsView from './components/settings-view';
import { useTheme } from '@/hooks/use-theme';
import SetupView from './components/setup-view';
import { Loader2 } from 'lucide-react';
import initialTimetableData from "@/app/data/timetable.json";
import previewTimetableData from "@/app/data/preview-timetable.json";
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Link from 'next/link';
import ImpressumPage from './impressum/page';
import DatenschutzPage from './datenschutz/page';
import VokabelPage from './vokabel/page';
import { useAuth, useUser, initiateAnonymousSignIn, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const APP_VERSION = '1.4.2';

const GeminiSparkle = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="inline-block align-baseline ml-1">
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
  const [view, setView] = useState('daily');
  
  const isMobile = useIsMobile();
  const { theme, setTheme, setStartView: setThemeStartView, setAiLanguage, startView } = useTheme();
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(() =>
    user && !user.isAnonymous ? doc(firestore, 'users', user.uid) : null
  , [firestore, user]);

  const { data: userData, isLoading: isUserDataLoading } = useDoc<UserData>(userDocRef);

  const [localTimetable, setLocalTimetable] = useState(initialTimetableData);
  const [localTimetableSettings, setLocalTimetableSettings] = useState({ schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 });
  
  // Effect for initial authentication
  useEffect(() => {
    if (isUserLoading) return; // Wait for user status

    const localSetupDone = !!localStorage.getItem('isSetupComplete');

    if (!user && auth && !localSetupDone) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Effect to handle data loading and view initialization from localStorage for anonymous users
  useEffect(() => {
    if (user && user.isAnonymous) {
        const storedTimetable = localStorage.getItem('timetable');
        if (storedTimetable) setLocalTimetable(JSON.parse(storedTimetable));
        const storedSettings = localStorage.getItem('timetableSettings');
        if (storedSettings) setLocalTimetableSettings(JSON.parse(storedSettings));
    }
  }, [user]);

  const isSetupComplete = useMemo(() => {
    if (!user) return false; // Not ready if no user object
    if (!user.isAnonymous) {
      return !!userData; // For registered users, setup is complete if they have userData.
    }
    // For anonymous users, check localStorage.
    return !!localStorage.getItem('isSetupComplete');
  }, [user, userData]);

  
  const timetableData = isSetupComplete ? (userData?.timetable || localTimetable) : localTimetable;
  const timetableSettings = isSetupComplete ? (userData?.timetableSettings || localTimetableSettings) : localTimetableSettings;

  
  const updateUserData = (data: Partial<UserData>) => {
    if (user && !user.isAnonymous && userDocRef) {
      setDocumentNonBlocking(userDocRef, data, { merge: true });
    } else {
        if(data.timetable) localStorage.setItem('timetable', JSON.stringify(data.timetable));
        if(data.timetableSettings) localStorage.setItem('timetableSettings', JSON.stringify(data.timetableSettings));
    }
  }

  const handleSetupComplete = (newUserData: Partial<UserData>) => {
      if (user && !user.isAnonymous && userDocRef) {
          const dataToSet: UserData = {
            timetable: newUserData.timetable || initialTimetableData,
            timetableSettings: newUserData.timetableSettings || { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 },
            settings: {
              ...(userData?.settings || {}),
              ...(newUserData.settings || {}),
            },
          };
          setDocumentNonBlocking(userDocRef, dataToSet, { merge: false }); // Overwrite completely on initial setup
    } else {
      // For anonymous users, save to localStorage
      localStorage.setItem('isSetupComplete', 'true');
      if (newUserData.timetable) {
        localStorage.setItem('timetable', JSON.stringify(newUserData.timetable));
        setLocalTimetable(newUserData.timetable as TimetableData);
      }
      if (newUserData.timetableSettings) {
        localStorage.setItem('timetableSettings', JSON.stringify(newUserData.timetableSettings));
        setLocalTimetableSettings(newUserData.timetableSettings as TimetableSettings);
      }
      if (newUserData.settings?.profilePicture) {
        localStorage.setItem('profilePicture', newUserData.settings.profilePicture);
      }
    }
    
    setView(startView || 'daily');
  }
  
  const handleTimetableImport = (importedData: any) => {
    if (!user || user.isAnonymous) {
       if (importedData.timetable) localStorage.setItem('timetable', JSON.stringify(importedData.timetable));
        if (importedData.timetableSettings) localStorage.setItem('timetableSettings', JSON.stringify(importedData.timetableSettings));
        if (importedData.homeworks) localStorage.setItem('homeworks', JSON.stringify(importedData.homeworks));
        if (importedData.theme) setTheme(importedData.theme);
        if (importedData.startView) {
            setThemeStartView(importedData.startView);
            setView(importedData.startView);
        }
        if (importedData.settings?.profilePicture) localStorage.setItem('profilePicture', importedData.settings.profilePicture);
        if (importedData.betaFeaturesEnabled) localStorage.setItem('betaFeaturesEnabled', importedData.betaFeaturesEnabled);
        if (importedData.aiLanguage) setAiLanguage(importedData.aiLanguage as 'German' | 'English');
        
        window.location.reload();
        return;
    }
    
    const newUserData: Partial<UserData> = {};
    if (importedData.timetable) newUserData.timetable = importedData.timetable;
    if (importedData.timetableSettings) newUserData.timetableSettings = importedData.timetableSettings;
    
    const newSettings: UserSettings = {};
    if (importedData.theme) newSettings.theme = importedData.theme;
    if (importedData.startView) newSettings.startView = importedData.startView;
    if (importedData.aiLanguage) newSettings.aiLanguage = importedData.aiLanguage;
    if (importedData.betaFeaturesEnabled) newSettings.betaFeaturesEnabled = importedData.betaFeaturesEnabled;
    if (importedData.settings?.profilePicture) newSettings.profilePicture = importedData.settings.profilePicture;
    newUserData.settings = newSettings;
    
    updateUserData(newUserData);

    if (importedData.homeworks && user) {
        // This part is more complex, would need to clear and add new homeworks.
        // For now, we focus on timetable and settings.
    }
    toast({ title: "Import erfolgreich!", description: "Deine Daten werden synchronisiert." });
    setTimeout(() => window.location.reload(), 1500);
  }

  const handleEditTimetable = () => {
    window.history.pushState({}, '', '/edit/1');
    setView('edit');
  }
  
  const handleNavClick = (newView: string) => {
    if (newView === 'home') {
        window.history.pushState({}, '', '/');
        setView(startView || (isMobile ? 'daily' : 'weekly'));
    } else {
      if (newView === 'creator' || newView === 'edit') {
         window.history.pushState({}, '', `/${newView}/1`);
      } else {
        window.history.pushState({}, '', '/');
      }
      setView(newView);
    }
  };

  const closeUpdateDialog = (navigateTo?: string) => {
      setShowUpdateDialog(false);
      localStorage.setItem('lastSeenVersion', APP_VERSION);
      if (navigateTo) {
          setView(navigateTo);
      }
  }
  
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  if (path === '/login' || path === '/register' || path === '/success') {
      return null;
  }
  
  // Set initial view based on path or startView setting
  useEffect(() => {
    const path = window.location.pathname;
    const isCreatorMode = path.startsWith('/creator/');
    const isEditMode = path.startsWith('/edit/');
    
    if (isCreatorMode) {
        setView('creator');
    } else if (isEditMode) {
        setView('edit');
    } else if (isSetupComplete) {
        setView(startView || 'daily');
    } else {
        setView('setup');
    }
  }, [isSetupComplete, startView]);


  const isHomeView = view === 'daily' || view === 'weekly';
  const isLoading = isUserLoading || (user && !user.isAnonymous && isUserDataLoading);

  // 1. Loading State: Show a full-screen loader while waiting for user or data.
  if (isLoading) {
     return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-background text-foreground p-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary"/>
        <p className="text-muted-foreground mt-4">Daten werden geladen...</p>
      </div>
    );
  }
  
  // 2. Setup State: If not loading and setup is not complete, show the setup view.
  if (!isSetupComplete && !isPreviewMode) {
      return <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} />;
  }

  const renderView = () => {
    switch(view) {
      case 'daily':
        return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={timetableData} timetableSettings={timetableSettings} onTimetableUpdate={(newTimetable) => updateUserData({ timetable: newTimetable })} />;
      case 'weekly':
        return <ClassicTimetableView setView={setView} isPreview={isPreviewMode} timetable={timetableData} timetableSettings={timetableSettings} />;
      case 'homework':
        return <HomeworkPlanner />;
      case 'smart-tool':
        return <SmartToolsView />;
      case 'settings':
        return <SettingsView onEditTimetable={handleEditTimetable} isPreview={isPreviewMode} onTimetableImport={handleTimetableImport} timetableSettings={timetableSettings} onSettingsChange={(newSettings) => updateUserData({ timetableSettings: newSettings })} />;
      case 'impressum':
        return <ImpressumPage />;
      case 'datenschutz':
        return <DatenschutzPage />;
      case 'vokabel':
          return <VokabelPage />
      case 'setup':
        return <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} />;
      case 'creator':
      case 'edit':
          return <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} initialData={{timetable, timetableSettings, settings: {}}} isEditing={true} viewMode={view} />;
      default:
        return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={timetableData} timetableSettings={timetableSettings} onTimetableUpdate={(newTimetable) => updateUserData({ timetable: newTimetable })} />;
    }
  }
  
  // 3. Main App State: If loaded and setup is complete, show the main app.
  return (
    <>
      <main className="container mx-auto p-4 md:p-8 relative min-h-screen pb-24">
       <Dialog open={showUpdateDialog} onOpenChange={(open) => !open && closeUpdateDialog()}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="text-2xl">Willkommen zu Version 1.4!</DialogTitle>
                <DialogDescription>
                  <div className="pt-2 text-base text-muted-foreground">
                    Scoodol hat ein Update erhalten! Wir haben im Hintergrund viele kleine Fehler behoben, um die App stabiler und schneller zu machen.
                  </div>
                </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-2 mt-4">
                <Button onClick={() => closeUpdateDialog('daily')} size="lg">
                    Super!
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {renderView()}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-8 z-50">
        <div className="bg-background/80 backdrop-blur-sm rounded-full p-2 flex justify-around items-center shadow-lg border">
          <Button
            variant={isHomeView ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-full h-14 w-14 flex flex-col gap-1"
            onClick={() => handleNavClick('home')}
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
            <span className="text-[10px] whitespace-nowrap">Smart Tools</span>
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
