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
  User,
  Star,
  BookOpen,
  ListChecks,
  Clock,
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
import { cn } from "@/lib/utils";

type Homework = {
  id: string; // Firestore document ID
  subject: string;
  task: string;
  description?: string;
  dueDate: string;
  done: boolean;
  completedAt?: number;
  groupHwId?: string;
  createdByName?: string;
  createdBy?: string;
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

  // Local cache for instant 0ms rendering
  const [cachedPersonalHw, setCachedPersonalHw] = useState<Homework[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cached_personal_homeworks') || localStorage.getItem('homeworks');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  const [cachedGroupHw, setCachedGroupHw] = useState<GroupHomework[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cached_group_homeworks');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  const [cachedDeletedGroupHwIds, setCachedDeletedGroupHwIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cached_deleted_group_hw_ids');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  // Sync incoming Firestore snapshots into cache
  useEffect(() => {
    if (personalHomeworks) {
      setCachedPersonalHw(personalHomeworks as Homework[]);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cached_personal_homeworks', JSON.stringify(personalHomeworks));
        localStorage.setItem('homeworks', JSON.stringify(personalHomeworks));
      }
    }
  }, [personalHomeworks]);

  useEffect(() => {
    if (groupHomeworks) {
      setCachedGroupHw(groupHomeworks);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cached_group_homeworks', JSON.stringify(groupHomeworks));
      }
    }
  }, [groupHomeworks]);

  useEffect(() => {
    if (userProfile?.settings?.deletedGroupHwIds) {
      setCachedDeletedGroupHwIds(userProfile.settings.deletedGroupHwIds);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cached_deleted_group_hw_ids', JSON.stringify(userProfile.settings.deletedGroupHwIds));
      }
    }
  }, [userProfile?.settings?.deletedGroupHwIds]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);

  const [newSubject, setNewSubject] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [shareWithGroup, setShareWithGroup] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'personal' | 'shared'>('all');
  
  const [isScanning, setIsScanning] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showScanInfo, setShowScanInfo] = useState(false);
  const { toast } = useToast();
  const { aiLanguage } = useTheme();

  // Get subjects from timetable and afternoon lessons for the dropdown
  const timetableSubjects = useMemo(() => {
    const subjects = new Set<string>();
    
    // 1. From User Profile timetable
    if (userProfile?.timetable) {
        const tt = userProfile.timetable;
        const days = tt.weekA ? [...Object.values(tt.weekA), ...Object.values(tt.weekB)] : Object.values(tt);
        days.forEach((day: any) => {
            if (Array.isArray(day)) {
                day.forEach((entry: any) => {
                    if (entry.fach && entry.fach.trim() !== "" && entry.fach !== "Pause") {
                        subjects.add(entry.fach.trim());
                    }
                });
            }
        });
    }

    // 2. From User Profile customAfternoon
    if (userProfile?.customAfternoon && Array.isArray(userProfile.customAfternoon)) {
        userProfile.customAfternoon.forEach((lesson: any) => {
            if (lesson.fach && lesson.fach.trim() !== "") {
                subjects.add(lesson.fach.trim());
            }
        });
    }

    // 3. Fallback / Local Storage
    if (typeof window !== 'undefined') {
        const localAfternoon = localStorage.getItem('customAfternoon');
        if (localAfternoon) {
            try {
                const parsed = JSON.parse(localAfternoon);
                if (Array.isArray(parsed)) {
                    parsed.forEach((lesson: any) => {
                        if (lesson.fach && lesson.fach.trim() !== "") {
                            subjects.add(lesson.fach.trim());
                        }
                    });
                }
            } catch (e) {}
        }
    }
    
    return Array.from(subjects).sort();
  }, [userProfile?.timetable, userProfile?.customAfternoon]);

  const effectivePersonal = personalHomeworks ?? cachedPersonalHw;
  const effectiveGroup = groupHomeworks ?? cachedGroupHw;
  const effectiveDeletedIds = userProfile?.settings?.deletedGroupHwIds ?? cachedDeletedGroupHwIds;

  // Combine personal and group homeworks
  const allHomeworks = useMemo(() => {
    const combined: Homework[] = [...(effectivePersonal || [])];
    const deletedGroupIds = effectiveDeletedIds || [];
    
    if (effectiveGroup) {
        effectiveGroup.forEach(ghw => {
            // Check if this group task is already in personal list or marked as deleted by user
            const alreadyInList = effectivePersonal?.some(phw => phw.groupHwId === ghw.id);
            const isIgnored = deletedGroupIds.includes(ghw.id);

            if (!alreadyInList && !isIgnored) {
                combined.push({
                    id: `ghw-${ghw.id}`,
                    subject: ghw.subject,
                    task: ghw.task,
                    description: ghw.description,
                    dueDate: ghw.dueDate,
                    done: false,
                    groupHwId: ghw.id,
                    createdBy: ghw.createdBy,
                    createdByName: ghw.createdByName,
                });
            }
        });
    }
    
    // Filter out homeworks that are past their due date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return combined.filter(hw => {
        if (!hw.dueDate) return true;
        const dueDate = new Date(hw.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate >= today;
    });
  }, [effectivePersonal, effectiveGroup, effectiveDeletedIds]);

  const activeHomeworks = useMemo(() => {
    return allHomeworks.filter(hw => {
      const isNotDone = !hw.done;
      const isDoneRecently = hw.done && hw.completedAt && (Date.now() - hw.completedAt < 24 * 60 * 60 * 1000);
      return isNotDone || isDoneRecently;
    });
  }, [allHomeworks]);
  
  const upcomingHomeworks = useMemo(() => {
    return activeHomeworks.filter(hw => !hw.done);
  }, [activeHomeworks]);

  const doneHomeworks = useMemo(() => {
    return activeHomeworks.filter(hw => hw.done);
  }, [activeHomeworks]);

  // Filtered upcoming tasks
  const filteredUpcoming = useMemo(() => {
    if (filterMode === 'personal') {
      return upcomingHomeworks.filter(hw => !hw.groupHwId);
    }
    if (filterMode === 'shared') {
      return upcomingHomeworks.filter(hw => !!hw.groupHwId);
    }
    return upcomingHomeworks;
  }, [upcomingHomeworks, filterMode]);

  // Group filtered upcoming tasks by Subject
  const groupedUpcomingHomeworks = useMemo(() => {
    const groups: { [subject: string]: Homework[] } = {};
    
    filteredUpcoming.forEach(hw => {
      const subject = hw.subject?.trim() || "Allgemein";
      if (!groups[subject]) {
        groups[subject] = [];
      }
      groups[subject].push(hw);
    });

    // Sort tasks within each subject by due date
    Object.keys(groups).forEach(subject => {
      groups[subject].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    });

    // Sort subjects alphabetically, keeping "Allgemein" at the end if other subjects exist
    return Object.entries(groups).sort(([subjA], [subjB]) => {
      if (subjA === "Allgemein" && subjB !== "Allgemein") return 1;
      if (subjB === "Allgemein" && subjA !== "Allgemein") return -1;
      return subjA.localeCompare(subjB, 'de');
    });
  }, [filteredUpcoming]);

  const resetDialogForm = () => {
      setNewSubject(timetableSubjects[0] || "Allgemein");
      setNewTask("");
      setNewDescription("");
      setNewDueDate("");
      setShareWithGroup(false);
      setEditingHomework(null);
      setIsCustomSubject(false);
      setCustomSubjectName("");
  }

  const handleOpenDialog = (hw: Homework | null = null) => {
      if (hw) {
          setEditingHomework(hw);
          const inList = hw.subject === "Allgemein" || timetableSubjects.includes(hw.subject);
          if (inList) {
              setNewSubject(hw.subject || "Allgemein");
              setIsCustomSubject(false);
              setCustomSubjectName("");
          } else {
              setNewSubject("__custom__");
              setIsCustomSubject(true);
              setCustomSubjectName(hw.subject || "");
          }
          setNewTask(hw.task);
          setNewDescription(hw.description || "");
          setNewDueDate(hw.dueDate);
          setShareWithGroup(false);
      } else {
          resetDialogForm();
      }
      setIsDialogOpen(true);
  }

  const handleCloseDialog = () => {
      resetDialogForm();
      setIsDialogOpen(false);
  }

  // Helper to find the next class date for a subject
  const getNextClassDate = (subject: string): string => {
    if (!subject || subject === "Allgemein" || !userProfile?.timetable) return "";
    
    const ttDaysOrder = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
    const now = new Date();
    
    // Check next 7 days starting from tomorrow
    for (let i = 1; i <= 7; i++) {
        const checkDate = new Date();
        checkDate.setDate(now.getDate() + i);
        const checkDayIndex = checkDate.getDay(); // 0-6 (Sun-Sat)
        
        if (checkDayIndex === 0 || checkDayIndex === 6) continue; // Skip weekend
        
        const dayName = ttDaysOrder[checkDayIndex - 1];
        
        let daySchedule: any[] = [];
        const tt = userProfile.timetable;

        if (tt.weekA && tt.weekB) {
            const getWeekNumber = (date: Date) => {
              const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
              const dayNum = d.getUTCDay() || 7;
              d.setUTCDate(d.getUTCDate() + 4 - dayNum);
              const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
              return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
            };
            const weekType = getWeekNumber(checkDate) % 2 !== 0 ? 'A' : 'B';
            daySchedule = (tt[`week${weekType}`] || {})[dayName] || [];
        } else {
            daySchedule = tt[dayName] || [];
        }
        
        const hasClass = daySchedule.some((e: any) => e.fach === subject && e.fach.trim() !== "");
        if (hasClass) {
            return checkDate.toISOString().split('T')[0];
        }
    }
    
    return "";
  };

  const saveToPersonalCache = (newList: Homework[]) => {
    setCachedPersonalHw(newList);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cached_personal_homeworks', JSON.stringify(newList));
        localStorage.setItem('homeworks', JSON.stringify(newList));
      } catch (e) {}
    }
  };

  const handleSaveHomework = async () => {
    if (!newTask.trim() || !user) return;

    const finalSubject = isCustomSubject 
      ? (customSubjectName.trim() || "Allgemein") 
      : (newSubject.trim() || "Allgemein");

    let finalDueDate = newDueDate;
    if (!finalDueDate && finalSubject && finalSubject !== "Allgemein") {
        finalDueDate = getNextClassDate(finalSubject);
    }

    const homeworkData = {
        subject: finalSubject,
        task: newTask.trim(),
        description: newDescription.trim(),
        dueDate: finalDueDate || "",
    };

    if (editingHomework) {
        const docRef = doc(firestore, `users/${user.uid}/homeworks`, editingHomework.id);
        updateDocumentNonBlocking(docRef, homeworkData);
        saveToPersonalCache((effectivePersonal || []).map(hw => hw.id === editingHomework.id ? { ...hw, ...homeworkData } : hw));
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
                createdByName: user.displayName || user.email?.split('@')[0] || "Anonym",
                createdAt: Date.now()
            }, { merge: true });
        }

        const newHomework = {
            ...homeworkData,
            done: false,
            groupHwId: groupHwId || null
        };
        addDocumentNonBlocking(homeworksRef!, newHomework);
        
        const tempId = `local-${Date.now()}`;
        saveToPersonalCache([{
            id: tempId,
            ...newHomework,
            groupHwId: groupHwId || undefined
        }, ...(effectivePersonal || [])]);

        if (groupHwId) {
            toast({ title: 'Aufgabe hinzugefügt und mit der Klasse geteilt!' });
        } else {
            toast({ title: 'Neue Aufgabe hinzugefügt!' });
        }
    }
    
    handleCloseDialog();
  };
  
  const addMultipleHomeworks = (tasks: {subject: string, task: string, dueDate?: string}[]) => {
      if (!user || !homeworksRef) return;
      const newItems: Homework[] = [];
      tasks.forEach((t, i) => {
          const newHomework = {
              subject: t.subject || "Allgemein",
              task: t.task,
              dueDate: t.dueDate || "",
              done: false,
          };
          addDocumentNonBlocking(homeworksRef, newHomework);
          newItems.push({
            id: `local-${Date.now()}-${i}`,
            ...newHomework
          });
      });
      saveToPersonalCache([...newItems, ...(effectivePersonal || [])]);
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
        saveToPersonalCache([{
            id: `local-${Date.now()}`,
            ...newPersonalHw
        }, ...(effectivePersonal || [])]);
        toast({ title: "In deine Liste übernommen und erledigt!" });
    } else {
        const docRef = doc(firestore, `users/${user.uid}/homeworks`, id);
        const isDone = !homework.done;
        const updatedData = { done: isDone, completedAt: isDone ? Date.now() : null };
        updateDocumentNonBlocking(docRef, updatedData);
        saveToPersonalCache((effectivePersonal || []).map(hw => hw.id === id ? { ...hw, done: isDone, completedAt: isDone ? Date.now() : undefined } : hw));
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
        const updatedDeleted = [...cachedDeletedGroupHwIds, homework.groupHwId];
        setCachedDeletedGroupHwIds(updatedDeleted);
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('cached_deleted_group_hw_ids', JSON.stringify(updatedDeleted));
            } catch (e) {}
        }
    }

    if (id.startsWith('ghw-')) {
        // Only needs to be added to ignore list (done above)
        toast({ title: "Aufgabe ausgeblendet" });
    } else {
        const docRef = doc(firestore, `users/${user.uid}/homeworks`, id);
        deleteDocumentNonBlocking(docRef);
        saveToPersonalCache((effectivePersonal || []).filter(hw => hw.id !== id));
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

  const handleExitFocusMode = (completedTaskIds?: number[]) => {
      setIsFocusMode(false);
      if(completedTaskIds && user) {
          let updatedPersonal = [...(effectivePersonal || [])];
          completedTaskIds.forEach(numId => {
              const hw = upcomingHomeworks[numId - 1];
              if (!hw) return;
              if (hw.id.startsWith('ghw-')) {
                  if (hw.groupHwId && homeworksRef) {
                      const newPersonalHw = {
                          subject: hw.subject,
                          task: hw.task,
                          description: hw.description,
                          dueDate: hw.dueDate,
                          done: true,
                          completedAt: Date.now(),
                          groupHwId: hw.groupHwId
                      };
                      addDocumentNonBlocking(homeworksRef, newPersonalHw);
                      updatedPersonal = [{ id: `local-${Date.now()}-${numId}`, ...newPersonalHw }, ...updatedPersonal];
                  }
              } else {
                  const docRef = doc(firestore, `users/${user.uid}/homeworks`, hw.id);
                  updateDocumentNonBlocking(docRef, { done: true, completedAt: Date.now() });
                  updatedPersonal = updatedPersonal.map(h => h.id === hw.id ? { ...h, done: true, completedAt: Date.now() } : h);
              }
          });
          saveToPersonalCache(updatedPersonal);
      }
  }

  const focusModeTasks: FocusTask[] = upcomingHomeworks
    .map((hw, idx) => ({ id: idx + 1, title: `${hw.subject || "Allgemein"}: ${hw.task}` }));

  if (isFocusMode) {
      return <FocusMode tasks={focusModeTasks} onExit={handleExitFocusMode} />;
  }

  return (
    <Card className="h-full flex flex-col min-h-[500px]">
      <CardHeader>
        <CardTitle className="flex flex-wrap gap-4 justify-between items-center">
          <div className="flex items-center gap-2">
            <span>Hausaufgabenplaner</span>
            {(isLoadingHomeworks || (userProfile?.groupId && isLoadingGroupHw)) && !personalHomeworks && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground opacity-60" />
            )}
          </div>
          <div className="flex gap-2">
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

            <Dialog open={showScanInfo} onOpenChange={setShowScanInfo}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleCameraClick} disabled={isScanning}>
                  {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  <span className="sr-only">Hausaufgabe scannen</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-[500px] overflow-x-hidden">
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
                <Button onClick={() => handleOpenDialog()} className="rounded-xl font-bold gap-1.5 shadow-sm">
                  <Plus className="w-4 h-4" /> Neue Aufgabe
                </Button>
              </DialogTrigger>
              <DialogContent onEscapeKeyDown={handleCloseDialog} className="sm:max-w-lg rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl font-black">
                    <ListChecks className="w-5 h-5 text-primary" />
                    {editingHomework ? 'Hausaufgabe bearbeiten' : 'Neue Hausaufgabe hinzufügen'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingHomework ? 'Ändere die Details deiner Aufgabe.' : 'Trage eine neue Aufgabe für deinen Planer ein.'}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-3">
                  {/* Subject Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider">Fach</Label>
                    {!isCustomSubject ? (
                      <div className="space-y-2">
                        <Select 
                          value={newSubject} 
                          onValueChange={(val) => {
                            if (val === "__custom__") {
                              setIsCustomSubject(true);
                            } else {
                              setNewSubject(val);
                            }
                          }}
                        >
                          <SelectTrigger className="rounded-xl font-bold bg-secondary/30">
                            <SelectValue placeholder="Fach auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Allgemein">Allgemein</SelectItem>
                            {timetableSubjects.filter(s => s !== "Allgemein").map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                            <SelectItem value="__custom__">Anderes Fach eintragen...</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input 
                          placeholder="z.B. Mathematik, Deutsch..." 
                          value={customSubjectName} 
                          onChange={e => setCustomSubjectName(e.target.value)} 
                          className="rounded-xl font-medium bg-secondary/30"
                        />
                        <Button 
                          type="button" 
                          variant="link" 
                          size="sm" 
                          onClick={() => { setIsCustomSubject(false); setNewSubject(timetableSubjects[0] || "Allgemein"); }}
                          className="text-xs h-auto p-0 text-primary font-bold"
                        >
                          ← Aus Stundenplan-Fächern wählen
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Task Title */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider">Aufgabe *</Label>
                    <Input
                      placeholder="z.B. Buch S. 55 Nr. 3 a, b"
                      value={newTask}
                      onChange={(e) => setNewTask(e.target.value)}
                      className="rounded-xl font-bold bg-secondary/30 text-base"
                    />
                  </div>

                  {/* Content / Subtasks / Description */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider">Inhalt & Teilaufgaben (optional)</Label>
                    <Textarea
                      placeholder="Zusätzliche Details, Teilaufgaben (z.B. - Nr. 1a&#10;- Nr. 1b)..."
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      rows={3}
                      className="rounded-xl bg-secondary/30 text-sm resize-none"
                    />
                  </div>
                  
                  {/* Due Date with Quick Presets */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider">Fälligkeitsdatum</Label>
                    <Input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="rounded-xl font-medium bg-secondary/30"
                    />
                    {/* Presets */}
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-bold mr-1">Schnellwahl:</span>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 1);
                          setNewDueDate(d.toISOString().split('T')[0]);
                        }}
                        className="h-6 text-[10px] font-bold px-2 rounded-lg"
                      >
                        Morgen
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 2);
                          setNewDueDate(d.toISOString().split('T')[0]);
                        }}
                        className="h-6 text-[10px] font-bold px-2 rounded-lg"
                      >
                        Übermorgen
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 7);
                          setNewDueDate(d.toISOString().split('T')[0]);
                        }}
                        className="h-6 text-[10px] font-bold px-2 rounded-lg"
                      >
                        Nächste Woche
                      </Button>
                      {newDueDate && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setNewDueDate("")} 
                          className="h-6 text-[10px] text-muted-foreground px-2 rounded-lg"
                        >
                          Zurücksetzen
                        </Button>
                      )}
                    </div>
                    {!newDueDate && newSubject && newSubject !== "Allgemein" && (
                      <p className="text-[10px] text-muted-foreground italic pt-1">
                        Wird automatisch auf den nächsten Termin für "{newSubject}" gesetzt.
                      </p>
                    )}
                  </div>
                  
                  {/* Share with group toggle */}
                  {userProfile?.groupId && !editingHomework && (
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-secondary/40 border border-primary/20 mt-1">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <Label htmlFor="group-share" className="font-bold text-sm cursor-pointer">
                            Mit der Gruppe teilen
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Erscheint auch im Gruppen-Dashboard für deine Mitschüler
                          </p>
                        </div>
                      </div>
                      <Switch 
                        id="group-share" 
                        checked={shareWithGroup} 
                        onCheckedChange={setShareWithGroup} 
                      />
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={handleCloseDialog} className="rounded-xl font-bold">
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handleSaveHomework} 
                    disabled={!newTask.trim()} 
                    className="font-bold rounded-xl shadow-sm"
                  >
                    {editingHomework ? 'Änderungen speichern' : 'Hinzufügen'}
                  </Button>
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

          {/* Section Header with View/Filter Toggles */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <h3 className="font-bold text-lg">Anstehend ({filteredUpcoming.length})</h3>
            <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg">
                <Button 
                    variant={filterMode === 'all' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className={cn("h-7 text-xs px-2.5 rounded-md", filterMode === 'all' && "bg-card shadow-xs font-semibold")}
                    onClick={() => setFilterMode('all')}
                >
                    Alle
                </Button>
                <Button 
                    variant={filterMode === 'personal' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className={cn("h-7 text-xs px-2.5 rounded-md", filterMode === 'personal' && "bg-card shadow-xs font-semibold")}
                    onClick={() => setFilterMode('personal')}
                >
                    Eigene
                </Button>
                {userProfile?.groupId && (
                    <Button 
                        variant={filterMode === 'shared' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className={cn("h-7 text-xs px-2.5 rounded-md", filterMode === 'shared' && "bg-card shadow-xs font-semibold")}
                        onClick={() => setFilterMode('shared')}
                    >
                        Geteilt
                    </Button>
                )}
            </div>
          </div>

          {/* Grouped by Subject & Subtasks */}
          {groupedUpcomingHomeworks.length > 0 ? (
            <div className="space-y-4">
              {groupedUpcomingHomeworks.map(([subject, tasks]) => (
                <div key={subject} className="space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <h4 className="font-semibold text-sm text-foreground">{subject}</h4>
                      <span className="text-xs text-muted-foreground font-normal">
                        ({tasks.length} {tasks.length === 1 ? 'Aufgabe' : 'Aufgaben'})
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {tasks.map((hw) => (
                      <div
                        key={hw.id}
                        className="flex items-center justify-between gap-4 p-3 rounded-md bg-secondary"
                      >
                        <div 
                          className="flex items-start gap-4 cursor-pointer flex-1 min-w-0"
                          onClick={() => toggleDone(hw.id)}
                        >
                          <Checkbox
                            checked={hw.done}
                            aria-label={`Mark task as done: ${hw.task}`}
                            className="mt-1 shrink-0"
                          />
                          <div
                            className={`grid gap-1 flex-1 min-w-0 ${hw.done ? "line-through text-muted-foreground" : ""}`}
                          >
                            <div className="flex justify-between items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-base">{hw.task}</span>
                                    {hw.groupHwId ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                                            <Users className="w-3 h-3" />
                                            Geteilt {hw.createdByName ? `· ${hw.createdByName}` : ''}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-background/80 text-muted-foreground font-medium border border-border/40">
                                            <User className="w-3 h-3" />
                                            Eigene
                                        </span>
                                    )}
                                </div>
                                {hw.dueDate && (
                                    <span className="text-xs text-muted-foreground font-medium shrink-0">
                                        Fällig: {new Date(hw.dueDate).toLocaleDateString('de-DE')}
                                    </span>
                                )}
                            </div>

                            {/* Subtasks / Description Details */}
                            {hw.description && (
                                <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                    {hw.description.split('\n').map((line, lIdx) => {
                                        const trimmed = line.trim();
                                        if (!trimmed) return null;
                                        const isBullet = trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•') || /^\d+[\.\)]/.test(trimmed);
                                        return (
                                            <p key={lIdx} className={cn("leading-relaxed", isBullet ? "pl-2 border-l-2 border-primary/40 text-foreground/80" : "")}>
                                                {trimmed}
                                            </p>
                                        );
                                    })}
                                </div>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0">
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
                  </div>
                </div>
              ))}
            </div>
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
                  className="flex items-start gap-3 cursor-pointer flex-1 min-w-0"
                  onClick={() => toggleDone(hw.id)}
                >
                  <Checkbox
                    checked={hw.done}
                    className="mt-1 shrink-0"
                  />
                  <div
                    className={`grid gap-1 flex-1 min-w-0 ${hw.done ? "line-through text-muted-foreground" : ""}`}
                  >
                    <div className="flex justify-between items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-base">{hw.task}</span>
                            <span className="text-xs text-muted-foreground">({hw.subject || "Allgemein"})</span>
                            {hw.groupHwId ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary opacity-60 font-medium">
                                    <Users className="w-3 h-3" /> Geteilt
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-background/50 text-muted-foreground opacity-60 font-medium">
                                    <User className="w-3 h-3" /> Eigene
                                </span>
                            )}
                        </div>
                        {hw.dueDate && <span className="text-xs text-muted-foreground">{new Date(hw.dueDate).toLocaleDateString('de-DE')}</span>}
                    </div>
                    {hw.description && <p className="text-xs text-muted-foreground line-clamp-1">{hw.description}</p>}
                  </div>
                </div>
                <div className="flex shrink-0">
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
