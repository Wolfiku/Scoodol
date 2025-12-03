
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
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";


type Homework = {
  id: string; // Firestore document ID
  subject: string;
  task: string;
  dueDate: string;
  done: boolean;
  completedAt?: number;
};

export default function HomeworkPlanner() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const homeworksRef = useMemoFirebase(() => 
    user ? collection(firestore, `users/${user.uid}/homeworks`) : null
  , [firestore, user]);

  const { data: homeworks, isLoading: isLoadingHomeworks } = useCollection<Omit<Homework, 'id'>>(homeworksRef);

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

  const activeHomeworks = homeworks 
    ? homeworks.filter(hw => {
        const isNotDone = !hw.done;
        const isDoneRecently = hw.done && hw.completedAt && (Date.now() - hw.completedAt < 24 * 60 * 60 * 1000);
        return isNotDone || isDoneRecently;
      })
    : [];
  
  const upcomingHomeworks = activeHomeworks.filter(hw => !hw.done);
  const doneHomeworks = activeHomeworks.filter(hw => hw.done);

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

  const handleSaveHomework = async () => {
    if (!newTask.trim() || !user) return;

    if (editingHomework) {
        const docRef = doc(firestore, `users/${user.uid}/homeworks`, editingHomework.id);
        const updatedData = { subject: newSubject, task: newTask, dueDate: newDueDate };
        updateDocumentNonBlocking(docRef, updatedData);
        toast({ title: 'Aufgabe aktualisiert!' });
    } else {
        const newHomework = {
            subject: newSubject,
            task: newTask,
            dueDate: newDueDate,
            done: false,
        };
        addDocumentNonBlocking(homeworksRef!, newHomework);
        toast({ title: 'Neue Aufgabe hinzugefügt!' });
    }
    
    handleCloseDialog();
  };
  
  const addMultipleHomeworks = (tasks: {subject: string, task: string, dueDate?: string}[]) => {
      if (!user || !homeworksRef) return;
      tasks.forEach(t => {
          const newHomework = {
              subject: t.subject,
              task: t.task,
              dueDate: t.dueDate || "",
              done: false,
          };
          addDocumentNonBlocking(homeworksRef, newHomework);
      });
  }

  const toggleDone = (id: string) => {
    if (!user) return;
    const homework = homeworks?.find(hw => hw.id === id);
    if (!homework) return;

    const docRef = doc(firestore, `users/${user.uid}/homeworks`, id);
    const isDone = !homework.done;
    const updatedData = { done: isDone, completedAt: isDone ? Date.now() : null };
    updateDocumentNonBlocking(docRef, updatedData);
  };

  const deleteHomework = (id: string) => {
    if (!user) return;
    const docRef = doc(firestore, `users/${user.uid}/homeworks`, id);
    deleteDocumentNonBlocking(docRef);
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

  const handleExitFocusMode = (completedTaskIds?: string[]) => {
      setIsFocusMode(false);
      if(completedTaskIds && user) {
          completedTaskIds.forEach(id => {
              const docRef = doc(firestore, `users/${user.uid}/homeworks`, id);
              updateDocumentNonBlocking(docRef, { done: true, completedAt: Date.now() });
          });
      }
  }

  const focusModeTasks: FocusTask[] = upcomingHomeworks
    .map(hw => ({ id: hw.id, title: `${hw.subject || "Allgemein"}: ${hw.task}` }));


  if (isFocusMode) {
      return <FocusMode tasks={focusModeTasks} onExit={handleExitFocusMode} />;
  }
  
  if (isLoadingHomeworks) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Hausaufgabenplaner</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center items-center p-8">
                <Loader2 className="w-8 h-8 animate-spin" />
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
                className="flex items-center gap-4 p-3 rounded-md bg-secondary"
              >
                <div 
                  className="flex items-start gap-4 cursor-pointer flex-1"
                  onClick={() => toggleDone(hw.id)}
                >
                  <Checkbox
                    checked={hw.done}
                    aria-label={`Mark task as done: ${hw.task}`}
                    className="mt-1"
                  />
                  <div
                    className={`grid gap-1 ${hw.done ? "line-through text-muted-foreground" : ""}`}
                  >
                    <div className="flex justify-between items-baseline flex-wrap">
                      <span className="font-semibold text-base">{hw.subject || "Allgemein"}</span>
                        {hw.dueDate && <span className="text-xs">{new Date(hw.dueDate).toLocaleDateString('de-DE')}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground break-words">{hw.task}</p>
                  </div>
                </div>
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
                className="flex items-center gap-3 p-3 rounded-md bg-secondary/50"
              >
                <div 
                  className="flex items-start gap-3 cursor-pointer flex-1"
                  onClick={() => toggleDone(hw.id)}
                >
                  <Checkbox
                    checked={hw.done}
                    className="mt-1"
                  />
                  <div
                    className={`grid gap-1 ${hw.done ? "line-through text-muted-foreground" : ""}`}
                  >
                    <div className="flex justify-between items-baseline flex-wrap">
                      <span className="font-semibold text-base">{hw.subject || "Allgemein"}</span>
                        {hw.dueDate && <span className="text-xs">{new Date(hw.dueDate).toLocaleDateString('de-DE')}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground break-words">{hw.task}</p>
                  </div>
                </div>
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

    