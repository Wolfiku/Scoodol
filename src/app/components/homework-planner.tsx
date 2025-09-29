
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  Camera,
  Loader2,
  PlayCircle,
  X,
  Pencil,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { scanHomeworkImage } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import FocusMode, { type FocusTask } from "./tools/focus-mode";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useTheme } from "@/hooks/use-theme";


type Homework = {
  id: number;
  subject: string;
  task: string;
  dueDate: string;
  done: boolean;
  completedAt?: number;
};

export default function HomeworkPlanner() {
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);

  const [newSubject, setNewSubject] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  
  const [isScanning, setIsScanning] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showScanInfo, setShowScanInfo] = useState(false);
  const { toast } = useToast();
  const { aiLanguage } = useTheme();
  
  useEffect(() => {
    setIsMounted(true);
    const savedHomeworks = localStorage.getItem("homeworks");
    if (savedHomeworks) {
        const loadedHomeworks: Homework[] = JSON.parse(savedHomeworks);
        const now = Date.now();
        const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

        const filteredHomeworks = loadedHomeworks.filter(hw => {
            // Keep the task if it's not done, or if it was done within the last 24 hours.
            return !hw.done || (hw.completedAt && hw.completedAt > twentyFourHoursAgo);
        });
        setHomeworks(filteredHomeworks);
    }
  }, []);
  
  const upcomingHomeworks = homeworks.filter(hw => !hw.done);
  const doneHomeworks = homeworks.filter(hw => hw.done);

  useEffect(() => {
    if(isMounted) {
      localStorage.setItem("homeworks", JSON.stringify(homeworks));
    }
  }, [homeworks, isMounted]);

  const resetDialogForm = () => {
      setNewSubject("");
      setNewTask("");
      setNewDueDate("");
      setEditingHomework(null);
  }

  const handleOpenDialog = (hw: Homework | null = null) => {
      if (hw) {
          setEditingHomework(hw);
          setNewSubject(hw.subject);
          setNewTask(hw.task);
          setNewDueDate(hw.dueDate);
      } else {
          resetDialogForm();
      }
      setIsDialogOpen(true);
  }

  const handleCloseDialog = () => {
      resetDialogForm();
      setIsDialogOpen(false);
  }

  const handleSaveHomework = () => {
    if (!newTask.trim()) return;

    if (editingHomework) {
        // Update existing homework
        setHomeworks(homeworks.map(hw => 
            hw.id === editingHomework.id 
            ? { ...hw, subject: newSubject, task: newTask, dueDate: newDueDate }
            : hw
        ));
        toast({ title: 'Aufgabe aktualisiert!' });
    } else {
        // Add new homework
        const newHomework: Homework = {
            id: Date.now(),
            subject: newSubject,
            task: newTask,
            dueDate: newDueDate,
            done: false,
        };
        setHomeworks(prev => [...prev, newHomework]);
        toast({ title: 'Neue Aufgabe hinzugefügt!' });
    }
    
    handleCloseDialog();
  };
  
  const addMultipleHomeworks = (tasks: {subject: string, task: string, dueDate?: string}[]) => {
      const newHomeworks: Homework[] = tasks.map(t => ({
          id: Date.now() + Math.random(),
          subject: t.subject,
          task: t.task,
          dueDate: t.dueDate || "",
          done: false,
      }));
      setHomeworks(prev => [...prev, ...newHomeworks]);
  }

  const toggleDone = (id: number) => {
    setHomeworks(
      homeworks.map((hw) => {
        if (hw.id === id) {
          const isDone = !hw.done;
          return { ...hw, done: isDone, completedAt: isDone ? Date.now() : undefined };
        }
        return hw;
      })
    );
  };

  const deleteHomework = (id: number) => {
    setHomeworks(homeworks.filter((hw) => hw.id !== id));
  };
  
  const handleCameraClick = () => {
      setShowScanInfo(true);
  }
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        toast({
            variant: 'destructive',
            title: 'Offline',
            description: 'Diese Funktion benötigt eine Internetverbindung.',
        });
        return;
    }

    setIsScanning(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const dataUri = reader.result as string;
        const result = await scanHomeworkImage(dataUri, aiLanguage);
        
        if (result.error || !result.tasks || result.tasks.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Fehler beim Scannen',
                description: result.error || 'Die KI konnte keine Aufgaben im Bild finden.',
            });
        } else {
            addMultipleHomeworks(result.tasks);
            toast({
                title: 'Aufgaben gescannt!',
                description: `${result.tasks.length} neue Aufgabe(n) wurde(n) hinzugefügt.`,
            });
        }
        setIsScanning(false);
    };
    reader.onerror = () => {
        toast({
            variant: 'destructive',
            title: 'Fehler',
            description: 'Die Bilddatei konnte nicht gelesen werden.',
        });
        setIsScanning(false);
    }
  }

  const handleStartFocusMode = () => {
    if (upcomingHomeworks.length > 0) {
        setIsFocusMode(true);
    } else {
        toast({
            variant: 'destructive',
            title: 'Keine Aufgaben ausgewählt',
            description: 'Es gibt keine anstehenden Aufgaben für den Fokus-Modus.',
        });
    }
  }

  const handleExitFocusMode = (completedTaskIds?: number[]) => {
      setIsFocusMode(false);
      if(completedTaskIds) {
          setHomeworks(prev => prev.map(hw => completedTaskIds.includes(hw.id) ? {...hw, done: true, completedAt: Date.now()} : hw));
      }
  }

  const focusModeTasks: FocusTask[] = upcomingHomeworks
    .map(hw => ({ id: hw.id, title: `${hw.subject || "Allgemein"}: ${hw.task}` }));


  if (isFocusMode) {
      return <FocusMode tasks={focusModeTasks} onExit={handleExitFocusMode} />;
  }
  
  if (!isMounted) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Hausaufgabenplaner</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Laden...</p>
            </CardContent>
        </Card>
    ); 
  }

  return (
    <Card className="h-full flex flex-col min-h-[500px]">
      <CardHeader>
        <CardTitle className="flex flex-wrap gap-4 justify-between items-center">
          <span>Hausaufgabenplaner</span>
          <div className="flex gap-2">
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

            <Dialog open={showScanInfo} onOpenChange={setShowScanInfo}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleCameraClick} disabled={isScanning}>
                  {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  <span className="sr-only">Hausaufgabe scannen</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Hausaufgabe scannen</DialogTitle>
                    <DialogDescription>
                       Mache ein Foto von deinen Hausaufgaben, um sie automatisch hinzuzufügen.
                    </DialogDescription>
                  </DialogHeader>
                   <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>Datenschutzhinweis</AlertTitle>
                      <AlertDescription>
                          Dein hochgeladenes Bild wird zur Analyse sicher an eine Google API gesendet und nicht dauerhaft gespeichert.
                      </AlertDescription>
                  </Alert>
                  <DialogFooter>
                      <Button variant="outline" onClick={() => setShowScanInfo(false)}>Abbrechen</Button>
                       <Button onClick={() => {
                           setShowScanInfo(false);
                           fileInputRef.current?.click();
                       }}>
                         <Camera className="mr-2" /> Foto auswählen
                       </Button>
                  </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2" /> Neue Aufgabe
                </Button>
              </DialogTrigger>
              <DialogContent onEscapeKeyDown={handleCloseDialog}>
                <DialogHeader>
                  <DialogTitle>{editingHomework ? 'Hausaufgabe bearbeiten' : 'Neue Hausaufgabe hinzufügen'}</DialogTitle>
                  <DialogDescription>
                    {editingHomework ? 'Ändere die Details deiner Aufgabe.' : 'Fülle die Details für deine neue Aufgabe aus.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Input
                    placeholder="Fach (z.B. Mathe)"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                  />
                  <Textarea
                    placeholder="Aufgabe (z.B. Buch S. 55 Nr. 3)"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </div>
                <DialogFooter className="pt-4 sm:pt-0">
                    <Button variant="outline" onClick={handleCloseDialog}>Abbrechen</Button>
                    <Button onClick={handleSaveHomework}>{editingHomework ? 'Änderungen speichern' : 'Hinzufügen'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="flex flex-col gap-4">
        {upcomingHomeworks.length > 0 && (
            <Alert className="bg-primary/10 border-primary/40">
                <PlayCircle className="h-4 w-4" />
                <AlertTitle className="text-primary font-bold">Fokus-Modus</AlertTitle>
                <AlertDescription>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <p>Starte eine konzentrierte Lerneinheit mit allen anstehenden Aufgaben.</p>
                        <Button 
                            size="sm" 
                            className="mt-2 sm:mt-0 w-full sm:w-auto flex-shrink-0"
                            onClick={handleStartFocusMode}
                        >
                            Fokus-Modus starten
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>
        )}

          <h3 className="font-bold text-lg">Anstehend</h3>
          {upcomingHomeworks.length > 0 ? (
            upcomingHomeworks
              .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
              .map((hw) => (
              <div
                key={hw.id}
                className="flex items-start gap-4 p-3 rounded-md bg-secondary"
              >
                <Checkbox
                  checked={hw.done}
                  onCheckedChange={() => toggleDone(hw.id)}
                  id={`hw-${hw.id}`}
                  aria-label={`Mark task as done: ${hw.task}`}
                  className="mt-1"
                />
                <label
                  htmlFor={`hw-${hw.id}`}
                  className={`flex-1 grid gap-1 ${hw.done ? "line-through text-muted-foreground" : ""}`}
                >
                  <div className="flex justify-between items-baseline flex-wrap">
                    <span className="font-semibold text-base">{hw.subject || "Allgemein"}</span>
                      {hw.dueDate && <span className="text-xs">{new Date(hw.dueDate).toLocaleDateString('de-DE')}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground break-words">{hw.task}</p>
                </label>
                <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(hw)}
                      className="shrink-0"
                      >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteHomework(hw.id)}
                      className="shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
              </div>
            ))
          ) : (
              <p className="text-muted-foreground text-center p-4">Super! Keine anstehenden Aufgaben.</p>
          )}

          {doneHomeworks.length > 0 && <h3 className="font-bold text-lg mt-4">Erledigt</h3>}
          {doneHomeworks
              .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
              .map((hw) => (
              <div
                key={hw.id}
                className="flex items-start gap-3 p-3 rounded-md bg-secondary/50"
              >
                <Checkbox
                  checked={hw.done}
                  onCheckedChange={() => toggleDone(hw.id)}
                  id={`hw-${hw.id}`}
                  className="mt-1"
                />
                <label
                  htmlFor={`hw-${hw.id}`}
                  className={`flex-1 grid gap-1 ${hw.done ? "line-through text-muted-foreground" : ""}`}
                >
                  <div className="flex justify-between items-baseline flex-wrap">
                    <span className="font-semibold text-base">{hw.subject || "Allgemein"}</span>
                      {hw.dueDate && <span className="text-xs">{new Date(hw.dueDate).toLocaleDateString('de-DE')}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground break-words">{hw.task}</p>
                </label>
                 <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(hw)}
                      className="shrink-0"
                      >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteHomework(hw.id)}
                      className="shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
