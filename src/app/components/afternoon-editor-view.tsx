"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import {
  Sunset,
  ArrowLeft,
  CheckCircle2,
  CalendarDays,
  RefreshCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TimetableData, TimetableSettings, generateTimeSlots } from "./setup-view";
import { CustomAfternoonLesson } from "./afternoon-lessons-dialog";

const weekDays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"] as const;
type WeekDay = (typeof weekDays)[number];

const MORNING_SLOT_INDICES = [0, 1, 2, 3, 4, 5]; // 1. - 6. Stunde
const AFTERNOON_SLOT_INDICES = [6, 7, 8, 9];    // 7. - 10. Stunde

type AfternoonSlotState = {
  [day in WeekDay]?: {
    [slotIndex: number]: {
      fach: string;
      lehrer: string;
      room: string;
    };
  };
};

type Props = {
  onBack: () => void;
  onSave: (lessons: CustomAfternoonLesson[]) => void;
  initialLessons?: CustomAfternoonLesson[];
  timetableSettings: TimetableSettings;
  baseTimetable: TimetableData | { weekA: TimetableData; weekB: TimetableData };
};

export default function AfternoonEditorView({
  onBack,
  onSave,
  initialLessons = [],
  timetableSettings,
  baseTimetable,
}: Props) {
  const { toast } = useToast();
  const isABWeekActive = !!timetableSettings.isABWeekActive;
  const [activeWeekTab, setActiveWeekTab] = useState<"A" | "B">("A");

  const timeSlots = useMemo(() => generateTimeSlots(timetableSettings), [timetableSettings]);

  // Transform initial lessons into matrices for Week A and Week B
  const initMatrixForWeek = (targetWeek: "A" | "B" | "ALL"): AfternoonSlotState => {
    const matrix: AfternoonSlotState = {};
    weekDays.forEach((day) => {
      matrix[day] = {};
      AFTERNOON_SLOT_INDICES.forEach((slotIdx) => {
        const match = initialLessons.find(
          (l) =>
            l.day === day &&
            l.slotIndex === slotIdx &&
            (!l.weekType || l.weekType === "ALL" || l.weekType === targetWeek)
        );
        matrix[day]![slotIdx] = {
          fach: match?.fach || "",
          lehrer: match?.lehrer || "",
          room: match?.room || "",
        };
      });
    });
    return matrix;
  };

  const [matrixWeekA, setMatrixWeekA] = useState<AfternoonSlotState>(() => initMatrixForWeek("A"));
  const [matrixWeekB, setMatrixWeekB] = useState<AfternoonSlotState>(() => initMatrixForWeek("B"));

  const activeMatrix = isABWeekActive && activeWeekTab === "B" ? matrixWeekB : matrixWeekA;
  const setActiveMatrix = isABWeekActive && activeWeekTab === "B" ? setMatrixWeekB : setMatrixWeekA;

  // Active morning timetable (1. - 6. Stunde)
  const activeMorningTimetable = useMemo<TimetableData>(() => {
    if (!baseTimetable) return {};
    const raw = baseTimetable as any;
    if (raw.weekA) {
      return (activeWeekTab === "A" ? raw.weekA : raw.weekB) as TimetableData;
    }
    return raw as TimetableData;
  }, [baseTimetable, activeWeekTab]);

  const handleInputChange = (
    day: WeekDay,
    slotIndex: number,
    field: "fach" | "lehrer" | "room",
    value: string
  ) => {
    setActiveMatrix((prev) => {
      const daySlots = prev[day] || {};
      const currentSlot = daySlots[slotIndex] || { fach: "", lehrer: "", room: "" };
      return {
        ...prev,
        [day]: {
          ...daySlots,
          [slotIndex]: {
            ...currentSlot,
            [field]: value,
          },
        },
      };
    });
  };

  // Convert matrices back into CustomAfternoonLesson[]
  const handleSave = () => {
    const result: CustomAfternoonLesson[] = [];

    if (isABWeekActive) {
      // Process Week A & B
      weekDays.forEach((day) => {
        AFTERNOON_SLOT_INDICES.forEach((slotIdx) => {
          const entryA = matrixWeekA[day]?.[slotIdx];
          const entryB = matrixWeekB[day]?.[slotIdx];

          const hasA = !!entryA?.fach?.trim();
          const hasB = !!entryB?.fach?.trim();

          const slot = timeSlots[slotIdx] || { start: "13:30", ende: "14:15" };

          // If identical in both weeks, save as "ALL"
          if (
            hasA &&
            hasB &&
            entryA &&
            entryB &&
            entryA.fach.trim() === entryB.fach.trim() &&
            entryA.lehrer.trim() === entryB.lehrer.trim() &&
            entryA.room.trim() === entryB.room.trim()
          ) {
            result.push({
              id: `afternoon-${day}-${slotIdx}-ALL`,
              fach: entryA.fach.trim(),
              day,
              slotIndex: slotIdx,
              start: slot.start,
              ende: slot.ende,
              lehrer: entryA.lehrer.trim() || undefined,
              room: entryA.room.trim() || undefined,
              weekType: "ALL",
              hauptfach: false,
            });
          } else {
            if (hasA && entryA) {
              result.push({
                id: `afternoon-${day}-${slotIdx}-A`,
                fach: entryA.fach.trim(),
                day,
                slotIndex: slotIdx,
                start: slot.start,
                ende: slot.ende,
                lehrer: entryA.lehrer.trim() || undefined,
                room: entryA.room.trim() || undefined,
                weekType: "A",
                hauptfach: false,
              });
            }
            if (hasB && entryB) {
              result.push({
                id: `afternoon-${day}-${slotIdx}-B`,
                fach: entryB.fach.trim(),
                day,
                slotIndex: slotIdx,
                start: slot.start,
                ende: slot.ende,
                lehrer: entryB.lehrer.trim() || undefined,
                room: entryB.room.trim() || undefined,
                weekType: "B",
                hauptfach: false,
              });
            }
          }
        });
      });
    } else {
      // Single week mode
      weekDays.forEach((day) => {
        AFTERNOON_SLOT_INDICES.forEach((slotIdx) => {
          const entry = matrixWeekA[day]?.[slotIdx];
          if (entry?.fach?.trim()) {
            const slot = timeSlots[slotIdx] || { start: "13:30", ende: "14:15" };
            result.push({
              id: `afternoon-${day}-${slotIdx}`,
              fach: entry.fach.trim(),
              day,
              slotIndex: slotIdx,
              start: slot.start,
              ende: slot.ende,
              lehrer: entry.lehrer.trim() || undefined,
              room: entry.room.trim() || undefined,
              weekType: "ALL",
              hauptfach: false,
            });
          }
        });
      });
    }

    onSave(result);
    toast({
      title: "Plan gespeichert!",
      description: "Deine Nachmittagsfächer wurden erfolgreich übernommen.",
    });
    onBack();
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      {/* Header - Identical to SetupView / Scoodol design */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-black flex items-center gap-2.5">
            <Sunset className="w-7 h-7 text-primary" />
            Nachmittagsunterricht
          </h2>
          <p className="text-sm text-muted-foreground">
            Verwalte deine Fächer und Kurse ab der 7. Stunde.
          </p>
        </div>
      </div>

      <div className="pb-24">
        {/* A/B Week Toggle */}
        {isABWeekActive && (
          <div className="flex justify-center mb-6">
            <Tabs
              value={activeWeekTab}
              onValueChange={(v: any) => setActiveWeekTab(v)}
              className="w-full max-w-xs"
            >
              <TabsList className="grid grid-cols-2 w-full h-12 rounded-2xl p-1 bg-secondary/50">
                <TabsTrigger value="A" className="rounded-xl font-black gap-2">
                  <CalendarDays className="w-4 h-4" /> Woche A
                </TabsTrigger>
                <TabsTrigger value="B" className="rounded-xl font-black gap-2">
                  <RefreshCcw className="w-4 h-4" /> Woche B
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Mobile View (Tabs) */}
        <div className="md:hidden">
          <Tabs defaultValue="Montag" className="w-full">
            <TabsList className="grid grid-cols-5 w-full bg-secondary/50 rounded-xl">
              {weekDays.map((day) => (
                <TabsTrigger
                  key={day}
                  value={day}
                  className="text-xs px-0 rounded-lg"
                >
                  {day.slice(0, 2)}
                </TabsTrigger>
              ))}
            </TabsList>

            {weekDays.map((day) => (
              <TabsContent key={day} value={day} className="space-y-4 pt-4">
                {/* Morning Slots (1.-6. Std) */}
                {MORNING_SLOT_INDICES.map((slotIndex) => {
                  const entry = activeMorningTimetable[day]?.[slotIndex];
                  const slot = timeSlots[slotIndex] || { start: `0${slotIndex + 8}:00`, ende: `0${slotIndex + 8}:45` };
                  const hasSubject = !!entry?.fach && entry.fach.trim() !== "" && entry.fach !== "Pause";

                  return (
                    <Card
                      key={`morning-${day}-${slotIndex}`}
                      className="p-4 shadow-sm border bg-muted/20 opacity-70"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black uppercase text-muted-foreground">
                          {slotIndex + 1}. Stunde
                        </span>
                        <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                          {slot.start} - {slot.ende}
                        </span>
                      </div>
                      <div className="font-bold text-sm text-foreground">
                        {hasSubject ? entry.fach : "Freistunde"}
                      </div>
                      {hasSubject && (entry.lehrer || entry.room) && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {entry.lehrer && <span>{entry.lehrer}</span>}
                          {entry.room && <span>{entry.room}</span>}
                        </div>
                      )}
                    </Card>
                  );
                })}

                {/* Afternoon Slots (7.-10. Std) */}
                {AFTERNOON_SLOT_INDICES.map((slotIndex) => {
                  const slot = timeSlots[slotIndex] || { start: "13:30", ende: "14:15" };
                  const entry = activeMatrix[day]?.[slotIndex] || { fach: "", lehrer: "", room: "" };

                  return (
                    <Card
                      key={`afternoon-${day}-${slotIndex}`}
                      className={cn("p-4 shadow-sm border-2", entry.fach && "border-primary/30")}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-black uppercase text-foreground">
                          {slotIndex + 1}. Stunde
                        </span>
                        <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded font-bold text-primary">
                          {slot.start} - {slot.ende}
                        </span>
                      </div>
                      <div className="grid gap-3">
                        <Input
                          placeholder="Fach"
                          value={entry.fach || ""}
                          onChange={(e) =>
                            handleInputChange(day, slotIndex, "fach", e.target.value)
                          }
                          className="h-11 rounded-xl"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            placeholder="Lehrer"
                            value={entry.lehrer || ""}
                            onChange={(e) =>
                              handleInputChange(day, slotIndex, "lehrer", e.target.value)
                            }
                            className="h-10 rounded-xl"
                          />
                          <Input
                            placeholder="Raum"
                            value={entry.room || ""}
                            onChange={(e) =>
                              handleInputChange(day, slotIndex, "room", e.target.value)
                            }
                            className="h-10 rounded-xl"
                          />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Desktop View (Table) */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="border min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Stunde</TableHead>
                {weekDays.map((day) => (
                  <TableHead key={day}>{day}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 1. bis 6. Stunde (Vormittag) */}
              {MORNING_SLOT_INDICES.map((slotIndex) => {
                const slot = timeSlots[slotIndex] || { start: `0${slotIndex + 8}:00`, ende: `0${slotIndex + 8}:45` };
                return (
                  <TableRow
                    key={`desktop-morning-${slotIndex}`}
                    className="bg-muted/10 opacity-70"
                  >
                    <TableCell className="font-medium bg-muted/20">
                      <div className="flex flex-col">
                        <span className="font-black">{slotIndex + 1}. Stunde</span>
                        <span className="text-[10px] text-muted-foreground">
                          {slot.start} - {slot.ende}
                        </span>
                      </div>
                    </TableCell>
                    {weekDays.map((day) => {
                      const entry = activeMorningTimetable[day]?.[slotIndex];
                      const hasSubject = !!entry?.fach && entry.fach.trim() !== "" && entry.fach !== "Pause";

                      return (
                        <TableCell key={day} className="p-2 align-top">
                          <div className="flex flex-col gap-1 p-2 rounded-lg border bg-muted/20">
                            <span className="text-xs font-bold truncate text-foreground">
                              {hasSubject ? entry.fach : "—"}
                            </span>
                            {hasSubject && (entry.lehrer || entry.room) && (
                              <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                                <span className="truncate">{entry.lehrer || ""}</span>
                                <span className="truncate text-right">{entry.room || ""}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}

              {/* 7. bis 10. Stunde (Nachmittag) */}
              {AFTERNOON_SLOT_INDICES.map((slotIndex) => {
                const slot = timeSlots[slotIndex] || { start: "13:30", ende: "14:15" };
                return (
                  <TableRow key={`desktop-afternoon-${slotIndex}`}>
                    <TableCell className="font-medium bg-muted/20">
                      <div className="flex flex-col">
                        <span className="font-black text-primary">
                          {slotIndex + 1}. Stunde
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {slot.start} - {slot.ende}
                        </span>
                      </div>
                    </TableCell>
                    {weekDays.map((day) => {
                      const entry = activeMatrix[day]?.[slotIndex] || {
                        fach: "",
                        lehrer: "",
                        room: "",
                      };

                      return (
                        <TableCell key={day} className="p-2 align-top">
                          <div
                            className={cn(
                              "flex flex-col gap-2 p-2 rounded-lg border bg-card transition-all",
                              entry.fach && "border-primary/20 shadow-sm"
                            )}
                          >
                            <Input
                              placeholder="Fach"
                              value={entry.fach || ""}
                              onChange={(e) =>
                                handleInputChange(day, slotIndex, "fach", e.target.value)
                              }
                              className="h-8 text-xs font-bold"
                            />
                            <div className="grid grid-cols-2 gap-1">
                              <Input
                                placeholder="Lehrer"
                                value={entry.lehrer || ""}
                                onChange={(e) =>
                                  handleInputChange(day, slotIndex, "lehrer", e.target.value)
                                }
                                className="h-7 text-[10px]"
                              />
                              <Input
                                placeholder="Raum"
                                value={entry.room || ""}
                                onChange={(e) =>
                                  handleInputChange(day, slotIndex, "room", e.target.value)
                                }
                                className="h-7 text-[10px]"
                              />
                            </div>
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Fixed Save Bar - Identical to SetupView */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/70 backdrop-blur-md border-t z-40 shadow-2xl">
        <div className="container mx-auto flex justify-between items-center gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={onBack}
            className="font-bold rounded-2xl h-14 sm:h-12 px-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
          </Button>
          <Button
            size="lg"
            onClick={handleSave}
            className="w-full sm:w-auto font-black text-lg h-14 sm:h-12 rounded-2xl shadow-lg"
          >
            <CheckCircle2 className="mr-2 h-5 w-5" /> Plan speichern
          </Button>
        </div>
      </div>
    </div>
  );
}
