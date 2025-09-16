"use client";

import { useState } from 'react';
import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import ClassicTimetableView from '@/app/components/classic-timetable-view';
import HomeworkPlanner from '@/app/components/homework-planner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Calendar, ListTodo, Download, ChevronLeft, Image as ImageIcon, Printer } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Functions from ClassicTimetableView for PNG/Print export
const openPrintView = () => {
  const printElement = document.getElementById('timetable-for-print');
  if (printElement) {
    const tableHtml = printElement.outerHTML;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Stundenplan Druckansicht</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ccc; padding: 12px; text-align: center; }
              th { background-color: #f2f2f2; }
              .footer { position: fixed; bottom: 10px; right: 10px; font-size: 10px; color: #aaa; }
              .teacher { font-size: 0.8em; margin-top: 4px; color: rgba(255,255,255,0.8); }
            </style>
          </head>
          <body>
            <h2>Wochenübersicht</h2>
            ${tableHtml}
            <div class="footer">@wolfikuproduction scoolmanager</div>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                }
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }
};

const downloadAsPng = () => {
  const html2canvas = require('html2canvas');
  const table = document.getElementById('timetable-for-print');
  if (table) {
    html2canvas(table, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    }).then((canvas: HTMLCanvasElement) => {
      const link = document.createElement('a');
      link.download = 'stundenplan.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }
};


export default function Home() {
  const [view, setView] = useState('daily'); // 'daily', 'weekly', 'homework'
  const isMobile = useIsMobile();

  const renderContent = () => {
    switch (view) {
      case 'weekly':
        return <ClassicTimetableView />;
      case 'homework':
        return <HomeworkPlanner />;
      case 'daily':
      default:
        return <ZeitplanDashboard />;
    }
  };
  
  const renderMobileView = () => (
     <div className="space-y-8">
        <ZeitplanDashboard />
        <HomeworkPlanner />
     </div>
  );


  return (
    <main className="container mx-auto p-4 md:p-8 relative">
      {isMobile ? (
         renderMobileView()
      ) : (
        <>
          {view !== 'daily' && (
             <Button 
                variant="outline"
                className="absolute top-8 left-8 z-10"
                onClick={() => setView('daily')}
             >
                <ChevronLeft className="mr-2" />
                Zur Tagesansicht
            </Button>
          )}
          {renderContent()}

          <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3">
             <Sheet>
                 <SheetTrigger asChild>
                    <Button size="lg" className="shadow-lg">
                       <ListTodo className="mr-2" />
                       Hausaufgaben
                    </Button>
                 </SheetTrigger>
                 <SheetContent side="right" className="w-full sm:max-w-xl p-0">
                     <HomeworkPlanner />
                 </SheetContent>
            </Sheet>
            
            <Button size="lg" onClick={() => setView('weekly')} className="shadow-lg">
                <Calendar className="mr-2" />
                Wochenansicht
            </Button>
             
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="lg" className="shadow-lg">
                    <Download className="mr-2" />
                    Exportieren
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end">
                  <DropdownMenuItem onClick={openPrintView}>
                    <Printer className="mr-2" />
                    Drucken / PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={downloadAsPng}>
                    <ImageIcon className="mr-2" />
                    Als PNG speichern
                  </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}
       {/* The hidden table needs to be available for export, but we can render it conditionally on the client */}
       {!isMobile && <div className="absolute -z-10 opacity-0 pointer-events-none"><ClassicTimetableView /></div>}
    </main>
  );
}
