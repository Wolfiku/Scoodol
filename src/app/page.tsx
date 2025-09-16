"use client";

import { useState } from 'react';
import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import ClassicTimetableView from '@/app/components/classic-timetable-view';
import HomeworkPlanner from '@/app/components/homework-planner';
import { Button } from '@/components/ui/button';
import { Calendar, LayoutGrid, Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openPrintView, downloadAsPng } from '@/app/lib/export-helpers';

export default function Home() {
  const [view, setView] = useState('daily'); // 'daily', 'weekly'

  return (
    <main className="container mx-auto p-4 md:p-8 relative min-h-screen">
      
      {view === 'daily' && <ZeitplanDashboard />}
      {view === 'weekly' && <ClassicTimetableView />}
      
      <div className="fixed bottom-6 left-6 flex flex-col gap-2">
         <Button onClick={() => setView(view === 'daily' ? 'weekly' : 'daily')} size="lg" className="rounded-full shadow-lg">
          {view === 'daily' ? <Calendar className="mr-2" /> : <LayoutGrid className="mr-2" />}
          {view === 'daily' ? 'Wochenansicht' : 'Tagesansicht'}
        </Button>
      </div>

    </main>
  );
}
