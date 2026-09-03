
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  Users,
  Star,
  BookOpen,
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
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc, arrayUnion } from "firebase/firestore";
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Homework = {
  id: string; // Firestore document ID
  subject: string;
  task: string;
  description?: string;
  dueDate: string;
  done: boolean;
  completedAt?: number;
  groupHwId?: string;
};

type GroupHomework = {
    id: string;
    subject: string;
    task: string;
    description?: string;
    dueDate: string;
    createdBy: string;
    createdByName?: string;
}

export default function HomeworkPlanner() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const userDocRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [firestore, user]);
  const { data: userProfile } = useDoc<any>(userDocRef);

  const homeworksRef = useMemoFirebase(() => 
    user ? collection(firestore, `users/${user.uid}/homeworks`) : null
  , [firestore, user]);

  const { data: personalHomeworks, isLoading: isLoadingHomeworks } = useCollection<Omit<Homework, 'id'>>(homeworksRef);

  const groupHomeworksRef = useMemoFirebase(() => 
    userProfile?.groupId ? collection(firestore, `groups/${userProfile.groupId}/homeworks`) : null
  , [firestore, userProfile?.groupId]);

  const { data: groupHomeworks, isLoading: isLoadingGroupHw } = useCollection<GroupHomework>(groupHomeworksRef);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);

  const [newSubject, setNewSubject] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [shareWithGroup, setShareWithGroup] = useState(false);
  
  const [isScanning, setIsScanning] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showScanInfo, setShowScanInfo] = useState(false);
  const { toast } = useToast();
  const { aiLanguage } = useTheme();

  // Get subjects from timetable for the dropdown
  const timetableSubjects = useMemo(() => {
    if (!userProfile?.timetable) return [];
    const subjects = new Set<string>();
    
    const tt = userProfile.timetable;
    const days = tt.weekA ? [...Object.values(tt.weekA), ...Object.values(tt.weekB)] : Object.values(tt);
    
    days.forEach((day: any) => {
        if (Array.isArray(day)) {
            day.forEach((entry: any) => {
                if (entry.fach && entry.fach.trim() !== "" && entry.fach !== "Pause") {
                    subjects.add(entry.fach);
                }
            });
        }
    });
    
    return Array.from(subjects).sort();
  }, [userProfile?.timetable]);

  // Combine personal and group homeworks
  const allHomeworks = useMemo(() => {
    if (!personalHomeworks) return [];
    
    const combined: Homework[] = [...personalHomeworks];
    const deletedGroupIds = userProfile?.settings?.deletedGroupHwIds || [];
    
    if (groupHomeworks) {
        groupHomeworks.forEach(ghw => {
            // Check if this group task is already in personal list or marked as deleted by user
            const alreadyInList = personalHomeworks.find(phw => phw.groupHwId === ghw.id);
            const isIgnored = deletedGroupIds.includes(ghw.id);

            if (!alreadyInList && !isIgnored) {
                combined.push({
                    id: `ghw-${ghw.id}`,
                    subject: ghw.subject,
                    task: ghw.task,
                    description: ghw.description,
                    dueDate: ghw.dueDate,
                    done: false,
                    groupHwId: ghw.id
                });
            }
        });
    }
    
    return combined;
  }, [personalHomeworks, groupHomeworks, userProfile?.settings?.deletedGroupHwIds]);

  const activeHomeworks = allHomeworks.filter(hw => {
    const isNotDone = !hw.done;
    const isDoneRecently = hw.done && hw.completedAt && (Date.now() - hw.completedAt < 24 * 60 * 60 * 1000);
    return isNotDone || isDoneRecently;
  });
  
  const upcomingHomeworks = activeHomeworks.filter(hw => !hw.done);
  const doneHomeworks = activeHomeworks.filter(hw => hw.done);

  const resetDialogForm = () => {
      setNewSubject("");
      setNewTask("");
      setNewDescription("");
      setNewDueDate("");
      setShareWithGroup(false);
      setEditingHomework(null);
  }

  const handleOpenDialog = (hw: Homework | null = null) => {
      if (hw) {
          setEditingHomework(hw);
          setNewSubject(hw.subject);
          setNewTask(hw.task);
          setNewDescription(hw.description || "");
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

    const homeworkData = {
        subject: newSubject || "Allgemein",
        task: newTask,
        description: newDescription,
        dueDate: newDueDate || "",
    };

    if (editingHomework) {
        const docRef = doc(firestore, `users/${user.uid}/homeworks`, editingHomework.id);
        updateDocumentNonBlocking(docRef, homeworkData);
        toast({ title: 'Aufgabe aktualisiert!' });
    } else {
        let groupHwId: string | undefined = undefined;

        // Share with group if toggled
        if (shareWithGroup && groupHomeworksRef) {
            const newGroupHwRef = doc(groupHomeworksRef);
            groupHwId = newGroupHwRef.id;

            setDocumentNonBlocking(newGroupHwRef, {
                ...homeworkData,
                createdBy: user.uid,
                createdByName: user.displayName || user.email?.split('@')[0] || "Anonym"
            }, { merge: true });
        }

        const newHomework = {
            ...homeworkData,
            done: false,
            groupHwId: groupHwId || null
        };
        addDocumentNonBlocking(homeworksRef!, newHomework);
        
        if (groupHwId) {
            toast({ title: 'Aufgabe hinzugefügt und geteilt!' });
        } else {
            toast({ title: 'Neue Aufgabe hinzugefügt!' });
        }
    }
    
    handleCloseDialog();
  };
  
  const addMultipleHomeworks = (tasks: {subject: string, task: string, dueDate?: string}[]) => {
      if (!user || !homeworksRef) return;
      tasks.forEach(t => {
          const newHomework = {
              subject: t.subject || "Allgemein",
              task: t.task,
              dueDate: t.dueDate || "",
              done: false,
          };
          addDocumentNonBlocking(homeworksRef, newHomework);
      });
  }

  const toggleDone = (id: string) => {
    if (!user || !firestore) return;
    
    const homework = allHomeworks.find(hw => hw.id === id);
    if (!homework) return;

    if (id.startsWith('ghw-') && homework.groupHwId) {
        // This is a group task not yet in personal list
        // Create a personal record for it
        const newPersonalHw = {
            subject: homework.subject,
            task: homework.task,
            description: homework.description,
            dueDate: homework.dueDate,
            done: true,
            completedAt: Date.now(),
            groupHwId: homework.groupHwId
        };
        addDocumentNonBlocking(homeworksRef!, newPersonalHw);
        toast({ title: "In deine Liste übernommen und erledigt!" });
    } else {
        const docRef = doc(firestore, `users/${user.uid}/homeworks`, id);
        const isDone = !homework.done;
        const updatedData = { done: isDone, completedAt: isDone ? Date.now() : null };
        updateDocumentNonBlocking(docRef, updatedData);
    }
  };

  const deleteHomework = (id: string) => {
    if (!user || !firestore) return;
    
    const homework = allHomeworks.find(hw => hw.id === id);
    if (!homework) return;

    // If it's a group task (either virtual ghw- or already a personal copy), add to ignore list
    if (homework.groupHwId && userDocRef) {
        updateDoc(userDocRef, {
            'settings.deletedGroupHwIds': arrayUnion(homework.groupHwId)
        });
    }

    if (id.startsWith('ghw-')) {
        // Only needs to be added to ignore list (done above)
        toast({ title: "Aufgabe ausgeblendet" });
    } else {
        const docRef = doc(firestore, `users/${user.uid}/homeworks`, id);
        deleteDocumentNonBlocking(docRef);
        toast({ title: "Aufgabe gelöscht" });
    }
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
              if (id.startsWith('ghw-')) {
                  const ghw = allHomeworks.find(h => h.id === id);
                  if (ghw && ghw.groupHwId) {
                      addDocumentNonBlocking(homeworksRef!, {
                          subject: ghw.subject,
                          task: ghw.task,
                          description: ghw.description,
                          dueDate: ghw.dueDate,
                          done: true,
                          completedAt: Date.now(),
                          groupHwId: ghw.groupHwId
                      });
                  }
              } else {
                  const docRef = doc(firestore, `users/${user.uid}/homeworks`, id);
                  updateDocumentNonBlocking(docRef, { done: true, completedAt: Date.now() });
              }
          });
      }
  }

  const focusModeTasks: FocusTask[] = upcomingHomeworks
    .map(hw => ({ id: hw.id, title: `${hw.subject || "Allgemein"}: ${hw.task}` }));


  if (isFocusMode) {
      return <FocusMode tasks={focusModeTasks} onExit={handleExitFocusMode} />;
  }
  
  if (isLoadingHomeworks || (userProfile?.groupId && isLoadingGroupHw)) {
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
              <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
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
              <DialogContent onEscapeKeyDown={handleCloseDialog} className="max-w-[95vw] sm:max-w-[550px] max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingHomework ? 'Hausaufgabe bearbeiten' : 'Neue Hausaufgabe hinzufügen'}</DialogTitle>
                  <DialogDescription>
                    {editingHomework ? 'Ändere die Details deiner Aufgabe.' : 'Gib den Titel deiner neuen Aufgabe ein.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-title">Titel / Aufgabe <span className="text-destructive">*</span></Label>
                    <Input
                        id="task-title"
                        placeholder="z.B. Buch S. 55 Nr. 3"
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="task-content">Inhalt</Label>
                    <Textarea
                        id="task-content"
                        placeholder="Zusätzliche Details zur Aufgabe..."
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="task-subject">Fach</Label>
                    <Select value={newSubject} onValueChange={setNewSubject}>
                        <SelectTrigger id="task-subject">
                            <SelectValue placeholder="Fach wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Allgemein">Allgemein</SelectItem>
                            {timetableSubjects.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="task-date">Fälligkeitsdatum</Label>
                    <Input
                        id="task-date"
                        type="date"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                    />
                  </div>
                  
                  {userProfile?.groupId && !editingHomework && (
                      <div className="flex items-center space-x-2 p-2 bg-secondary/50 rounded-lg">
                          <Switch 
                            id="group-share" 
                            checked={shareWithGroup} 
                            onCheckedChange={setShareWithGroup} 
                          />
                          <Label htmlFor="group-share" className="flex items-center gap-2 cursor-pointer">
                              <Users className="w-4 h-4 text-primary" />
                              Mit der Gruppe teilen
                          </Label>
                      </div>
                  )}
                </div>
                <DialogFooter className="pt-4 sm:pt-0">
                    <Button variant="outline" onClick={handleCloseDialog}>Abbrechen</Button>
                    <Button onClick={handleSaveHomework} disabled={!newTask.trim()}>{editingHomework ? 'Änderungen speichern' : 'Hinzufügen'}</Button>
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
              .sort((a, b) => {
                  if (!a.dueDate) return 1;
                  if (!b.dueDate) return -1;
                  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
              })
              .map((hw) => (
              <div
                key={hw.id}
                className="flex items-center justify-between gap-4 p-3 rounded-md bg-secondary"
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
                    className={`grid gap-1 flex-1 ${hw.done ? "line-through text-muted-foreground" : ""}`}
                  >
                    <div className="flex justify-between items-baseline flex-wrap">
                        <div className="flex items-center gap-2">
                             <span className="font-semibold text-base">{hw.subject || "Allgemein"}</span>
                             {hw.groupHwId && <Star className="w-3.5 h-3.5 text-primary fill-primary" title="Gruppenaufgabe" />}
                        </div>
                        {hw.dueDate && <span className="text-xs">{new Date(hw.dueDate).toLocaleDateString('de-DE')}</span>}
                    </div>
                    <p className="text-sm font-medium">{hw.task}</p>
                    {hw.description && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{hw.description}</p>}
                  </div>
                </div>
                <div className="flex">
                    {!hw.id.startsWith('ghw-') && (
                        <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(hw)}
                        className="shrink-0"
                        >
                        <Pencil className="w-4 h-4" />
                        </Button>
                    )}
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
                className="flex items-center justify-between gap-3 p-3 rounded-md bg-secondary/50"
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
                    className={`grid gap-1 flex-1 ${hw.done ? "line-through text-muted-foreground" : ""}`}
                  >
                    <div className="flex justify-between items-baseline flex-wrap">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-base">{hw.subject || "Allgemein"}</span>
                            {hw.groupHwId && <Star className="w-3 h-3 text-primary fill-primary opacity-50" />}
                        </div>
                        {hw.dueDate && <span className="text-xs">{new Date(hw.dueDate).toLocaleDateString('de-DE')}</span>}
                    </div>
                    <p className="text-sm font-medium">{hw.task}</p>
                    {hw.description && <p className="text-xs text-muted-foreground line-clamp-1">{hw.description}</p>}
                  </div>
                </div>
                <div className="flex">
                    {!hw.id.startsWith('ghw-') && (
                        <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(hw)}
                        className="shrink-0"
                        >
                        <Pencil className="w-4 h-4" />
                        </Button>
                    )}
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
