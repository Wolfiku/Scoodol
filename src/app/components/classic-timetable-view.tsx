
"use client";

import { useMemo } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Download, Printer, Image as ImageIcon, ChevronLeft, MapPin, CalendarDays, RefreshCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openPrintView, downloadAsPng } from "@/app/lib/export-helpers";
import { generateTimeSlots } from "./setup-view";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TimetableEntry = {
  id: string;
  fach: string;
  lehrer?: string;
  room?: string;
  start: string;
  ende: string;
  hauptfach?: boolean;
};

type Timetable = {
  [day: string]: TimetableEntry[];
};

type TimetableSettings = {
    schoolStartTime: string;
    schoolEndTime: string;
    firstBreakDuration: number;
    secondBreakDuration: number;
}

type Props = {
  setView: (view: string) => void;
  isPreview?: boolean;
  timetable: Timetable;
  timetableSettings: TimetableSettings;
  currentWeek?: 'A' | 'B' | null;
  onWeekToggle?: (week: 'A' | 'B') => void;
}

const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

const stringToHslColor = (str: string, s: number, l: number) => {
  if (!str) return `hsl(0, 0%, 95%)`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  return `hsl(${h}, ${s}%, ${l}%)`;
};

type ProcessedEntry = TimetableEntry & { rowspan: number; isContinuation: boolean, originalIndex: number };

export default function ClassicTimetableView({ setView, isPreview = false, timetable, timetableSettings, currentWeek, onWeekToggle }: Props) {

  const timeSlots = useMemo(() => generateTimeSlots(timetableSettings), [timetableSettings]);

  const processedTimetable = useMemo(() => {
    if (!timetable || Object.keys(timetable).length === 0) return {};
    return days.reduce((acc, day) => {
      const daySchedule = timetable[day] || [];
      const processedDay: ProcessedEntry[] = [];
      let i = 0;
      while (i < daySchedule.length) {
        const currentEntry = daySchedule[i];
        if (!currentEntry.fach || currentEntry.fach.trim() === '' || currentEntry.fach === 'Pause') {
          processedDay.push({ ...currentEntry, start: timeSlots[i]?.start, ende: timeSlots[i]?.ende, rowspan: 1, isContinuation: false, originalIndex: i });
          i++; continue;
        }
        let rowspan = 1;
        while (i + rowspan < daySchedule.length && daySchedule[i + rowspan].fach === currentEntry.fach && daySchedule[i + rowspan].lehrer === currentEntry.lehrer && daySchedule[i + rowspan].room === currentEntry.room) { rowspan++; }
        processedDay.push({ ...currentEntry, start: timeSlots[i]?.start, ende: timeSlots[i + rowspan - 1]?.ende, rowspan, isContinuation: false, originalIndex: i });
        for (let j = 1; j < rowspan; j++) { processedDay.push({ ...daySchedule[i + j], rowspan: 0, isContinuation: true, originalIndex: i+j }); }
        i += rowspan;
      }
      acc[day] = processedDay;
      return acc;
    }, {} as { [day: string]: ProcessedEntry[] })
  }, [timetable, timeSlots]);
    
  const getEntry = (day: string, slotIndex: number) => {
    const daySchedule = processedTimetable[day];
    if (!daySchedule) return null;
    return daySchedule.find(entry => entry.originalIndex === slotIndex);
  };
  
  const maxSlots = useMemo(() => {
    if (!timetable || Object.keys(timetable).length === 0) return 0;
    let lastUsedSlot = -1;
    days.forEach(day => {
        const daySchedule = timetable[day] || [];
        for (let i = daySchedule.length - 1; i >= 0; i--) {
            if (daySchedule[i].fach && daySchedule[i].fach.trim() !== '' && daySchedule[i].fach !== 'Pause') {
                if (i > lastUsedSlot) lastUsedSlot = i;
                break; 
            }
        }
    });
    return lastUsedSlot + 1;
  }, [timetable]);

  const visibleTimeSlots = useMemo(() => timeSlots.slice(0, Math.max(6, maxSlots)), [timeSlots, maxSlots]);

  return (
    <div className="relative pb-20">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setView('daily')}><ChevronLeft /></Button>
              <CardTitle>Wochenübersicht</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {currentWeek && onWeekToggle && (
                <Tabs value={currentWeek} onValueChange={(v: any) => onWeekToggle(v)} className="h-9">
                    <TabsList className="bg-secondary/50 p-1">
                        <TabsTrigger value="A" className="text-[10px] font-black gap-1 h-7"><CalendarDays className="w-3 h-3"/> A</TabsTrigger>
                        <TabsTrigger value="B" className="text-[10px] font-black gap-1 h-7"><RefreshCcw className="w-3 h-3"/> B</TabsTrigger>
                    </TabsList>
                </Tabs>
            )}
            <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" disabled={isPreview}><Download className="mr-2 h-4 w-4" /> Export</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openPrintView('timetable-for-print')}><Printer className="mr-2 h-4 w-4" /> Drucken / PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadAsPng('timetable-for-print')}><ImageIcon className="mr-2 h-4 w-4" /> Als PNG speichern</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
              <Table id="timetable-print-view" className="border min-w-[700px] md:min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="border-r w-[120px]">Stunde</TableHead>
                    {days.map((day) => <TableHead key={day} className="text-center border-r">{day}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleTimeSlots.map((slot, slotIndex) => {
                    return (
                        <TableRow key={slotIndex}>
                            <TableCell className="font-medium border-r align-top"><div className="flex flex-col"><span>{slotIndex + 1}. Std</span><span className="text-[10px] text-muted-foreground">{slot.start}-{slot.ende}</span></div></TableCell>
                            {days.map((day) => {
                                const entry = getEntry(day, slotIndex);
                                if (!entry || entry.isContinuation) return null;
                                return (
                                <TableCell key={`${day}-${slotIndex}`} className="text-center border-r p-2 align-top" rowSpan={entry.rowspan}>
                                    {entry && entry.fach && entry.fach.trim() !== '' && entry.fach !== 'Pause' ? (
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">{entry.fach}</p>
                                        <div className="text-[10px] text-muted-foreground space-y-0.5">
                                            {entry.lehrer && <div className="flex items-center justify-center gap-1"><User className="w-2.5 h-2.5" /><span>{entry.lehrer}</span></div>}
                                            {entry.room && <div className="flex items-center justify-center gap-1"><MapPin className="w-2.5 h-2.5" /><span>{entry.room}</span></div>}
                                        </div>
                                    </div>
                                    ) : <span className="text-muted-foreground opacity-20">-</span>}
                                </TableCell>
                                );
                            })}
                        </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
          </div>
          
          <div style={{ position: 'absolute', left: '-9999px', top: 'auto', zIndex: -100 }}>
              <table id="timetable-for-print" style={{borderCollapse: 'collapse', fontFamily: 'Arial, sans-serif', width: '1000px', backgroundColor: 'white', tableLayout: 'fixed' }}>
                   <thead><tr><th style={{border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f9f9f9', width: '120px' }}>Stunde</th>{days.map((day) => (<th style={{border: '1px solid #ddd', padding: '12px', textAlign: 'center', backgroundColor: '#f9f9f9' }} key={day}>{day}</th>))}</tr></thead>
                   <tbody>{visibleTimeSlots.map((slot, slotIndex) => (
                            <tr key={slotIndex}>
                                <td style={{border: '1px solid #ddd', padding: '12px', textAlign: 'center', verticalAlign: 'top', height: '80px' }}>
                                    <div style={{fontWeight: 'bold'}}>{slotIndex + 1}. Stunde</div><div style={{fontSize: '0.8em', color: '#666'}}>{slot.start} - {slot.ende}</div>
                                </td>
                                {days.map((day) => {
                                    const entry = getEntry(day, slotIndex);
                                    if (!entry || entry.isContinuation) return null;
                                    const style: React.CSSProperties = entry.fach && entry.fach !== 'Pause' ? { backgroundColor: stringToHslColor(entry.fach, 70, 85), color: stringToHslColor(entry.fach, 70, 25), border: '1px solid #ddd', padding: '8px', textAlign: 'center', verticalAlign: 'middle' } : {border: '1px solid #ddd', padding: '8px', textAlign: 'center', verticalAlign: 'middle'};
                                    return (<td key={`${day}-${slotIndex}`} style={style} rowSpan={entry.rowspan}>{entry.fach && entry.fach !== 'Pause' ? (<div><p style={{fontWeight: 'bold', margin: '0 0 4px 0'}}>{entry.fach}</p>{entry.lehrer && <div style={{fontSize: '0.8em'}}>{entry.lehrer}</div>}</div>) : <span style={{color: '#ccc'}}>-</span>}</td>);
                                })}
                            </tr>
                      ))}</tbody>
              </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
