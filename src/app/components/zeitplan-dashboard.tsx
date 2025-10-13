
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Star,
  Clock,
  User,
  BookOpen,
  Link as LinkIcon,
  Sun,
  Moon,
  Save,
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Sunrise,
  Sunset,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

type ProcessedTimetableEntry = TimetableEntry & {
    rowspan: number;
    isContinuation: boolean;
};

type TimetableData = {
  [key: string]: TimetableEntry[];
};

type TimetableSettings = {
    schoolStartTime: string;
    schoolEndTime: string;
}

type Props = {
  setView: (view: string) => void;
  isPreview?: boolean;
  timetable: TimetableData;
  timetableSettings: TimetableSettings;
  onTimetableUpdate: (timetable: TimetableData) => void;
};

const parseTime = (timeStr: string) => {
  if (!timeStr || !timeStr.includes(':')) return new Date();
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const weekDays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
const AFTERNOON_START_HOUR_INDEX = 6; // 7th period is at index 6

export default function ZeitplanDashboard({ setView, isPreview = false, timetable, timetableSettings, onTimetableUpdate }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  const [remainingTime, setRemainingTime] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<TimetableEntry | null>(
    null
  );
  const [editingNotes, setEditingNotes] = useState<string>("");
  const lastMinuteRef = useRef<number | null>(null);

  const [currentDayIndex, setCurrentDayIndex] = useState(new Date().getDay() - 1);
  const [isMounted, setIsMounted] = useState(false);
  const [manualView, setManualView] = useState<'morning' | 'afternoon' | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const today = new Date().getDay();
    const dayIndex = today > 0 && today < 6 ? today - 1 : 0; 
    setCurrentDayIndex(dayIndex);
  }, []);

  const changeDay = (offset: number) => {
    setCurrentDayIndex(prevIndex => {
      const newIndex = prevIndex + offset;
      if (newIndex >= 0 && newIndex < weekDays.length) {
        setManualView(null); // Reset manual view when changing day
        return newIndex;
      }
      return prevIndex;
    });
  };
  
  const { schoolStartTime, schoolEndTime } = timetableSettings;

  const isSchoolTime = useMemo(() => {
    if (!now || !schoolStartTime || !schoolEndTime) return false;
    const currentHour = now.getHours();
    const [startHour] = schoolStartTime.split(':').map(Number);
    const [endHour] = schoolEndTime.split(':').map(Number);
    return currentHour >= startHour && currentHour < endHour;
  }, [now, schoolStartTime, schoolEndTime]);

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!now || !isSchoolTime) {
        setRemainingTime(null);
        return;
    };

    const currentMinute = now.getMinutes();
    if (currentMinute !== lastMinuteRef.current) {
        const morningEndTime = parseTime(schoolEndTime);
        
        const diffMs = morningEndTime.getTime() - now.getTime();
        
        if (diffMs > 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const formattedTime = `${String(diffHours).padStart(2, '0')}:${String(diffMinutes).padStart(2, '0')}`;
            setRemainingTime(formattedTime);
        } else {
            setRemainingTime("00:00");
        }

      lastMinuteRef.current = currentMinute;
    }
  }, [now, isSchoolTime, schoolEndTime]);

  const handleOpenDialog = (entry: TimetableEntry) => {
    setSelectedSubject(entry);
    setEditingNotes(entry.notizen || "");
  };
  
  const handleCloseDialog = () => {
    setSelectedSubject(null);
    setEditingNotes("");
  }

  const handleSaveNotes = () => {
    if (selectedSubject) {
      const day = weekDays[currentDayIndex];
      const updatedTimetable = { ...timetable };
      updatedTimetable[day] = updatedTimetable[day].map((entry) =>
        entry.id === selectedSubject.id
          ? { ...entry, notizen: editingNotes }
          : entry
      );
      onTimetableUpdate(updatedTimetable);
      handleCloseDialog();
    }
  };
  
    const { morningSchedule, afternoonSchedule } = useMemo(() => {
        const daySchedule = timetable[weekDays[currentDayIndex]] || [];
        const processedSchedule: ProcessedTimetableEntry[] = [];
        let i = 0;
        while (i < daySchedule.length) {
            const currentEntry = daySchedule[i];
            if (!currentEntry.fach || currentEntry.fach.trim() === '' || currentEntry.fach === 'Pause') {
                processedSchedule.push({ ...currentEntry, rowspan: 1, isContinuation: false });
                i++;
                continue;
            }

            let rowspan = 1;
            while (
                i + rowspan < daySchedule.length &&
                daySchedule[i + rowspan].fach === currentEntry.fach &&
                daySchedule[i + rowspan].lehrer === currentEntry.lehrer &&
                daySchedule[i + rowspan].room === currentEntry.room
            ) {
                rowspan++;
            }
            
            processedSchedule.push({
                ...currentEntry,
                ende: daySchedule[i + rowspan - 1].ende,
                rowspan,
                isContinuation: false,
            });

            for (let j = 1; j < rowspan; j++) {
                processedSchedule.push({ ...daySchedule[i + j], rowspan: 0, isContinuation: true });
            }
            i += rowspan;
        }

        const filteredSchedule = processedSchedule.filter(entry => !entry.isContinuation && entry.fach && entry.fach.trim() !== "");
        const morning = filteredSchedule.filter((_, index) => {
             const originalIndex = daySchedule.findIndex(d => d.id === filteredSchedule[index].id);
             return originalIndex < AFTERNOON_START_HOUR_INDEX;
        });
        const afternoon = filteredSchedule.filter((_, index) => {
            const originalIndex = daySchedule.findIndex(d => d.id === filteredSchedule[index].id);
            return originalIndex >= AFTERNOON_START_HOUR_INDEX;
        });

        return { morningSchedule: morning, afternoonSchedule: afternoon };
    }, [timetable, currentDayIndex]);

    const activeView = useMemo(() => {
        if (manualView) return manualView;
        if (!now) return 'morning';
        
        const isToday = new Date().getDay() - 1 === currentDayIndex;
        if (!isToday) {
            return 'morning';
        }

        const schoolEnd = parseTime(schoolEndTime);
        const hasAfternoon = afternoonSchedule.length > 0;
        
        if (hasAfternoon && now > schoolEnd) {
            return 'afternoon';
        }
        return 'morning';
    }, [now, schoolEndTime, afternoonSchedule, currentDayIndex, manualView]);
  
  const dailyTimetable = activeView === 'morning' ? morningSchedule : afternoonSchedule;

  const currentSubject = useMemo(() => {
    if (!now || (new Date().getDay() -1) !== currentDayIndex) return null;
    const fullDaySchedule = timetable[weekDays[currentDayIndex]] || [];
    return fullDaySchedule.find((entry) => {
      if (!entry.start || !entry.ende) return false;
      const start = parseTime(entry.start);
      const end = parseTime(entry.ende);
      return now >= start && now < end;
    });
  }, [now, timetable, currentDayIndex]);
  
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 bg-card rounded-xl shadow-md">
        <div className="flex items-center justify-between w-full sm:w-auto">
           <Button variant="ghost" size="icon" onClick={() => changeDay(-1)} disabled={currentDayIndex === 0}>
            <ChevronLeft />
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-4xl font-bold font-headline text-primary">
              {weekDays[currentDayIndex]}
            </h1>
          </div>
           <Button variant="ghost" size="icon" onClick={() => changeDay(1)} disabled={currentDayIndex === weekDays.length - 1}>
            <ChevronRight />
          </Button>
        </div>

        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <div className="text-right flex flex-col items-center sm:items-end p-4 rounded-lg bg-background">
            <div className="flex items-center gap-2 text-3xl font-bold text-foreground">
              <Clock className="w-8 h-8" />
              <span>{now ? now.toLocaleTimeString("de-DE", { hour: '2-digit', minute: '2-digit', second: '2-digit'}) : "..."}</span>
            </div>
            {isSchoolTime ? (
              <div className="flex items-center gap-2 text-accent animate-pulse">
                <Sun className="w-5 h-5" />
                <span className="font-semibold">
                  {remainingTime
                    ? `Schulende in: ${remainingTime}`
                    : "Berechne..."}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Moon className="w-5 h-5" />
                <span className="font-semibold">Außerhalb der Schulzeit</span>
              </div>
            )}
          </div>
          <Button variant="outline" onClick={() => setView('weekly')}>
            <Calendar className="mr-2 h-4 w-4" />
            Wochenansicht
          </Button>
        </div>
      </header>

       <div className="flex items-center gap-2 text-xl font-semibold text-muted-foreground">
            {activeView === 'morning' ? <Sunrise className="text-amber-500" /> : <Sunset className="text-orange-500" />}
            <span>{activeView === 'morning' ? 'Vormittag' : 'Nachmittag'}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dailyTimetable.map((entry) => {
          const isCurrent = currentSubject?.id === entry.id;
          const isBreak = !entry.lehrer && entry.fach.includes("Pause");

          if (isBreak) {
            return (
              <Card
                key={entry.id}
                className={`flex items-center justify-center p-4 rounded-xl bg-secondary ${
                  isCurrent ? "ring-2 ring-accent" : ""
                }`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-5 h-5" /> {entry.fach}
                  </CardTitle>
                  <CardDescription className="text-center">
                    {entry.start} - {entry.ende}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          }

          return (
            <Card
              key={entry.id}
              onClick={() => handleOpenDialog(entry)}
              className={cn(`cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 rounded-xl`,
                isCurrent && "border-accent shadow-accent/20 shadow-lg"
              )}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-2xl font-bold">{entry.fach}</CardTitle>
                  {entry.hauptfach ? (
                    <Badge variant="default">Hauptfach</Badge>
                  ) : (
                    <Badge variant="secondary">Nebenfach</Badge>
                  )}
                </div>
                <CardDescription className="text-base">
                  {entry.start} - {entry.ende}
                   {entry.rowspan > 1 && <span className="text-xs text-primary/80 ml-2">(Doppelstunde)</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-between items-center text-muted-foreground">
                <div className="flex items-center gap-2">
                  {entry.lehrer && <User className="w-4 h-4" />}
                  <span>{entry.lehrer}</span>
                </div>
                 <div className="flex items-center gap-2">
                  {entry.room && <MapPin className="w-4 h-4" />}
                  <span>{entry.room}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {dailyTimetable.length === 0 && (
        <Card className="text-center p-8 text-muted-foreground">
            <p>Für den {activeView === 'morning' ? 'Vormittag' : 'Nachmittag'} ist kein Unterricht eingetragen.</p>
        </Card>
      )}

      {afternoonSchedule.length > 0 && (
         <div className="mt-4 flex justify-center">
            {activeView === 'morning' ? (
                <Button variant="outline" onClick={() => setManualView('afternoon')}>
                    <ArrowDown className="mr-2 h-4 w-4" />
                    Zum Nachmittag wechseln
                </Button>
            ) : (
                 <Button variant="outline" onClick={() => setManualView('morning')}>
                    <ArrowUp className="mr-2 h-4 w-4" />
                    Zum Vormittag wechseln
                </Button>
            )}
         </div>
      )}


      <Dialog
        open={!!selectedSubject}
        onOpenChange={(isOpen) => !isOpen && handleCloseDialog()}
      >
        <DialogContent className="sm:max-w-[425px]">
          {selectedSubject && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center text-3xl font-bold gap-3">
                  {selectedSubject.fach}
                </DialogTitle>
                <DialogDescription className="text-lg">
                  {selectedSubject.start} - {selectedSubject.ende}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 text-sm">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <span className="font-semibold">Lehrer:</span>
                  <span>{selectedSubject.lehrer || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <span className="font-semibold">Raum:</span>
                  <span>{selectedSubject.room || 'N/A'}</span>
                </div>
                 <div className="flex items-center gap-3">
                  {selectedSubject.hauptfach ? (
                    <Badge variant="default">Hauptfach</Badge>
                  ) : (
                    <Badge variant="secondary">Nebenfach</Badge>
                  )}
                </div>
                <div className="grid gap-2">
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-muted-foreground" />
                       <span className="font-semibold">Notizen:</span>
                    </div>
                    <Textarea
                      value={editingNotes}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      className="text-sm"
                      rows={4}
                      placeholder="Hier kannst du Notizen hinzufügen..."
                    />
                    <Button onClick={handleSaveNotes} className="mt-2">
                      <Save className="mr-2 h-4 w-4" />
                      Notizen speichern
                    </Button>
                  </div>
                {selectedSubject.materialien && (
                  <Button asChild variant="outline" className="mt-2">
                    <a href={selectedSubject.materialien} target="_blank" rel="noopener noreferrer">
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Materialien öffnen
                    </a>
                  </Button>
                )}
              </div>
              <DialogFooter>
                 <Button variant="outline" onClick={handleCloseDialog}>Schließen</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
