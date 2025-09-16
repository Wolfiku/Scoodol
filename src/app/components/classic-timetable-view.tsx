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
import { User, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const handlePrint = () => {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    const tableHtml = document.getElementById('timetable-for-print')?.outerHTML;
    
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
            .subject-cell { color: white; font-weight: bold; }
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
};


export default function ClassicTimetableView() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wochenübersicht</CardTitle>
      </CardHeader>
      <CardContent>
        <Table id="timetable-print-view" className="border">
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
        
        {/* Hidden table for printing */}
        <div style={{ display: 'none' }}>
            <table id="timetable-for-print">
                 <TableHeader>
                    <TableRow>
                        <TableHead>Stunde</TableHead>
                        {days.map((day) => (<TableHead key={day}>{day}</TableHead>))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {timeSlots.map((slot, index) => (
                    <TableRow key={slot}>
                        <TableCell>
                            <div>{index + 1}. Stunde</div>
                            <div style={{fontSize: '0.8em', color: '#666'}}>{slot}</div>
                        </TableCell>
                        {days.map((day) => {
                        const entry = getEntry(day, slot);
                        return (
                            <TableCell 
                                key={`${day}-${slot}`}
                                style={entry ? { backgroundColor: stringToHslColor(entry.fach, 50, 60), color: 'white' } : {}}
                            >
                            {entry ? (
                                <div>
                                    <p style={{fontWeight: 'bold'}}>{entry.fach}</p>
                                    {entry.lehrer && <div className="teacher">{entry.lehrer}</div>}
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
            </table>
        </div>

      </CardContent>
      <CardFooter className="justify-end">
          <Button onClick={handlePrint}>
            <Download className="mr-2" />
            Herunterladen / Drucken
          </Button>
      </CardFooter>
    </Card>
  );
}