
"use client";

import { useState, useEffect } from 'react';
import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import ClassicTimetableView from '@/app/components/classic-timetable-view';
import HomeworkPlanner from '@/app/components/homework-planner';
import { Button } from '@/components/ui/button';
import { Home, ListChecks, Sparkles, Settings } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import SmartToolsView from './components/smart-tools-view';
import SettingsView from './components/settings-view';
import { useTheme } from '@/hooks/use-theme';
import SetupView from './components/setup-view';
import { Loader2 } from 'lucide-react';


const GeminiSparkle = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="inline-block align-baseline ml-1">
        <path d="M12 2.75L13.25 10.75L21.25 12L13.25 13.25L12 21.25L10.75 13.25L2.75 12L10.75 10.75L12 2.75Z" />
    </svg>
);


export default function Page() {
  const [view, setView] = useState('daily');
  const [isInitialised, setIsInitialised] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isEditingTimetable, setIsEditingTimetable] = useState(false);
  const isMobile = useIsMobile();
  const { theme } = useTheme();

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const checkSetup = () => {
            const savedTimetable = localStorage.getItem('timetable');
            const setupDone = !!savedTimetable;
            setIsSetupComplete(setupDone);

            if (setupDone) {
                const savedStartView = localStorage.getItem('startView');
                if (savedStartView) {
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
    }
  }, [isMobile]);

  const handleSetupComplete = () => {
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

  const handleEditTimetable = () => {
      setIsSetupComplete(false);
      setIsEditingTimetable(true);
  }
  
  const handleNavClick = (newView: string) => {
    if (newView === 'home') {
        const savedStartView = localStorage.getItem('startView');
         if (savedStartView) {
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
        <div className="absolute bottom-4 text-xs text-muted-foreground flex items-center">
            Made in Firebase Studio <GeminiSparkle />
        </div>
      </div>
    );
  }

  if (!isSetupComplete) {
      return <SetupView onSetupComplete={handleSetupComplete} isEditing={isEditingTimetable} />;
  }

  return (
    <main className="container mx-auto p-4 md:p-8 relative min-h-screen pb-24">
      {view === 'daily' && <ZeitplanDashboard setView={setView} />}
      {view === 'weekly' && <ClassicTimetableView setView={setView} />}
      {view === 'homework' && <HomeworkPlanner />}
      {view === 'smart-tool' && <SmartToolsView />}
      {view === 'settings' && <SettingsView onEditTimetable={handleEditTimetable}/>}


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
  );
}
