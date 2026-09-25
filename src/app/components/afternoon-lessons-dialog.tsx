"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  Pencil,
  Clock,
  Sunset,
  User,
  MapPin,
  CalendarDays,
  Sparkles,
  Info,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ArrowLeft,
  Check,
  Layers,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TimetableData, TimetableEntry } from "./setup-view";

export type CustomAfternoonLesson = {
  id: string;
  fach: string;
  day: "Montag" | "Dienstag" | "Mittwoch" | "Donnerstag" | "Freitag";
  slotIndex?: number; // 6 = 7. Std, 7 = 8. Std, 8 = 9. Std, 9 = 10. Std
  start?: string;     // e.g. "13:30"
  ende?: string;      // e.g. "14:15"
  lehrer?: string;
  room?: string;
  weekType?: "A" | "B" | "ALL";
  notes?: string;
  hauptfach?: boolean;
};

const weekDays: Array<"Montag" | "Dienstag" | "Mittwoch" | "Donnerstag" | "Freitag"> = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
];

const weekDayShort: Record<string, string> = {
  Montag: "Mo",
  Dienstag: "Di",
  Mittwoch: "Mi",
  Donnerstag: "Do",
  Freitag: "Fr",
};

const AFTERNOON_SLOTS = [
  { slotIndex: 6, label: "7. Stunde", defaultStart: "13:30", defaultEnd: "14:15" },
  { slotIndex: 7, label: "8. Stunde", defaultStart: "14:20", defaultEnd: "15:05" },
  { slotIndex: 8, label: "9. Stunde", defaultStart: "15:10", defaultEnd: "15:55" },
  { slotIndex: 9, label: "10. Stunde", defaultStart: "16:00", defaultEnd: "16:45" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customLessons: CustomAfternoonLesson[];
  onSave: (lessons: CustomAfternoonLesson[]) => void;
  isABWeekActive?: boolean;
  timeSlots?: { start: string; ende: string }[];
  baseTimetable?: TimetableData;
};

export default function AfternoonLessonsDialog({
  open,
  onOpenChange,
  customLessons,
  onSave,
  isABWeekActive = false,
  timeSlots = [],
  baseTimetable,
}: Props) {
  const { toast } = useToast();
  const [lessons, setLessons] = useState<CustomAfternoonLesson[]>(customLessons || []);
  const [activeWeekTab, setActiveWeekTab] = useState<"A" | "B">("A");
  const [selectedDay, setSelectedDay] = useState<"Montag" | "Dienstag" | "Mittwoch" | "Donnerstag" | "Freitag">("Montag");

  // Sub-dialog (Add/Edit Form Modal)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formFach, setFormFach] = useState("");
  const [formDay, setFormDay] = useState<"Montag" | "Dienstag" | "Mittwoch" | "Donnerstag" | "Freitag">("Montag");
  const [formSlotIndex, setFormSlotIndex] = useState<number>(6);
  const [formUseCustomTime, setFormUseCustomTime] = useState(false);
  const [formCustomStart, setFormCustomStart] = useState("13:30");
  const [formCustomEnd, setFormCustomEnd] = useState("14:15");
  const [formLehrer, setFormLehrer] = useState("");
  const [formRoom, setFormRoom] = useState("");
  const [formWeekType, setFormWeekType] = useState<"ALL" | "A" | "B">("ALL");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    setLessons(customLessons || []);
  }, [customLessons, open]);

  // Load base timetable if not passed
  const effectiveBaseTimetable = useMemo<TimetableData>(() => {
    if (baseTimetable && Object.keys(baseTimetable).length > 0) return baseTimetable;
    if (typeof window !== "undefined") {
      const syncGroup = localStorage.getItem("syncTimetable") === "true";
      const cached = localStorage.getItem(syncGroup ? "cached_group_timetable" : "timetable");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.weekA) return isABWeekActive && activeWeekTab === "B" ? parsed.weekB : parsed.weekA;
          return parsed;
        } catch (e) {}
      }
    }
    return {};
  }, [baseTimetable, isABWeekActive, activeWeekTab]);

  const handleOpenAdd = (day: "Montag" | "Dienstag" | "Mittwoch" | "Donnerstag" | "Freitag", slotIdx?: number) => {
    setEditingId(null);
    setFormFach("");
    setFormDay(day);
    setFormSlotIndex(slotIdx !== undefined ? slotIdx : 6);
    setFormUseCustomTime(slotIdx === undefined && false);

    const targetSlot = slotIdx !== undefined ? slotIdx : 6;
    if (timeSlots[targetSlot]) {
      setFormCustomStart(timeSlots[targetSlot].start);
      setFormCustomEnd(timeSlots[targetSlot].ende);
    } else {
      const def = AFTERNOON_SLOTS.find((s) => s.slotIndex === targetSlot);
      setFormCustomStart(def ? def.defaultStart : "13:30");
      setFormCustomEnd(def ? def.defaultEnd : "14:15");
    }

    setFormLehrer("");
    setFormRoom("");
    setFormWeekType(isABWeekActive ? (activeWeekTab as any) : "ALL");
    setFormNotes("");
    setIsFormOpen(true);
  };

  const handleOpenAddCustomTime = (day: "Montag" | "Dienstag" | "Mittwoch" | "Donnerstag" | "Freitag") => {
    setEditingId(null);
    setFormFach("");
    setFormDay(day);
    setFormSlotIndex(6);
    setFormUseCustomTime(true);
    setFormCustomStart("16:00");
    setFormCustomEnd("17:00");
    setFormLehrer("");
    setFormRoom("");
    setFormWeekType(isABWeekActive ? (activeWeekTab as any) : "ALL");
    setFormNotes("");
    setIsFormOpen(true);
  };

  const handleOpenEdit = (lesson: CustomAfternoonLesson) => {
    setEditingId(lesson.id);
    setFormFach(lesson.fach);
    setFormDay(lesson.day);
    setFormSlotIndex(lesson.slotIndex !== undefined ? lesson.slotIndex : 6);
    setFormUseCustomTime(lesson.slotIndex === undefined && !!lesson.start && !!lesson.ende);
    setFormCustomStart(lesson.start || "13:30");
    setFormCustomEnd(lesson.ende || "14:15");
    setFormLehrer(lesson.lehrer || "");
    setFormRoom(lesson.room || "");
    setFormWeekType(lesson.weekType || "ALL");
    setFormNotes(lesson.notes || "");
    setIsFormOpen(true);
  };

  const handleSaveForm = () => {
    if (!formFach.trim()) {
      toast({
        variant: "destructive",
        title: "Fachname fehlt",
        description: "Bitte trage den Namen des Nachmittagsfachs ein.",
      });
      return;
    }

    let start = formCustomStart;
    let ende = formCustomEnd;

    if (!formUseCustomTime && timeSlots && timeSlots[formSlotIndex]) {
      start = timeSlots[formSlotIndex].start;
      ende = timeSlots[formSlotIndex].ende;
    } else if (!formUseCustomTime) {
      const def = AFTERNOON_SLOTS.find((s) => s.slotIndex === formSlotIndex);
      if (def) {
        start = def.defaultStart;
        ende = def.defaultEnd;
      }
    }

    const newLesson: CustomAfternoonLesson = {
      id: editingId || `afternoon-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      fach: formFach.trim(),
      day: formDay,
      slotIndex: formUseCustomTime ? undefined : formSlotIndex,
      start,
      ende,
      lehrer: formLehrer.trim() || undefined,
      room: formRoom.trim() || undefined,
      weekType: isABWeekActive ? formWeekType : "ALL",
      notes: formNotes.trim() || undefined,
      hauptfach: false, // Nachmittagsunterricht CANNOT be Hauptfach
    };

    let updatedList: CustomAfternoonLesson[];
    if (editingId) {
      updatedList = lessons.map((l) => (l.id === editingId ? newLesson : l));
    } else {
      updatedList = [...lessons, newLesson];
    }

    setLessons(updatedList);
    onSave(updatedList);
    setIsFormOpen(false);
    toast({
      title: editingId ? "Fach aktualisiert" : "Fach hinzugefügt",
      description: `${newLesson.fach} (${newLesson.day}) wurde gespeichert.`,
    });
  };

  const handleDeleteLesson = (id: string) => {
    const updatedList = lessons.filter((l) => l.id !== id);
    setLessons(updatedList);
    onSave(updatedList);
    toast({
      title: "Fach gelöscht",
      description: "Das Nachmittagsfach wurde entfernt.",
    });
  };

  const isLessonActiveInCurrentWeek = (lesson: CustomAfternoonLesson) => {
    if (!isABWeekActive) return true;
    if (!lesson.weekType || lesson.weekType === "ALL") return true;
    return lesson.weekType === activeWeekTab;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[96vw] p-0 overflow-hidden border-2 rounded-3xl shadow-2xl bg-card">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent border-b border-border/60">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0 shadow-sm">
                  <Sunset className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black flex items-center gap-2">
                    Nachmittagsunterricht
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Vormittagsplan im Überblick (1.–6. Std) & persönliche Nachmittagsfächer (ab 7. Std).
                  </DialogDescription>
                </div>
              </div>

              {/* Week Tab switcher if active */}
              {isABWeekActive && (
                <Tabs
                  value={activeWeekTab}
                  onValueChange={(v: any) => setActiveWeekTab(v)}
                  className="shrink-0"
                >
                  <TabsList className="h-10 rounded-2xl bg-secondary/60 p-1">
                    <TabsTrigger value="A" className="rounded-xl px-3 font-bold text-xs">
                      Woche A
                    </TabsTrigger>
                    <TabsTrigger value="B" className="rounded-xl px-3 font-bold text-xs">
                      Woche B
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
          </DialogHeader>

          {/* Content Area */}
          <div className="p-6 max-h-[72vh] overflow-y-auto space-y-5">
            {/* Day selector tabs for quick day jump */}
            <div className="flex items-center gap-1.5 p-1.5 bg-secondary/50 rounded-2xl border border-border/60 overflow-x-auto">
              {weekDays.map((d) => {
                const count = lessons.filter((l) => l.day === d && isLessonActiveInCurrentWeek(l)).length;
                const isSelected = selectedDay === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    className={cn(
                      "flex-1 min-w-[70px] py-2 px-3 rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5",
                      isSelected
                        ? "bg-background text-foreground shadow-sm border border-border/80"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    )}
                  >
                    <span>{weekDayShort[d]}</span>
                    <span className="hidden sm:inline">{d.slice(2)}</span>
                    {count > 0 && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                        isSelected ? "bg-amber-500 text-white font-black" : "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold"
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Timetable Column for selected day */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* Left Column: Morning Lessons (1.-6. Stunde - Read-only Context) */}
              <Card className="p-4 rounded-3xl border-2 border-border/60 bg-muted/20 space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    🌅 Vormittag (1. – 6. Stunde)
                  </span>
                </div>

                <div className="space-y-1.5">
                  {[0, 1, 2, 3, 4, 5].map((slotIdx) => {
                    const entry = effectiveBaseTimetable[selectedDay]?.[slotIdx];
                    const slot = timeSlots[slotIdx] || { start: `0${slotIdx + 8}:00`, ende: `0${slotIdx + 8}:45` };
                    const hasSubject = entry?.fach && entry.fach.trim() !== "" && entry.fach !== "Pause";

                    return (
                      <div
                        key={slotIdx}
                        className={cn(
                          "p-2.5 rounded-2xl border text-xs flex items-center justify-between gap-2",
                          hasSubject ? "bg-card border-border/60 shadow-sm" : "bg-muted/10 border-dashed border-border/40 opacity-50"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-mono font-black text-muted-foreground w-4">
                            {slotIdx + 1}.
                          </span>
                          <div className="min-w-0">
                            {hasSubject ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-foreground truncate text-xs">
                                  {entry.fach}
                                </span>
                                {entry.hauptfach && (
                                  <Badge variant="default" className="text-[8px] font-black px-1 py-0 h-3.5">
                                    HF
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/60 italic text-[11px]">Freistunde</span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-mono text-muted-foreground block">
                            {slot.start}
                          </span>
                          {entry?.room && (
                            <span className="text-[9px] text-muted-foreground/80 block truncate max-w-[60px]">
                              {entry.room}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Right Column: Afternoon Lessons (ab 7. Stunde - Interactive) */}
              <Card className="p-4 rounded-3xl border-2 border-amber-500/40 bg-amber-500/5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    🌇 Nachmittag (ab 7. Stunde)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenAdd(selectedDay)}
                    className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Fach anlegen
                  </button>
                </div>

                <div className="space-y-2">
                  {AFTERNOON_SLOTS.map((slotDef) => {
                    const matching = lessons.filter(
                      (l) => l.day === selectedDay && l.slotIndex === slotDef.slotIndex && isLessonActiveInCurrentWeek(l)
                    );
                    const slotTime = timeSlots[slotDef.slotIndex] || {
                      start: slotDef.defaultStart,
                      ende: slotDef.defaultEnd,
                    };

                    if (matching.length > 0) {
                      return (
                        <div key={slotDef.slotIndex} className="space-y-1.5">
                          {matching.map((lesson) => (
                            <Card
                              key={lesson.id}
                              className="p-3 rounded-2xl border-2 border-amber-500/50 bg-card hover:shadow-md transition-all space-y-1.5 relative group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-black text-sm text-foreground truncate">
                                      {lesson.fach}
                                    </span>
                                    {isABWeekActive && lesson.weekType && lesson.weekType !== "ALL" && (
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono font-bold bg-secondary/80">
                                        W.{lesson.weekType}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 font-medium">
                                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                                      {slotDef.label} ({slotTime.start} - {slotTime.ende})
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(lesson)}
                                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center transition-all"
                                    title="Bearbeiten"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLesson(lesson.id)}
                                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-all"
                                    title="Löschen"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {(lesson.room || lesson.lehrer || lesson.notes) && (
                                <div className="pt-1 border-t border-border/40 text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                                  {lesson.room && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" /> {lesson.room}
                                    </span>
                                  )}
                                  {lesson.lehrer && (
                                    <span className="flex items-center gap-1">
                                      <User className="w-3 h-3" /> {lesson.lehrer}
                                    </span>
                                  )}
                                  {lesson.notes && (
                                    <span className="italic text-[10px] text-muted-foreground/80 line-clamp-1 w-full">
                                      "{lesson.notes}"
                                    </span>
                                  )}
                                </div>
                              )}
                            </Card>
                          ))}
                        </div>
                      );
                    }

                    // Empty slot
                    return (
                      <button
                        key={slotDef.slotIndex}
                        type="button"
                        onClick={() => handleOpenAdd(selectedDay, slotDef.slotIndex)}
                        className="w-full p-2.5 rounded-2xl border-2 border-dashed border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10 transition-all text-left flex items-center justify-between group bg-card/60"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">
                            {slotDef.label}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground/60">
                            {slotTime.start}
                          </span>
                        </div>
                        <div className="h-6 w-6 rounded-lg bg-secondary/60 group-hover:bg-amber-500 group-hover:text-white transition-all flex items-center justify-center text-muted-foreground text-xs font-bold">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    );
                  })}

                  {/* Off-grid Custom Times */}
                  {lessons
                    .filter((l) => l.day === selectedDay && l.slotIndex === undefined && isLessonActiveInCurrentWeek(l))
                    .map((lesson) => (
                      <Card
                        key={lesson.id}
                        className="p-3 rounded-2xl border-2 border-amber-500/40 bg-card hover:shadow-md transition-all space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-black text-sm text-foreground truncate block">
                              {lesson.fach}
                            </span>
                            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold block">
                              {lesson.start} - {lesson.ende} Uhr (Freie Zeit)
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(lesson)}
                              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </Card>
                    ))}

                  {/* Button for extra off-grid custom time */}
                  <button
                    type="button"
                    onClick={() => handleOpenAddCustomTime(selectedDay)}
                    className="w-full py-2 px-3 rounded-xl border border-dashed border-amber-500/30 text-[11px] font-bold text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>+ Eigene Uhrzeit</span>
                  </button>
                </div>
              </Card>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 bg-muted/20 border-t border-border/60 flex items-center justify-between sm:justify-between">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary shrink-0" />
              Nachmittagsunterricht wird direkt in deinen Stundenplan eingebunden.
            </p>
            <Button
              variant="default"
              onClick={() => onOpenChange(false)}
              className="rounded-2xl font-bold px-6"
            >
              Fertig
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Form Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md w-[95vw] p-0 overflow-hidden border-2 rounded-3xl shadow-2xl bg-card">
          <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
                <Sunset className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black">
                  {editingId ? "Nachmittagsfach bearbeiten" : "Nachmittagsfach anlegen"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Fach für den Nachmittag eintragen (ab der 7. Stunde).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Subject Input - NO suggestions */}
            <div className="space-y-1.5">
              <Label htmlFor="dlg-afternoon-fach" className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Fachname *
              </Label>
              <Input
                id="dlg-afternoon-fach"
                placeholder="z. B. Spanisch, Informatik-AG, Theater, Nachhilfe..."
                value={formFach}
                onChange={(e) => setFormFach(e.target.value)}
                className="rounded-2xl h-12 text-base font-bold px-4"
                autoFocus
              />
            </div>

            {/* Day Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Wochentag
              </Label>
              <div className="grid grid-cols-5 gap-1.5">
                {weekDays.map((d) => {
                  const isSelected = formDay === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setFormDay(d)}
                      className={cn(
                        "py-2.5 px-2 rounded-2xl border text-center transition-all flex flex-col items-center justify-center",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary font-black shadow-md shadow-primary/20 scale-[1.02]"
                          : "bg-secondary/30 text-muted-foreground hover:bg-secondary/70 border-border/60 font-semibold"
                      )}
                    >
                      <span className="text-xs font-black">{weekDayShort[d]}</span>
                      <span className="text-[10px] opacity-75 hidden sm:inline">{d}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slot / Time Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Stunde / Uhrzeit
                </Label>
                <button
                  type="button"
                  onClick={() => setFormUseCustomTime(!formUseCustomTime)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  {formUseCustomTime ? "Zu Schulstunden wechseln" : "Eigene Uhrzeit eintragen"}
                </button>
              </div>

              {!formUseCustomTime ? (
                <div className="grid grid-cols-2 gap-2">
                  {AFTERNOON_SLOTS.map((slot) => {
                    const slotTime = timeSlots && timeSlots[slot.slotIndex]
                      ? `${timeSlots[slot.slotIndex].start} - ${timeSlots[slot.slotIndex].ende}`
                      : `${slot.defaultStart} - ${slot.defaultEnd}`;
                    const isSelected = formSlotIndex === slot.slotIndex;
                    return (
                      <button
                        key={slot.slotIndex}
                        type="button"
                        onClick={() => setFormSlotIndex(slot.slotIndex)}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all flex flex-col justify-between",
                          isSelected
                            ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200 font-bold shadow-sm"
                            : "bg-secondary/30 hover:bg-secondary/60 border-border/60 text-muted-foreground"
                        )}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-xs font-black text-foreground">
                            {slot.label}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 stroke-[3]" />}
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {slotTime}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/60 space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="dlg-custom-start" className="text-[10px] font-bold uppercase text-muted-foreground">
                        Beginn
                      </Label>
                      <Input
                        id="dlg-custom-start"
                        type="time"
                        value={formCustomStart}
                        onChange={(e) => setFormCustomStart(e.target.value)}
                        className="rounded-xl h-11 font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="dlg-custom-end" className="text-[10px] font-bold uppercase text-muted-foreground">
                        Ende
                      </Label>
                      <Input
                        id="dlg-custom-end"
                        type="time"
                        value={formCustomEnd}
                        onChange={(e) => setFormCustomEnd(e.target.value)}
                        className="rounded-xl h-11 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Room & Teacher Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dlg-room" className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Raum (optional)
                </Label>
                <Input
                  id="dlg-room"
                  placeholder="z. B. R204, Aula"
                  value={formRoom}
                  onChange={(e) => setFormRoom(e.target.value)}
                  className="rounded-2xl h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dlg-lehrer" className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Lehrkraft (optional)
                </Label>
                <Input
                  id="dlg-lehrer"
                  placeholder="z. B. Fr. Schmidt"
                  value={formLehrer}
                  onChange={(e) => setFormLehrer(e.target.value)}
                  className="rounded-2xl h-11"
                />
              </div>
            </div>

            {/* A/B Week Toggle if active */}
            {isABWeekActive && (
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Schulwoche
                </Label>
                <Tabs value={formWeekType} onValueChange={(v: any) => setFormWeekType(v)} className="w-full">
                  <TabsList className="grid grid-cols-3 w-full h-11 rounded-2xl bg-secondary/50 p-1">
                    <TabsTrigger value="ALL" className="rounded-xl font-bold text-xs">
                      Beide Wochen
                    </TabsTrigger>
                    <TabsTrigger value="A" className="rounded-xl font-bold text-xs">
                      Nur Woche A
                    </TabsTrigger>
                    <TabsTrigger value="B" className="rounded-xl font-bold text-xs">
                      Nur Woche B
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="dlg-notes" className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Zusatznotiz (optional)
              </Label>
              <Textarea
                id="dlg-notes"
                placeholder="z. B. Sportschuhe mitbringen, findet 14-tägig statt..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="rounded-2xl resize-none h-16 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t border-border/60 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFormOpen(false)}
              className="rounded-2xl font-bold"
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={handleSaveForm}
              className="rounded-2xl font-bold px-6 shadow-md shadow-primary/20"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {editingId ? "Änderungen speichern" : "Fach anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
