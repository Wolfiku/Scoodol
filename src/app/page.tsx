
"use client";

import { useState, useEffect } from 'react';
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

const APP_VERSION = '1.3.0';

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
}


export default function Page() {
  const [view, setView] = useState('daily');
  const [isInitialised, setIsInitialised] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isEditingTimetable, setIsEditingTimetable] = useState(false);
  const isMobile = useIsMobile();
  const { theme, setTheme, setStartView: setThemeStartView, setAiLanguage } = useTheme();
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [timetableData, setTimetableData] = useState<TimetableData>(initialTimetableData);
  const [timetableSettings, setTimetableSettings] = useState<TimetableSettings>({ schoolStartTime: '08:00', schoolEndTime: '13:00' });
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const checkPreviewMode = sessionStorage.getItem('previewMode') === 'true';
        if (checkPreviewMode) {
          setIsPreviewMode(true);
          sessionStorage.removeItem('previewMode'); // Immediately remove after checking
          setTimetableData(previewTimetableData);
          setTimetableSettings({ schoolStartTime: '08:00', schoolEndTime: '13:00' });
        } else {
            const savedTimetable = localStorage.getItem("timetable");
            if(savedTimetable) {
                setTimetableData(JSON.parse(savedTimetable));
            }
            const savedSettings = localStorage.getItem("timetableSettings");
            if (savedSettings) {
                setTimetableSettings(JSON.parse(savedSettings));
            }
        }
        
        const checkSetup = () => {
            const savedTimetable = localStorage.getItem('timetable');
            const setupDone = !!savedTimetable;
            setIsSetupComplete(setupDone);

            if (setupDone || checkPreviewMode) {
                const savedStartView = localStorage.getItem('startView');
                if (savedStartView && !checkPreviewMode) { 
                    setView(savedStartView);
                } else if (isMobile) {
                    setView('daily');
                } else {
                    setView('weekly');
                }
            }
            
            setTimeout(() => setIsInitialised(true), 500);
        };
        checkSetup();

        // Check for update notification
        const lastSeenVersion = localStorage.getItem('lastSeenVersion');
        const getMajorMinor = (version: string) => version.split('.').slice(0, 2).join('.');
        
        if (!lastSeenVersion || getMajorMinor(lastSeenVersion) !== getMajorMinor(APP_VERSION)) {
            setShowUpdateDialog(true);
        }
    }
  }, [isMobile]);
  
  const updateTimetable = (newTimetable: TimetableData) => {
    setTimetableData(newTimetable);
    if (!isPreviewMode) {
        localStorage.setItem("timetable", JSON.stringify(newTimetable));
    }
  }

  const updateTimetableSettings = (newSettings: TimetableSettings) => {
      setTimetableSettings(newSettings);
      if (!isPreviewMode) {
          localStorage.setItem("timetableSettings", JSON.stringify(newSettings));
      }
  }

  const handleSetupComplete = (newTimetable: TimetableData, newSettings: TimetableSettings, profilePicture?: string) => {
    updateTimetable(newTimetable);
    updateTimetableSettings(newSettings);
    if (profilePicture) {
        localStorage.setItem("profilePicture", profilePicture);
    }
    setIsSetupComplete(true);
    setIsEditingTimetable(false);
    
    const savedStartView = localStorage.getItem('startView');
    if (savedStartView) {
        setView(savedStartView);
    } else if (isMobile) {
      setView('daily');
    } else {
      setView('weekly');
    }
  }
  
  const handleTimetableImport = (importedData: any) => {
    if (importedData.timetable) updateTimetable(importedData.timetable);
    if (importedData.timetableSettings) updateTimetableSettings(importedData.timetableSettings);
    if (importedData.homeworks) localStorage.setItem('homeworks', JSON.stringify(importedData.homeworks));
    if (importedData.theme) setTheme(importedData.theme);
    if (importedData.startView) {
        setThemeStartView(importedData.startView);
        setView(importedData.startView);
    }
    if (importedData.profilePicture) localStorage.setItem('profilePicture', importedData.profilePicture);
    if (importedData.betaFeaturesEnabled) localStorage.setItem('betaFeaturesEnabled', importedData.betaFeaturesEnabled);
    if (importedData.aiLanguage) setAiLanguage(importedData.aiLanguage);


    setIsSetupComplete(true);
    setIsEditingTimetable(false);
    // Reload to apply all settings correctly, especially theme
    window.location.reload();
  }

  const handleEditTimetable = () => {
      setIsSetupComplete(false);
      setIsEditingTimetable(true);
  }
  
  const handleNavClick = (newView: string) => {
    if (newView === 'home') {
        const savedStartView = localStorage.getItem('startView');
         if (savedStartView && !isPreviewMode) {
            setView(savedStartView);
        } else if (isMobile) {
            setView('daily');
        } else {
            setView('weekly');
        }
    } else {
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

  const isHomeView = view === 'daily' || view === 'weekly';


  if (!isInitialised) {
    return (
      <div className="relative flex flex-col justify-center items-center min-h-screen bg-background text-foreground p-4">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">@wolfikuproduction</h1>
          <p className="text-muted-foreground flex items-center justify-center">
            <Loader2 className="mr-2 animate-spin"/> App wird geladen...
          </p>
        </div>
        <div className="absolute bottom-4 left-4 text-xs text-muted-foreground flex items-center">
            Made in Firebase Studio <GeminiSparkle />
        </div>
         <div className="absolute bottom-4 right-4 text-xs text-muted-foreground">
            Version {APP_VERSION}
        </div>
      </div>
    );
  }

  if (!isSetupComplete && !isPreviewMode) {
      return <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} isEditing={isEditingTimetable} />;
  }

  const renderView = () => {
    switch(view) {
      case 'daily':
        return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={timetableData} timetableSettings={timetableSettings} onTimetableUpdate={updateTimetable} />;
      case 'weekly':
        return <ClassicTimetableView setView={setView} isPreview={isPreviewMode} timetable={timetableData} />;
      case 'homework':
        return <HomeworkPlanner />;
      case 'smart-tool':
        return <SmartToolsView />;
      case 'settings':
        return <SettingsView onEditTimetable={handleEditTimetable} isPreview={isPreviewMode} onTimetableImport={handleTimetableImport} />;
      case 'impressum':
        return <ImpressumPage />;
      case 'datenschutz':
        return <DatenschutzPage />;
      default:
        return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={timetableData} timetableSettings={timetableSettings} onTimetableUpdate={updateTimetable} />;
    }
  }
  
  return (
    <>
      <main className="container mx-auto p-4 md:p-8 relative min-h-screen pb-24">
       <Dialog open={showUpdateDialog} onOpenChange={(open) => !open && closeUpdateDialog()}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="text-2xl">Willkommen zu Version 1.3!</DialogTitle>
                <DialogDescription>
                  <div className="pt-2 text-base">
                    Scoodol hat ein großes Update erhalten!
                    <ul className="list-disc pl-5 space-y-2 mt-4">
                        <li><b>Nachmittagsunterricht:</b> Der Stundenplan unterstützt jetzt bis zu 10 Stunden und eine separate Nachmittagsansicht.</li>
                        <li><b>Quality of Life:</b> Viele kleine Verbesserungen an der Benutzeroberfläche, wie eine bessere Darstellung von Doppelstunden.</li>
                    </ul>
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
