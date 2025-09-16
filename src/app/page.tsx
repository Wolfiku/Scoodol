"use client";

import { useState } from 'react';
import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import ClassicTimetableView from '@/app/components/classic-timetable-view';
import HomeworkPlanner from '@/app/components/homework-planner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Image as ImageIcon, Printer } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Functions for PNG/Print export
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

const downloadAsPng = async () => {
  const html2canvas = (await import('html2canvas')).default;
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
  return (
    <main className="container mx-auto p-4 md:p-8">
       <Tabs defaultValue="daily" className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="daily">Tagesansicht</TabsTrigger>
            <TabsTrigger value="weekly">Wochenansicht</TabsTrigger>
            <TabsTrigger value="homework">Hausaufgaben</TabsTrigger>
          </TabsList>

          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-2" />
                  Exportieren
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
        
        <TabsContent value="daily">
          <ZeitplanDashboard />
        </TabsContent>
        <TabsContent value="weekly">
          <ClassicTimetableView />
        </TabsContent>
        <TabsContent value="homework">
            <div className="max-w-4xl mx-auto">
             <HomeworkPlanner />
            </div>
        </TabsContent>
      </Tabs>
      
      {/* The hidden table needs to be available for export, rendered invisibly */}
      <div className="absolute -z-10 opacity-0 pointer-events-none" aria-hidden="true">
        <ClassicTimetableView />
      </div>
    </main>
  );
}
