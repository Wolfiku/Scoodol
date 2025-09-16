"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import timetableData from "@/app/data/timetable.json";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Star,
  Clock,
  User,
  MapPin,
  BookOpen,
  Link as LinkIcon,
  Sun,
  Moon,
} from "lucide-react";

type TimetableEntry = {
  id: number | string;
  fach: string;
  raum?: string;
  lehrer?: string;
  start: string;
  ende: string;
  hauptfach?: boolean;
  notizen?: string;
  materialien?: string;
};

const SCHOOL_START_HOUR = 8;
const SCHOOL_END_HOUR = 13;

const parseTime = (timeStr: string) => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

export default function ZeitplanDashboard() {
  const [now, setNow] = useState(new Date());
  const [remainingTime, setRemainingTime] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<TimetableEntry | null>(
    null
  );
  const lastMinuteRef = useRef<number | null>(null);

  const isSchoolTime = useMemo(() => {
    const currentHour = now.getHours();
    return currentHour >= SCHOOL_START_HOUR && currentHour < SCHOOL_END_HOUR;
  }, [now]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
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
  }, [now, isSchoolTime]);

  const currentSubject = useMemo(() => {
    return timetableData.find((entry) => {
      const start = parseTime(entry.start);
      const end = parseTime(entry.ende);
      return now >= start && now < end;
    });
  }, [now]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col sm:flex-row justify-between items-center gap-4 p-6 bg-card rounded-xl shadow-md">
        <div>
          <h1 className="text-4xl font-bold font-headline text-primary">
            ZeitplanPro
          </h1>
          <p className="text-muted-foreground">Dein digitaler Stundenplan</p>
        </div>
        <div className="text-right flex flex-col items-center sm:items-end p-4 rounded-lg bg-background">
          <div className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <Clock className="w-8 h-8" />
            <span>{now.toLocaleTimeString("de-DE")}</span>
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
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {timetableData.map((entry) => {
          const isCurrent = currentSubject?.id === entry.id;
          const isBreak = !entry.lehrer;

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
              onClick={() => setSelectedSubject(entry as TimetableEntry)}
              className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 rounded-xl ${
                isCurrent ? "border-accent shadow-accent/20 shadow-lg" : ""
              }`}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-2xl font-bold">{entry.fach}</CardTitle>
                  {entry.hauptfach && (
                    <div className="flex items-center text-accent">
                      <Star className="w-6 h-6 fill-current" />
                    </div>
                  )}
                </div>
                <CardDescription className="text-base">
                  {entry.start} - {entry.ende}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-between items-center text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{entry.lehrer}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{entry.raum}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={!!selectedSubject}
        onOpenChange={(isOpen) => !isOpen && setSelectedSubject(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          {selectedSubject && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center text-3xl font-bold gap-3">
                  {selectedSubject.hauptfach && (
                    <Star className="w-7 h-7 text-accent fill-accent" />
                  )}
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
                  <span>{selectedSubject.lehrer}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <span className="font-semibold">Raum:</span>
                  <span>{selectedSubject.raum}</span>
                </div>
                {selectedSubject.notizen && (
                  <div className="flex items-start gap-3">
                    <BookOpen className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="font-semibold">Notizen:</span>
                      <p className="text-muted-foreground">{selectedSubject.notizen}</p>
                    </div>
                  </div>
                )}
                {selectedSubject.materialien && (
                  <Button asChild variant="outline" className="mt-2">
                    <a href={selectedSubject.materialien} target="_blank" rel="noopener noreferrer">
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Materialien öffnen
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
