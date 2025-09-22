
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { getRemainingTime } from "@/app/actions";
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
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type TimetableEntry = {
  id: string;
  fach: string;
  lehrer?: string;
  start: string;
  ende: string;
  hauptfach?: boolean;
  notizen?: string;
  materialien?: string;
};

type TimetableData = {
  [key: string]: TimetableEntry[];
};

type Props = {
  setView: (view: string) => void;
  isPreview?: boolean;
  timetable: TimetableData;
  onTimetableUpdate: (timetable: TimetableData) => void;
};


const SCHOOL_START_HOUR = 8;
const SCHOOL_END_HOUR = 13;

const parseTime = (timeStr: string) => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const weekDays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

export default function ZeitplanDashboard({ setView, isPreview = false, timetable, onTimetableUpdate }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  const [remainingTime, setRemainingTime] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<TimetableEntry | null>(
    null
  );
  const [editingNotes, setEditingNotes] = useState<string>("");
  const lastMinuteRef = useRef<number | null>(null);

  const [currentDayIndex, setCurrentDayIndex] = useState(new Date().getDay() - 1);
  const [isMounted, setIsMounted] = useState(false);

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
        return newIndex;
      }
      return prevIndex;
    });
  };

  const isSchoolTime = useMemo(() => {
    if (!now) return false;
    const currentHour = now.getHours();
    return currentHour >= SCHOOL_START_HOUR && currentHour < SCHOOL_END_HOUR;
  }, [now]);

  useEffect(() => {
    const updateTime = () => setNow(new Date());
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!now || !isMounted) return;
    const currentMinute = now.getMinutes();
    if (isSchoolTime && currentMinute !== lastMinuteRef.current) {
      const fetchRemainingTime = async () => {
        const currentTimeString = now.toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const result = await getRemainingTime(currentTimeString);
        setRemainingTime(result);
      };
      fetchRemainingTime();
      lastMinuteRef.current = currentMinute;
    } else if (!isSchoolTime) {
      setRemainingTime(null);
    }
  }, [now, isSchoolTime, isMounted]);

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
  
  const dailyTimetable = timetable[weekDays[currentDayIndex]] || [];

  const currentSubject = useMemo(() => {
    if (!now || (new Date().getDay() -1) !== currentDayIndex) return null;
    return dailyTimetable.find((entry) => {
      const start = parseTime(entry.start);
      const end = parseTime(entry.ende);
      return now >= start && now < end;
    });
  }, [now, dailyTimetable, currentDayIndex]);
  
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
                    : "Berechne verbleibende Zeit..."}
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
              className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 rounded-xl ${
                isCurrent ? "border-accent shadow-accent/20 shadow-lg" : ""
              }`}
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
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-between items-center text-muted-foreground">
                <div className="flex items-center gap-2">
                  {entry.lehrer && <User className="w-4 h-4" />}
                  <span>{entry.lehrer}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
