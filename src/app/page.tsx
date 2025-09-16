"use client";

import { useState } from 'react';
import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import ClassicTimetableView from '@/app/components/classic-timetable-view';
import HomeworkPlanner from '@/app/components/homework-planner';
import { Button } from '@/components/ui/button';
import { Home, ListChecks, Calendar, Sparkles } from 'lucide-react';
import Calculator from './components/tools/calculator';

export default function Page() {
  const [view, setView] = useState('daily');

  return (
    <main className="container mx-auto p-4 md:p-8 relative min-h-screen pb-24">
      {view === 'daily' && <ZeitplanDashboard setView={setView} />}
      {view === 'weekly' && <ClassicTimetableView setView={setView} />}
      {view === 'homework' && <HomeworkPlanner />}
      {view === 'smart-tool' && <Calculator />}


      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-8">
          <div className="bg-background/80 backdrop-blur-sm rounded-full p-2 flex justify-around items-center shadow-lg border">
            <Button variant={view === 'daily' ? 'secondary' : 'ghost'} size="icon" className="rounded-full h-14 w-14 flex flex-col gap-1" onClick={() => setView('daily')}>
                <Home className="w-5 h-5" />
                <span className="text-xs">Heute</span>
            </Button>
            <Button variant={view === 'homework' ? 'secondary' : 'ghost'} size="icon" className="rounded-full h-14 w-14 flex flex-col gap-1" onClick={() => setView('homework')}>
                <ListChecks className="w-5 h-5" />
                <span className="text-xs">Aufgaben</span>
            </Button>
            <Button variant={view === 'smart-tool' ? 'secondary' : 'ghost'} size="icon" className="rounded-full h-14 w-14 flex flex-col gap-1" onClick={() => setView('smart-tool')}>
                <Sparkles className="w-5 h-5" />
                <span className="text-xs">Smart Tool</span>
            </Button>
        </div>
      </div>
    </main>
  );
}
