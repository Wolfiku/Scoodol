"use client";

import { useState, useEffect } from 'react';
import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import ClassicTimetableView from '@/app/components/classic-timetable-view';
import HomeworkPlanner from '@/app/components/homework-planner';
import { Button } from '@/components/ui/button';
import { Home, ListChecks, Sparkles, icons } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import SmartToolsView from './components/smart-tools-view';

const GeminiSparkle = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="inline-block align-baseline ml-1">
        <path d="M12 2.75L13.25 10.75L21.25 12L13.25 13.25L12 21.25L10.75 13.25L2.75 12L10.75 10.75L12 2.75Z" />
    </svg>
);


export default function Page() {
  const [view, setView] = useState('daily');
  const [isInitialised, setIsInitialised] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    // This effect runs once on mount to set the initial view based on device type.
    if (!isMobile) {
      setView('weekly');
    }
    setIsInitialised(true);
  }, [isMobile]);
  

  if (!isInitialised) {
    return (
      <div className="relative flex flex-col justify-center items-center min-h-screen bg-background text-foreground">
        <div className="text-center">
          <p className="text-lg font-semibold">@wolfikuproduction</p>
          <p className="text-sm text-muted-foreground flex items-center justify-center text-center">
            powered by limbo
          </p>
        </div>
        <div className="absolute bottom-4 text-xs text-muted-foreground flex items-center">
            Made in Firebase Studio <GeminiSparkle />
        </div>
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 md:p-8 relative min-h-screen pb-24">
      {view === 'daily' && <ZeitplanDashboard setView={setView} />}
      {view === 'weekly' && <ClassicTimetableView setView={setView} />}
      {view === 'homework' && <HomeworkPlanner />}
      {view === 'smart-tool' && <SmartToolsView />}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-8">
        <div className="bg-background/80 backdrop-blur-sm rounded-full p-2 flex justify-around items-center shadow-lg border">
          <Button
            variant={view === 'daily' || view === 'weekly' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-full h-14 w-14 flex flex-col gap-1"
            onClick={() => setView(isMobile ? 'daily' : 'weekly')}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs">Heute</span>
          </Button>
          <Button
            variant={view === 'homework' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-full h-14 w-14 flex flex-col gap-1"
            onClick={() => setView('homework')}
          >
            <ListChecks className="w-5 h-5" />
            <span className="text-xs">Aufgaben</span>
          </Button>
          <Button
            variant={view === 'smart-tool' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-full h-14 w-14 flex flex-col gap-1"
            onClick={() => setView('smart-tool')}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-xs">Smart Tool</span>
          </Button>
        </div>
      </div>
    </main>
  );
}
