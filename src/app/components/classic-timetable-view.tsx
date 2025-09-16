"use client";

import timetableData from "@/app/data/timetable.json";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Download, Printer, ChevronDown, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import html2canvas from "html2canvas";

type TimetableEntry = {
  id: string;
  fach: string;
  lehrer?: string;
  start: string;
  ende: string;
  hauptfach?: boolean;
};

type Timetable = {
  [day: string]: TimetableEntry[];
};

const timetable: Timetable = timetableData;
const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
const timeSlots = [
  "08:00 - 08:45",
  "08:45 - 09:30",
  "09:45 - 10:30",
  "10:30 - 11:15",
  "11:30 - 12:15",
  "12:15 - 13:00",
];

const getEntry = (day: string, timeSlot: string) => {
  const daySchedule = timetable[day];
  if (!daySchedule) return null;

  const [start] = timeSlot.split(" - ");
  return daySchedule.find(
    (entry) => entry.start === start && entry.fach !== "Pause"
  );
};

// Function to generate a color from a string
const stringToHslColor = (str: string, s: number, l: number) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  return `hsl(${h}, ${s}%, ${l}%)`;
};

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
  const table = document.getElementById('timetable-for-print');
  if (table) {
    html2canvas(table, {
      scale: 2, // higher scale for better quality
      useCORS: true,
      backgroundColor: '#ffffff',
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = 'stundenplan.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }
};

export default function ClassicTimetableView() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wochenübersicht</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
            <Table id="timetable-print-view" className="border min-w-[700px] md:min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="border-r">Stunde</TableHead>
                  {days.map((day) => (
                    <TableHead key={day} className="text-center border-r">
                      {day}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeSlots.map((slot, index) => (
                  <TableRow key={slot}>
                    <TableCell className="font-medium border-r">
                      <div className="flex flex-col">
                        <span>{index + 1}. Stunde</span>
                        <span className="text-xs text-muted-foreground">{slot}</span>
                      </div>
                    </TableCell>
                    {days.map((day) => {
                      const entry = getEntry(day, slot);
                      return (
                        <TableCell key={`${day}-${slot}`} className="text-center border-r">
                          {entry ? (
                            <div>
                              <p className="font-bold">{entry.fach}</p>
                              {entry.lehrer && (
                                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                                  <User className="w-3 h-3" />
                                  <span>{entry.lehrer}</span>
                                </div>
                              )}
                              {entry.hauptfach && (
                                 <Badge variant="default" className="mt-1">Hauptfach</Badge>
                              )}
                            </div>
                          ) : (
                            <span>-</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </div>
        
        {/* Hidden table for printing and PNG export */}
        <div style={{ position: 'absolute', left: '-9999px', top: 'auto' }}>
            <table id="timetable-for-print" style={{borderCollapse: 'collapse', fontFamily: 'Arial, sans-serif'}}>
                 <thead>
                    <tr>
                        <th style={{border: '1px solid #ccc', padding: '12px', textAlign: 'center', backgroundColor: '#f2f2f2' }}>Stunde</th>
                        {days.map((day) => (<th style={{border: '1px solid #ccc', padding: '12px', textAlign: 'center', backgroundColor: '#f2f2f2' }} key={day}>{day}</th>))}
                    </tr>
                </thead>
                <tbody>
                    {timeSlots.map((slot, index) => (
                    <tr key={slot}>
                        <td style={{border: '1px solid #ccc', padding: '12px', textAlign: 'center'}}>
                            <div>{index + 1}. Stunde</div>
                            <div style={{fontSize: '0.8em', color: '#666'}}>{slot}</div>
                        </td>
                        {days.map((day) => {
                        const entry = getEntry(day, slot);
                        return (
                            <td 
                                key={`${day}-${slot}`}
                                style={entry ? { backgroundColor: stringToHslColor(entry.fach, 50, 60), color: 'white', border: '1px solid #ccc', padding: '12px', textAlign: 'center' } : {border: '1px solid #ccc', padding: '12px', textAlign: 'center'}}
                            >
                            {entry ? (
                                <div>
                                    <p style={{fontWeight: 'bold', margin: '0'}}>{entry.fach}</p>
                                    {entry.lehrer && <div className="teacher" style={{fontSize: '0.8em', marginTop: '4px', color: 'rgba(255,255,255,0.8)'}}>{entry.lehrer}</div>}
                                </div>
                            ) : (
                                <span>-</span>
                            )}
                            </td>
                        );
                        })}
                    </tr>
                    ))}
                     <tr>
                        <td colSpan={days.length + 1} style={{textAlign: 'right', fontSize: '10px', color: '#aaa', padding: '8px'}}>
                            @wolfikuproduction scoolmanager
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

      </CardContent>
      <CardFooter className="justify-end flex-wrap gap-2">
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Download className="mr-2" />
                Exportieren
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
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
      </CardFooter>
    </Card>
  );
}
