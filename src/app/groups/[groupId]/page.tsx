
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, query, orderBy, arrayRemove } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2, ArrowLeft, Copy, User, Check, Users, Calendar, ListChecks, Plus, Trash2, Camera, Info, 
  GraduationCap, MapPin, Clock, ShieldCheck, ShieldAlert, Shield, XCircle, CalendarDays, RefreshCcw, 
  Pencil, Search, Filter, Sparkles, BookOpen, CheckCircle2, Download, ArrowUpDown, ChevronDown, 
  CheckCheck, FolderSync, SlidersHorizontal, AlertTriangle, ArrowRight
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { generateTimeSlots } from '@/app/components/setup-view';
import { scanHomeworkImage } from '@/app/actions';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type TimetableEntry = {
    id: string;
    fach: string;
    lehrer?: string;
    room?: string;
    start: string;
    ende: string;
    hauptfach?: boolean;
};

type TimetableData = {
    [key: string]: TimetableEntry[];
};

type GroupRole = 'admin' | 'bearbeiter' | 'berechtigt' | 'nutzer';

type Group = {
  name: string;
  schoolName: string;
  motto?: string;
  admin: string;
  members: string[];
  roles?: Record<string, GroupRole>;
  timetable: any;
  timetableSettings: any;
}

type MemberProfile = {
  id: string;
  displayName?: string;
  settings?: {
    profilePicture?: string;
  };
}

type GroupHomework = {
    id: string;
    subject: string;
    task: string;
    description?: string;
    dueDate: string;
    done?: boolean;
    createdBy: string;
    createdByName?: string;
    createdAt?: number;
}

type ProcessedEntry = TimetableEntry & { rowspan: number; isContinuation: boolean, originalIndex: number };

const weekDays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

const getWeekNumber = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

function getDueDateBadgeInfo(dueDateStr?: string) {
  if (!dueDateStr) {
    return { text: 'Ohne Abgabe', color: 'bg-muted/60 text-muted-foreground border-transparent' };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dueDateStr);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `Überfällig (${target.toLocaleDateString('de-DE')})`, color: 'bg-destructive/15 text-destructive border-destructive/30 font-bold' };
  }
  if (diffDays === 0) {
    return { text: 'Heute fällig!', color: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 font-bold' };
  }
  if (diffDays === 1) {
    return { text: 'Morgen', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold' };
  }
  if (diffDays <= 7) {
    return { text: `In ${diffDays} Tagen (${target.toLocaleDateString('de-DE', { weekday: 'short' })})`, color: 'bg-primary/10 text-primary border-primary/20 font-medium' };
  }
  return { text: target.toLocaleDateString('de-DE'), color: 'bg-secondary text-secondary-foreground border-border font-medium' };
}

export default function GroupDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params?.groupId as string;
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const groupDocRef = useMemoFirebase(() => 
    typeof groupId === 'string' ? doc(firestore, 'groups', groupId) : null
  , [firestore, groupId]);

  const { data: group, isLoading: isLoadingGroup } = useDoc<Group>(groupDocRef);
  
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Homework state & dialogs
  const [isHwDialogOpen, setIsHwDialogOpen] = useState(false);
  const [editingHw, setEditingHw] = useState<GroupHomework | null>(null);
  const [newHwSubject, setNewHwSubject] = useState("");
  const [newHwTask, setNewHwTask] = useState("");
  const [newHwDescription, setNewHwDescription] = useState("");
  const [newHwDue, setNewHwDue] = useState("");
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [customSubjectName, setCustomSubjectName] = useState("");

  const [hwSearchQuery, setHwSearchQuery] = useState("");
  const [hwSubjectFilter, setHwSubjectFilter] = useState<string>("all");
  const [hwDateFilter, setHwDateFilter] = useState<'all' | 'upcoming' | 'mine'>('all');
  const [hwViewMode, setHwViewMode] = useState<'subject' | 'timeline'>('subject');

  const [deletingHwId, setDeletingHwId] = useState<string | null>(null);
  const [isScanningHw, setIsScanningHw] = useState(false);
  const [importingHwId, setImportingHwId] = useState<string | null>(null);
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const hwFileInputRef = useRef<HTMLInputElement>(null);

  const [groupWeekTab, setGroupWeekTab] = useState<'A' | 'B'>('A');

  const homeworksRef = useMemoFirebase(() => 
    typeof groupId === 'string' ? collection(firestore, `groups/${groupId}/homeworks`) : null
  , [firestore, groupId]);
  const homeworksQuery = useMemoFirebase(() => homeworksRef ? query(homeworksRef, orderBy('dueDate', 'asc')) : null, [homeworksRef]);
  const { data: groupHomeworks, isLoading: isLoadingHw } = useCollection<GroupHomework>(homeworksQuery);

  const userHwRef = useMemoFirebase(() => 
    user ? collection(firestore, `users/${user.uid}/homeworks`) : null
  , [firestore, user]);
  const { data: userHomeworks } = useCollection<{ id: string; groupHwId?: string; subject?: string }>(userHwRef);

  useEffect(() => {
    if (typeof window !== 'undefined' && groupId) {
      setInviteLink(`${window.location.origin}/groups/join/${groupId}`);
    }
  }, [groupId]);

  useEffect(() => {
    if (!isUserLoading && (!user || user.isAnonymous)) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (group?.members && firestore) {
      const fetchMembers = async () => {
        setIsLoadingMembers(true);
        const memberPromises = group.members.map(async (uid) => {
            const d = await getDoc(doc(firestore, 'users', uid));
            return { id: uid, ...d.data() } as MemberProfile;
        });
        const memberProfiles = await Promise.all(memberPromises);
        setMembers(memberProfiles);
        setIsLoadingMembers(false);
      }
      fetchMembers();
    }
  }, [group, firestore]);

  const groupSubjects = useMemo(() => {
    if (!group?.timetable) return [];
    const subjects = new Set<string>();
    const tt = group.timetable;
    // @ts-ignore
    const days = tt.weekA ? [...Object.values(tt.weekA), ...Object.values(tt.weekB)] : Object.values(tt);
    days.forEach((day: any) => {
      if (Array.isArray(day)) {
        day.forEach((entry: any) => {
          if (entry?.fach && entry.fach.trim() !== "" && entry.fach !== "Pause") {
            subjects.add(entry.fach.trim());
          }
        });
      }
    });
    return Array.from(subjects).sort((a, b) => a.localeCompare(b, 'de'));
  }, [group?.timetable]);

  const importedGroupHwIds = useMemo(() => {
    if (!userHomeworks) return new Set<string>();
    const set = new Set<string>();
    userHomeworks.forEach(hw => {
      if (hw.groupHwId) set.add(hw.groupHwId);
    });
    return set;
  }, [userHomeworks]);

  const filteredHomeworks = useMemo(() => {
    if (!groupHomeworks) return [];
    let list = [...groupHomeworks];

    if (hwSearchQuery.trim()) {
      const q = hwSearchQuery.toLowerCase();
      list = list.filter(hw => 
        (hw.subject && hw.subject.toLowerCase().includes(q)) ||
        (hw.task && hw.task.toLowerCase().includes(q)) ||
        (hw.description && hw.description.toLowerCase().includes(q)) ||
        (hw.createdByName && hw.createdByName.toLowerCase().includes(q))
      );
    }

    if (hwSubjectFilter !== 'all') {
      list = list.filter(hw => (hw.subject?.trim() || 'Allgemein') === hwSubjectFilter);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (hwDateFilter === 'upcoming') {
      list = list.filter(hw => {
        if (!hw.dueDate) return true;
        const d = new Date(hw.dueDate);
        d.setHours(0, 0, 0, 0);
        return d >= today;
      });
    } else if (hwDateFilter === 'mine') {
      list = list.filter(hw => hw.createdBy === user?.uid);
    }

    return list;
  }, [groupHomeworks, hwSearchQuery, hwSubjectFilter, hwDateFilter, user?.uid]);

  const groupedBySubject = useMemo(() => {
    const groups: { [subject: string]: GroupHomework[] } = {};
    filteredHomeworks.forEach(hw => {
      const subj = hw.subject?.trim() || 'Allgemein';
      if (!groups[subj]) groups[subj] = [];
      groups[subj].push(hw);
    });

    Object.keys(groups).forEach(subj => {
      groups[subj].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    });

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Allgemein') return 1;
      if (b === 'Allgemein') return -1;
      return a.localeCompare(b, 'de');
    });
  }, [filteredHomeworks]);

  const groupedByTimeline = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - (today.getDay() || 7)));

    const buckets: { key: string; label: string; items: GroupHomework[] }[] = [
      { key: 'overdue', label: 'Überfällig', items: [] },
      { key: 'today', label: 'Heute fällig', items: [] },
      { key: 'tomorrow', label: 'Morgen fällig', items: [] },
      { key: 'thisWeek', label: 'Diese Woche', items: [] },
      { key: 'later', label: 'Später fällig', items: [] },
      { key: 'noDate', label: 'Ohne Abgabedatum', items: [] },
    ];

    filteredHomeworks.forEach(hw => {
      if (!hw.dueDate) {
        buckets[5].items.push(hw);
        return;
      }
      const d = new Date(hw.dueDate);
      d.setHours(0, 0, 0, 0);

      if (d.getTime() < today.getTime()) {
        buckets[0].items.push(hw);
      } else if (d.getTime() === today.getTime()) {
        buckets[1].items.push(hw);
      } else if (d.getTime() === tomorrow.getTime()) {
        buckets[2].items.push(hw);
      } else if (d.getTime() <= endOfWeek.getTime()) {
        buckets[3].items.push(hw);
      } else {
        buckets[4].items.push(hw);
      }
    });

    return buckets.filter(b => b.items.length > 0);
  }, [filteredHomeworks]);

  const unimportedCount = useMemo(() => {
    if (!groupHomeworks) return 0;
    return groupHomeworks.filter(hw => !importedGroupHwIds.has(hw.id)).length;
  }, [groupHomeworks, importedGroupHwIds]);

  const dueThisWeekCount = useMemo(() => {
    if (!groupHomeworks) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    return groupHomeworks.filter(hw => {
      if (!hw.dueDate) return false;
      const d = new Date(hw.dueDate);
      d.setHours(0, 0, 0, 0);
      return d >= today && d <= in7Days;
    }).length;
  }, [groupHomeworks]);

  const currentWeekType = useMemo(() => {
    const weekNum = getWeekNumber(new Date());
    return weekNum % 2 !== 0 ? 'A' : 'B';
  }, []);

  const effectiveGroupTimetable = useMemo<TimetableData>(() => {
    if (!group?.timetable) return {};
    const raw = group.timetable as any;
    if (raw.weekA) {
      return (groupWeekTab === 'A' ? raw.weekA : raw.weekB) as TimetableData || {};
    }
    return (raw as TimetableData) || {};
  }, [group?.timetable, groupWeekTab]);

  const todayName = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][new Date().getDay()];
  
  const todaySchedule = useMemo<TimetableEntry[]>(() => {
    if (!group?.timetable) return [];
    const raw = group.timetable as any;
    if (raw.weekA) {
      const activeTable = (currentWeekType === 'A' ? raw.weekA : raw.weekB) as TimetableData;
      return (activeTable?.[todayName] as TimetableEntry[]) || [];
    }
    return (raw?.[todayName] as TimetableEntry[]) || [];
  }, [group?.timetable, currentWeekType, todayName]);

  const effectiveTimetableSettings = useMemo(() => {
    return group?.timetableSettings || {
      schoolStartTime: '08:00',
      schoolEndTime: '13:00',
      firstBreakDuration: 15,
      secondBreakDuration: 15,
    };
  }, [group?.timetableSettings]);

  const timeSlots = useMemo(() => {
    return generateTimeSlots(effectiveTimetableSettings);
  }, [effectiveTimetableSettings]);

  const processedTimetable = useMemo(() => {
    if (!effectiveGroupTimetable || Object.keys(effectiveGroupTimetable).length === 0) return {};
    return weekDays.reduce((acc, day) => {
      const daySchedule = effectiveGroupTimetable[day] || [];
      const processedDay: ProcessedEntry[] = [];
      let i = 0;
      while (i < daySchedule.length) {
        const currentEntry = daySchedule[i];
        if (!currentEntry?.fach || currentEntry.fach.trim() === '' || currentEntry.fach === 'Pause') {
          processedDay.push({ 
            ...currentEntry, 
            id: currentEntry?.id || `${day}-${i}`, 
            fach: currentEntry?.fach || '', 
            start: timeSlots[i]?.start || '00:00', 
            ende: timeSlots[i]?.ende || '00:00', 
            rowspan: 1, 
            isContinuation: false, 
            originalIndex: i 
          });
          i++; 
          continue;
        }
        let rowspan = 1;
        while (
          i + rowspan < daySchedule.length && 
          daySchedule[i + rowspan]?.fach === currentEntry.fach && 
          daySchedule[i + rowspan]?.lehrer === currentEntry.lehrer && 
          daySchedule[i + rowspan]?.room === currentEntry.room
        ) { 
          rowspan++; 
        }
        processedDay.push({ 
          ...currentEntry, 
          start: timeSlots[i]?.start || '00:00', 
          ende: timeSlots[i + rowspan - 1]?.ende || '00:00', 
          rowspan, 
          isContinuation: false, 
          originalIndex: i 
        });
        for (let j = 1; j < rowspan; j++) { 
          processedDay.push({ 
            ...daySchedule[i + j], 
            rowspan: 0, 
            isContinuation: true, 
            originalIndex: i + j 
          }); 
        }
        i += rowspan;
      }
      acc[day] = processedDay;
      return acc;
    }, {} as { [day: string]: ProcessedEntry[] });
  }, [effectiveGroupTimetable, timeSlots]);

  const maxSlots = useMemo(() => {
    if (!effectiveGroupTimetable || Object.keys(effectiveGroupTimetable).length === 0) return 0;
    let lastUsedSlot = -1;
    weekDays.forEach(day => {
        const daySchedule = effectiveGroupTimetable[day] || [];
        for (let i = daySchedule.length - 1; i >= 0; i--) {
            if (daySchedule[i]?.fach && daySchedule[i].fach.trim() !== '' && daySchedule[i].fach !== 'Pause') {
                if (i > lastUsedSlot) lastUsedSlot = i;
                break; 
            }
        }
    });
    return lastUsedSlot + 1;
  }, [effectiveGroupTimetable]);

  const visibleTimeSlots = useMemo(() => timeSlots.slice(0, Math.max(6, maxSlots)), [timeSlots, maxSlots]);

  const hasAnyEntries = useMemo(() => {
    return Object.values(effectiveGroupTimetable).some(day => 
      Array.isArray(day) && day.some(e => e.fach && e.fach.trim() !== '' && e.fach !== 'Pause')
    );
  }, [effectiveGroupTimetable]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast({ title: 'Kopiert!', description: 'Der Einladungslink wurde in die Zwischenablage kopiert.' });
    setTimeout(() => setCopied(false), 2000);
  }

  const handleOpenAddHwDialog = () => {
    setEditingHw(null);
    setNewHwSubject(groupSubjects[0] || "Allgemein");
    setNewHwTask("");
    setNewHwDescription("");
    setNewHwDue("");
    setIsCustomSubject(false);
    setCustomSubjectName("");
    setIsHwDialogOpen(true);
  };

  const handleOpenEditHwDialog = (hw: GroupHomework) => {
    setEditingHw(hw);
    const inList = hw.subject === 'Allgemein' || groupSubjects.includes(hw.subject);
    if (inList) {
      setNewHwSubject(hw.subject || 'Allgemein');
      setIsCustomSubject(false);
      setCustomSubjectName("");
    } else {
      setNewHwSubject("__custom__");
      setIsCustomSubject(true);
      setCustomSubjectName(hw.subject || "");
    }
    setNewHwTask(hw.task || "");
    setNewHwDescription(hw.description || "");
    setNewHwDue(hw.dueDate || "");
    setIsHwDialogOpen(true);
  };

  const handleSaveHw = async () => {
    if (!newHwTask.trim() || !user) return;
    
    const finalSubject = isCustomSubject 
      ? (customSubjectName.trim() || 'Allgemein') 
      : (newHwSubject.trim() || 'Allgemein');

    if (editingHw && firestore) {
      const hwDocRef = doc(firestore, `groups/${groupId}/homeworks`, editingHw.id);
      updateDocumentNonBlocking(hwDocRef, {
        subject: finalSubject,
        task: newHwTask.trim(),
        description: newHwDescription.trim(),
        dueDate: newHwDue
      });
      toast({ title: "Hausaufgabe aktualisiert!" });
    } else if (homeworksRef) {
      const newHw = {
        subject: finalSubject,
        task: newHwTask.trim(),
        description: newHwDescription.trim(),
        dueDate: newHwDue,
        done: false,
        createdBy: user.uid,
        createdByName: user.displayName || user.email?.split('@')[0] || "Anonym",
        createdAt: Date.now()
      };
      addDocumentNonBlocking(homeworksRef, newHw);
      toast({ title: "Hausaufgabe geteilt!", description: `${finalSubject}: ${newHwTask}` });
    }
    setIsHwDialogOpen(false);
  };

  const handleDeleteHwConfirm = () => {
    if (!deletingHwId || !firestore) return;
    const hwDocRef = doc(firestore, `groups/${groupId}/homeworks`, deletingHwId);
    deleteDocumentNonBlocking(hwDocRef);
    toast({ title: "Hausaufgabe für die Gruppe gelöscht" });
    setDeletingHwId(null);
  };

  const handleImportSingle = (hw: GroupHomework) => {
    if (!firestore || !user) return;
    setImportingHwId(hw.id);
    const personalHwRef = collection(firestore, `users/${user.uid}/homeworks`);
    addDocumentNonBlocking(personalHwRef, {
      subject: hw.subject || 'Allgemein',
      task: hw.task,
      description: hw.description || '',
      dueDate: hw.dueDate,
      done: false,
      groupHwId: hw.id,
      createdBy: hw.createdBy,
      createdByName: hw.createdByName
    });
    toast({ 
      title: "In deinen Planer übernommen!", 
      description: `${hw.subject || 'Allgemein'}: ${hw.task}` 
    });
    setTimeout(() => setImportingHwId(null), 400);
  };

  const handleImportAllUnimported = () => {
    if (!firestore || !user || !groupHomeworks) return;
    setIsBatchImporting(true);
    const unimported = groupHomeworks.filter(hw => !importedGroupHwIds.has(hw.id));
    if (unimported.length === 0) {
      toast({ title: "Bereits alles synchronisiert!" });
      setIsBatchImporting(false);
      return;
    }
    const personalHwRef = collection(firestore, `users/${user.uid}/homeworks`);
    unimported.forEach(hw => {
      addDocumentNonBlocking(personalHwRef, {
        subject: hw.subject || 'Allgemein',
        task: hw.task,
        description: hw.description || '',
        dueDate: hw.dueDate,
        done: false,
        groupHwId: hw.id,
        createdBy: hw.createdBy,
        createdByName: hw.createdByName
      });
    });
    toast({ 
      title: `${unimported.length} Aufgaben importiert!`, 
      description: "Alle neuen Gruppen-Hausaufgaben wurden in deinen Planer übernommen." 
    });
    setIsBatchImporting(false);
  };

  const handleScanHomeworkImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningHw(true);
    toast({ title: "Analysiere Tafelbild / Foto...", description: "Gemini KI scannt die Hausaufgabe..." });

    const reader = new FileReader();
    reader.onload = async () => {
      const photoDataUri = reader.result as string;
      try {
        const res = await scanHomeworkImage(photoDataUri, 'German');
        if (res.tasks && res.tasks.length > 0) {
          if (res.tasks.length === 1) {
            const first = res.tasks[0];
            const foundSubj = first.subject || groupSubjects[0] || '';
            const inList = groupSubjects.includes(foundSubj);
            if (inList) {
              setNewHwSubject(foundSubj);
              setIsCustomSubject(false);
              setCustomSubjectName("");
            } else {
              setNewHwSubject("__custom__");
              setIsCustomSubject(true);
              setCustomSubjectName(foundSubj);
            }
            setNewHwTask(first.task || "");
            setNewHwDescription("");
            setNewHwDue(first.dueDate || "");
            setEditingHw(null);
            setIsHwDialogOpen(true);
            toast({ title: "Hausaufgabe erkannt!", description: "Überprüfe die Daten und teile sie mit der Klasse." });
          } else if (homeworksRef && user) {
            res.tasks.forEach(t => {
              addDocumentNonBlocking(homeworksRef, {
                subject: t.subject || 'Allgemein',
                task: t.task,
                description: '',
                dueDate: t.dueDate || '',
                done: false,
                createdBy: user.uid,
                createdByName: user.displayName || user.email?.split('@')[0] || "Anonym",
                createdAt: Date.now()
              });
            });
            toast({ 
              title: `${res.tasks.length} Hausaufgaben erkannt & geteilt!`, 
              description: "Alle erkannten Aufgaben wurden für die Gruppe hinzugefügt." 
            });
          }
        } else {
          toast({ 
            variant: "destructive", 
            title: "Keine Hausaufgabe erkannt", 
            description: res.error || "Bitte achte auf ein scharfes, gut ausgeleuchtetes Foto." 
          });
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Fehler beim Scannen" });
      } finally {
        setIsScanningHw(false);
        if (hwFileInputRef.current) hwFileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRoleChange = async (uid: string, newRole: GroupRole) => {
      if (!groupDocRef) return;
      try {
          await updateDoc(groupDocRef, {
              [`roles.${uid}`]: newRole
          });
          toast({ title: "Rolle aktualisiert" });
      } catch (e) {
          toast({ variant: 'destructive', title: "Fehler beim Aktualisieren der Rolle" });
      }
  }

  const handleRemoveMember = async (uid: string) => {
      if (!groupDocRef || !firestore) return;
      try {
          await updateDoc(groupDocRef, {
              members: arrayRemove(uid)
          });
          // Also clear groupId in the removed user's doc (best effort)
          const removedUserRef = doc(firestore, 'users', uid);
          await updateDoc(removedUserRef, { groupId: null });
          
          toast({ title: "Mitglied entfernt" });
          setMembers(prev => prev.filter(m => m.id !== uid));
      } catch (e) {
          toast({ variant: 'destructive', title: "Fehler beim Entfernen" });
      }
  }

  const isLoading = isUserLoading || isLoadingGroup || isLoadingMembers;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary w-12 h-12" /></div>;
  }
  
  if (!user || user.isAnonymous) {
    return null;
  }

  if (!group) {
    return (
      <div className="container mx-auto p-4 text-center">
        <Card className="max-w-md mx-auto">
            <CardHeader>
                <CardTitle>Gruppe nicht gefunden</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Diese Gruppe existiert nicht oder du hast keinen Zugriff.</p>
                <Button onClick={() => router.push('/')} className="mt-4 w-full">Zurück zum Dashboard</Button>
            </CardContent>
        </Card>
      </div>
    );
  }

  const userRole = (group.roles && group.roles[user.uid]) || 'nutzer';
  const isGroupAdmin = userRole === 'admin';
  const canEditTimetable = userRole === 'admin' || userRole === 'bearbeiter';
  const canManageHomework = userRole === 'admin' || userRole === 'bearbeiter' || userRole === 'berechtigt';

  const getRoleIcon = (role: GroupRole) => {
      switch(role) {
          case 'admin': return <ShieldAlert className="h-3 w-3 text-red-500" />;
          case 'bearbeiter': return <ShieldCheck className="h-3 w-3 text-blue-500" />;
          case 'berechtigt': return <Shield className="h-3 w-3 text-green-500" />;
          default: return <Shield className="h-3 w-3 text-muted-foreground" />;
      }
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl pb-24">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-4xl font-black tracking-tight">{group.name}</h1>
                    <div className="flex items-center gap-2 text-muted-foreground mt-1">
                        <GraduationCap className="h-4 w-4" />
                        <span>{group.schoolName}</span>
                    </div>
                </div>
            </div>
            <div className="flex flex-col items-end gap-1">
                <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>{group.members.length} Mitglieder</span>
                </Badge>
                <div className="flex items-center gap-1 text-[10px] uppercase font-black text-muted-foreground">
                    Deine Rolle: <span className="text-primary">{userRole}</span>
                </div>
            </div>
        </div>

        {group.motto && (
            <div className="bg-primary/5 border-l-4 border-primary p-4 rounded-r-lg mb-8 italic text-lg text-primary/80">
                "{group.motto}"
            </div>
        )}
      
      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="timetable">Stundenplan</TabsTrigger>
            <TabsTrigger value="homework">Hausaufgaben</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
            <div className="grid gap-8 md:grid-cols-2">
                <Card className="md:col-span-2 border-primary/20 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-primary" />
                            Gruppe teilen
                        </CardTitle>
                        <CardDescription>Lade deine Mitschüler mit diesem Link in die Gruppe ein.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative flex-1 w-full">
                            <Input readOnly value={inviteLink} className="pr-10 bg-secondary/30" />
                            <Users className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        </div>
                        <Button onClick={copyToClipboard} className="shrink-0 w-full sm:w-auto font-bold gap-2">
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            Link kopieren
                        </Button>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            Heute ({todayName})
                        </CardTitle>
                        <CardDescription>Die nächsten Stunden laut Gruppen-Plan.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-64 pr-4">
                            <div className="space-y-3">
                                {todaySchedule.length > 0 ? (
                                    todaySchedule
                                        .filter(e => e.fach && e.fach !== 'Pause')
                                        .map((entry, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-transparent hover:border-primary/20 transition-all">
                                            <div className="flex-1">
                                                <p className="font-bold text-lg">{entry.fach}</p>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {entry.start} - {entry.ende}</span>
                                                    {entry.room && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {entry.room}</span>}
                                                </div>
                                            </div>
                                            {entry.hauptfach && <Badge variant="default" className="text-[9px] uppercase font-black px-1.5 h-4">HF</Badge>}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-muted-foreground">
                                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p>Kein Unterricht am heutigen Tag.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            Mitglieder ({members.length})
                        </CardTitle>
                        <CardDescription>Hier siehst du, wer in der Gruppe ist.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-64 pr-4">
                            <div className="space-y-4">
                                {members.map((member) => {
                                    const mRole = (group.roles && group.roles[member.id]) || 'nutzer';
                                    return (
                                        <div key={member.id} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 border-2 border-background ring-2 ring-primary/5">
                                                    <AvatarImage src={member.settings?.profilePicture} />
                                                    <AvatarFallback className="bg-primary/10 text-primary"><User className="h-5 w-5" /></AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-bold text-sm leading-tight">{member.displayName || 'Anonymer Nutzer'}</p>
                                                    <div className="flex items-center gap-1 text-[9px] uppercase font-black text-muted-foreground mt-0.5">
                                                        {getRoleIcon(mRole)}
                                                        {mRole}
                                                    </div>
                                                </div>
                                            </div>
                                            {isGroupAdmin && member.id !== user.uid ? (
                                                <div className="flex items-center gap-2">
                                                    <Select value={mRole} onValueChange={(v: GroupRole) => handleRoleChange(member.id, v)}>
                                                        <SelectTrigger className="h-7 text-[10px] w-28 font-bold uppercase rounded-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="admin">Admin</SelectItem>
                                                            <SelectItem value="bearbeiter">Bearbeiter</SelectItem>
                                                            <SelectItem value="berechtigt">Berechtigt</SelectItem>
                                                            <SelectItem value="nutzer">Nutzer</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Mitglied entfernen?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Möchtest du {member.displayName || 'diesen Nutzer'} wirklich aus der Gruppe entfernen?
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleRemoveMember(member.id)} className="bg-destructive text-white">Entfernen</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            ) : (
                                                <div className="h-2 w-2 rounded-full bg-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="timetable" className="space-y-6">
            <Card className="shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            Gruppen-Stundenplan
                        </CardTitle>
                        <CardDescription>
                            Dieser Plan gilt für alle Gruppenmitglieder und synchronisiert sich mit verknüpften Accounts.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {group.timetableSettings?.isABWeekActive && (
                            <Tabs value={groupWeekTab} onValueChange={(v: any) => setGroupWeekTab(v)} className="h-9">
                                <TabsList className="bg-secondary/50 p-1">
                                    <TabsTrigger value="A" className="text-xs font-bold gap-1 h-7">
                                        <CalendarDays className="w-3.5 h-3.5"/> Woche A
                                    </TabsTrigger>
                                    <TabsTrigger value="B" className="text-xs font-bold gap-1 h-7">
                                        <RefreshCcw className="w-3.5 h-3.5"/> Woche B
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        )}
                        {canEditTimetable && (
                            <Button 
                                variant="outline" 
                                onClick={() => router.push(`/edit/timetable?groupId=${groupId}`)} 
                                className="font-bold gap-1.5"
                            >
                                <Pencil className="w-4 h-4" /> Plan bearbeiten
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {hasAnyEntries ? (
                        <div className="overflow-x-auto rounded-lg border">
                            <Table className="min-w-[700px] md:min-w-full">
                                <TableHeader>
                                    <TableRow className="bg-secondary/30">
                                        <TableHead className="border-r w-[120px] font-bold">Stunde</TableHead>
                                        {weekDays.map(day => (
                                            <TableHead key={day} className="text-center border-r font-bold">
                                                {day}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visibleTimeSlots.map((slot, slotIndex) => (
                                        <TableRow key={slotIndex} className="hover:bg-muted/10">
                                            <TableCell className="font-medium border-r align-top bg-secondary/10">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-xs">{slotIndex + 1}. Std</span>
                                                    <span className="text-[10px] text-muted-foreground">{slot.start} - {slot.ende}</span>
                                                </div>
                                            </TableCell>
                                            {weekDays.map(day => {
                                                const daySchedule = processedTimetable[day];
                                                const entry = daySchedule?.find(e => e.originalIndex === slotIndex);
                                                if (!entry || entry.isContinuation) return null;

                                                const isFilled = entry.fach && entry.fach.trim() !== '' && entry.fach !== 'Pause';

                                                return (
                                                    <TableCell 
                                                        key={`${day}-${slotIndex}`} 
                                                        className={cn(
                                                            "text-center border-r p-2.5 align-top transition-colors",
                                                            isFilled && "bg-card"
                                                        )} 
                                                        rowSpan={entry.rowspan}
                                                    >
                                                        {isFilled ? (
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                                    <p className="font-bold text-sm text-foreground">{entry.fach}</p>
                                                                    {entry.hauptfach && (
                                                                        <Badge variant="default" className="text-[9px] uppercase font-bold px-1.5 h-4">
                                                                            HF
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="text-[11px] text-muted-foreground space-y-0.5">
                                                                    {entry.lehrer && (
                                                                        <div className="flex items-center justify-center gap-1">
                                                                            <User className="w-3 h-3 opacity-70" />
                                                                            <span>{entry.lehrer}</span>
                                                                        </div>
                                                                    )}
                                                                    {entry.room && (
                                                                        <div className="flex items-center justify-center gap-1">
                                                                            <MapPin className="w-3 h-3 opacity-70" />
                                                                            <span>{entry.room}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground opacity-20">-</span>
                                                        )}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="p-10 text-center bg-secondary/30 rounded-2xl border-2 border-dashed">
                            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-lg font-bold mb-1">Noch kein Stundenplan eingetragen</p>
                            <p className="text-muted-foreground max-w-sm mx-auto text-sm mb-5">
                                Für diese Gruppe wurde bisher noch kein Stundenplan hinterlegt.
                            </p>
                            {canEditTimetable && (
                                <Button 
                                    onClick={() => router.push(`/edit/timetable?groupId=${groupId}`)} 
                                    className="font-bold"
                                >
                                    <Plus className="mr-2 h-4 w-4" /> Jetzt Stundenplan anlegen
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="homework" className="space-y-6">
            {/* Summary & Stats Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-accent/20 bg-accent/5 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Geteilte Aufgaben</p>
                            <p className="text-3xl font-black text-accent mt-0.5">{groupHomeworks?.length || 0}</p>
                        </div>
                        <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                            <ListChecks className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Demnächst fällig</p>
                            <p className="text-3xl font-black text-foreground mt-0.5">{dueThisWeekCount}</p>
                        </div>
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                            <Clock className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">In deinem Planer</p>
                            <p className="text-3xl font-black text-foreground mt-0.5">
                                {importedGroupHwIds.size} <span className="text-sm font-medium text-muted-foreground">/ {groupHomeworks?.length || 0}</span>
                            </p>
                        </div>
                        <div className="p-3 bg-green-500/10 rounded-2xl text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick sync reminder if there are unimported tasks */}
            {unimportedCount > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-accent/15 via-accent/5 to-transparent border border-accent/20 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent text-white rounded-xl shadow-sm">
                            <FolderSync className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <p className="font-bold text-sm">
                                {unimportedCount} neue {unimportedCount === 1 ? 'Aufgabe' : 'Aufgaben'} noch nicht in deinem Planer
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Übernehme sie mit einem Klick in deine persönliche Aufgabenliste.
                            </p>
                        </div>
                    </div>
                    <Button 
                        size="sm" 
                        onClick={handleImportAllUnimported} 
                        disabled={isBatchImporting}
                        className="bg-accent hover:bg-accent/90 text-white font-bold rounded-xl gap-2 w-full sm:w-auto shrink-0 shadow-sm"
                    >
                        {isBatchImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Alle {unimportedCount} importieren
                    </Button>
                </div>
            )}

            {/* Main Homework Management Card */}
            <Card className="shadow-sm border-border">
                <CardHeader className="pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-2xl font-black">
                                <ListChecks className="h-6 w-6 text-accent" />
                                Gemeinsame Hausaufgaben
                            </CardTitle>
                            <CardDescription>
                                Aufgaben, die von Mitgliedern für die ganze Klasse geteilt wurden.
                            </CardDescription>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <input 
                                type="file" 
                                ref={hwFileInputRef} 
                                onChange={handleScanHomeworkImage} 
                                accept="image/*" 
                                capture="environment" 
                                className="hidden" 
                            />
                            {canManageHomework && (
                                <Button 
                                    variant="outline" 
                                    onClick={() => hwFileInputRef.current?.click()} 
                                    disabled={isScanningHw}
                                    className="font-bold gap-2 rounded-xl border-accent/30 hover:border-accent hover:bg-accent/5"
                                >
                                    {isScanningHw ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin text-accent" />
                                            <span>Scannt Bild...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Camera className="w-4 h-4 text-accent" />
                                            <span>Foto scannen</span>
                                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-accent/15 text-accent font-black">KI</Badge>
                                        </>
                                    )}
                                </Button>
                            )}

                            {canManageHomework && (
                                <Button 
                                    onClick={handleOpenAddHwDialog} 
                                    className="bg-accent hover:bg-accent/90 text-white font-bold rounded-xl gap-2 shadow-sm"
                                >
                                    <Plus className="h-4 w-4" /> Aufgabe teilen
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Filter & Search Toolbar */}
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-4 border-t mt-4">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
                            {/* Search Input */}
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Fach, Aufgabe oder Mitschüler suchen..." 
                                    value={hwSearchQuery} 
                                    onChange={e => setHwSearchQuery(e.target.value)} 
                                    className="pl-9 bg-secondary/30 rounded-xl h-9 text-sm"
                                />
                                {hwSearchQuery && (
                                    <button 
                                        onClick={() => setHwSearchQuery("")} 
                                        className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground font-bold"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Subject Filter Select */}
                            <Select value={hwSubjectFilter} onValueChange={setHwSubjectFilter}>
                                <SelectTrigger className="h-9 rounded-xl w-full sm:w-44 text-xs font-bold bg-secondary/30">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <SelectValue placeholder="Alle Fächer" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Alle Fächer ({groupHomeworks?.length || 0})</SelectItem>
                                    {groupSubjects.map(subj => {
                                        const count = groupHomeworks?.filter(h => h.subject === subj).length || 0;
                                        return (
                                            <SelectItem key={subj} value={subj}>
                                                {subj} {count > 0 ? `(${count})` : ''}
                                            </SelectItem>
                                        );
                                    })}
                                    {groupHomeworks?.some(h => !groupSubjects.includes(h.subject)) && (
                                        <SelectItem value="Allgemein">Allgemein / Sonstige</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Status Pills & View Mode Switcher */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                            <div className="flex items-center bg-secondary/40 p-1 rounded-xl gap-1">
                                <Button 
                                    size="sm" 
                                    variant={hwDateFilter === 'all' ? 'default' : 'ghost'} 
                                    onClick={() => setHwDateFilter('all')} 
                                    className="h-7 text-xs font-bold px-2.5 rounded-lg"
                                >
                                    Alle
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant={hwDateFilter === 'upcoming' ? 'default' : 'ghost'} 
                                    onClick={() => setHwDateFilter('upcoming')} 
                                    className="h-7 text-xs font-bold px-2.5 rounded-lg"
                                >
                                    Demnächst
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant={hwDateFilter === 'mine' ? 'default' : 'ghost'} 
                                    onClick={() => setHwDateFilter('mine')} 
                                    className="h-7 text-xs font-bold px-2.5 rounded-lg"
                                >
                                    Von mir
                                </Button>
                            </div>

                            {/* View Mode (Subject vs Timeline) */}
                            <div className="flex items-center bg-secondary/40 p-1 rounded-xl gap-1">
                                <Button 
                                    size="sm" 
                                    variant={hwViewMode === 'subject' ? 'default' : 'ghost'} 
                                    onClick={() => setHwViewMode('subject')} 
                                    className="h-7 text-xs font-bold px-2.5 rounded-lg gap-1.5"
                                    title="Nach Fach gruppieren"
                                >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Fach</span>
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant={hwViewMode === 'timeline' ? 'default' : 'ghost'} 
                                    onClick={() => setHwViewMode('timeline')} 
                                    className="h-7 text-xs font-bold px-2.5 rounded-lg gap-1.5"
                                    title="Nach Datum sortieren"
                                >
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Zeitstrahl</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-2">
                    {/* Empty State when no tasks exist at all */}
                    {(!groupHomeworks || groupHomeworks.length === 0) && (
                        <div className="text-center py-16 px-4 bg-secondary/20 rounded-3xl border-2 border-dashed my-4">
                            <div className="w-16 h-16 rounded-3xl bg-accent/10 flex items-center justify-center mx-auto mb-4 text-accent">
                                <ListChecks className="w-8 h-8" />
                            </div>
                            <h3 className="font-black text-xl mb-1">Noch keine gemeinsamen Hausaufgaben</h3>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                                Teile Aufgaben für die Klasse oder fotografiere das Tafelbild ab – alle Gruppenmitglieder können die Aufgaben direkt in ihren Planer übernehmen.
                            </p>
                            {canManageHomework && (
                                <div className="flex items-center justify-center gap-3 flex-wrap">
                                    <Button 
                                        onClick={handleOpenAddHwDialog} 
                                        className="bg-accent hover:bg-accent/90 text-white font-bold rounded-xl gap-2 shadow-sm"
                                    >
                                        <Plus className="w-4 h-4" /> Erste Aufgabe teilen
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => hwFileInputRef.current?.click()} 
                                        className="font-bold rounded-xl gap-2"
                                    >
                                        <Camera className="w-4 h-4 text-accent" /> Foto scannen
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Filtered Empty State */}
                    {groupHomeworks && groupHomeworks.length > 0 && filteredHomeworks.length === 0 && (
                        <div className="text-center py-12 bg-secondary/20 rounded-2xl border my-4">
                            <Search className="w-8 h-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
                            <p className="font-bold text-base mb-1">Keine Aufgaben für diesen Filter gefunden</p>
                            <p className="text-xs text-muted-foreground mb-4">Passe deine Suchbegriffe oder Filtereinstellungen an.</p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => { setHwSearchQuery(""); setHwSubjectFilter("all"); setHwDateFilter("all"); }}
                                className="font-bold rounded-xl"
                            >
                                Filter zurücksetzen
                            </Button>
                        </div>
                    )}

                    {/* VIEW 1: Grouped by Subject */}
                    {hwViewMode === 'subject' && groupedBySubject.length > 0 && (
                        <div className="space-y-6">
                            {groupedBySubject.map(([subject, tasks]) => (
                                <div key={subject} className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                                            <h3 className="font-black text-base uppercase tracking-tight text-foreground flex items-center gap-2">
                                                {subject}
                                            </h3>
                                            <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 rounded-md">
                                                {tasks.length} {tasks.length === 1 ? 'Aufgabe' : 'Aufgaben'}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="grid gap-3">
                                        {tasks.map(hw => {
                                            const isImported = importedGroupHwIds.has(hw.id);
                                            const dueBadge = getDueDateBadgeInfo(hw.dueDate);
                                            const canEdit = canManageHomework || hw.createdBy === user.uid;

                                            return (
                                                <div 
                                                    key={hw.id} 
                                                    className={cn(
                                                        "flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-secondary/40 border hover:border-accent/40 hover:bg-secondary/60 hover:shadow-sm transition-all gap-4 group",
                                                        isImported && "border-green-500/20 bg-green-500/5 hover:border-green-500/30"
                                                    )}
                                                >
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Badge className={cn("text-[11px] font-bold border px-2.5 py-0.5 rounded-lg", dueBadge.color)}>
                                                                <Clock className="w-3 h-3 mr-1 inline" />
                                                                {dueBadge.text}
                                                            </Badge>
                                                            {isImported && (
                                                                <Badge variant="outline" className="text-[10px] font-bold text-green-600 bg-green-500/10 border-green-500/30">
                                                                    <Check className="w-3 h-3 mr-1" /> Im Planer
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        <div>
                                                            <p className="font-bold text-lg text-foreground leading-snug">
                                                                {hw.task}
                                                            </p>
                                                            {hw.description && (
                                                                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line bg-background/50 p-2 rounded-xl border border-border/50">
                                                                    {hw.description}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                            <User className="h-3 w-3 text-accent" />
                                                            <span>Geteilt von {hw.createdByName || 'Anonym'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Card Actions */}
                                                    <div className="flex items-center gap-2 justify-end sm:justify-start shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                                                        {canEdit && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => handleOpenEditHwDialog(hw)} 
                                                                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                                                                title="Aufgabe bearbeiten"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        {canEdit && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => setDeletingHwId(hw.id)} 
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                                                                title="Aufgabe löschen"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}

                                                        {isImported ? (
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                disabled 
                                                                className="text-xs font-bold rounded-xl text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10 h-8 gap-1.5"
                                                            >
                                                                <Check className="w-3.5 h-3.5" /> Hinzugefügt
                                                            </Button>
                                                        ) : (
                                                            <Button 
                                                                variant="secondary" 
                                                                size="sm" 
                                                                onClick={() => handleImportSingle(hw)} 
                                                                disabled={importingHwId === hw.id}
                                                                className="font-bold text-xs rounded-xl h-8 gap-1.5 hover:bg-accent hover:text-white transition-all shadow-sm"
                                                            >
                                                                {importingHwId === hw.id ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <Plus className="w-3.5 h-3.5" />
                                                                )}
                                                                In meinen Planer
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* VIEW 2: Timeline View */}
                    {hwViewMode === 'timeline' && groupedByTimeline.length > 0 && (
                        <div className="space-y-6">
                            {groupedByTimeline.map(bucket => (
                                <div key={bucket.key} className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <Badge variant="outline" className="font-bold text-xs px-2.5 py-1 rounded-lg">
                                            {bucket.label} ({bucket.items.length})
                                        </Badge>
                                    </div>

                                    <div className="grid gap-3">
                                        {bucket.items.map(hw => {
                                            const isImported = importedGroupHwIds.has(hw.id);
                                            const dueBadge = getDueDateBadgeInfo(hw.dueDate);
                                            const canEdit = canManageHomework || hw.createdBy === user.uid;

                                            return (
                                                <div 
                                                    key={hw.id} 
                                                    className={cn(
                                                        "flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-secondary/40 border hover:border-accent/40 hover:bg-secondary/60 hover:shadow-sm transition-all gap-4 group",
                                                        isImported && "border-green-500/20 bg-green-500/5 hover:border-green-500/30"
                                                    )}
                                                >
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Badge className="bg-accent/15 text-accent border-accent/20 font-bold text-[11px] px-2.5 py-0.5 rounded-lg">
                                                                {hw.subject || 'Allgemein'}
                                                            </Badge>
                                                            <Badge className={cn("text-[11px] font-bold border px-2.5 py-0.5 rounded-lg", dueBadge.color)}>
                                                                <Clock className="w-3 h-3 mr-1 inline" />
                                                                {dueBadge.text}
                                                            </Badge>
                                                            {isImported && (
                                                                <Badge variant="outline" className="text-[10px] font-bold text-green-600 bg-green-500/10 border-green-500/30">
                                                                    <Check className="w-3 h-3 mr-1" /> Im Planer
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        <div>
                                                            <p className="font-bold text-lg text-foreground leading-snug">
                                                                {hw.task}
                                                            </p>
                                                            {hw.description && (
                                                                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line bg-background/50 p-2 rounded-xl border border-border/50">
                                                                    {hw.description}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                            <User className="h-3 w-3 text-accent" />
                                                            <span>Geteilt von {hw.createdByName || 'Anonym'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Card Actions */}
                                                    <div className="flex items-center gap-2 justify-end sm:justify-start shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                                                        {canEdit && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => handleOpenEditHwDialog(hw)} 
                                                                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                                                                title="Aufgabe bearbeiten"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        {canEdit && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => setDeletingHwId(hw.id)} 
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                                                                title="Aufgabe löschen"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}

                                                        {isImported ? (
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                disabled 
                                                                className="text-xs font-bold rounded-xl text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10 h-8 gap-1.5"
                                                            >
                                                                <Check className="w-3.5 h-3.5" /> Hinzugefügt
                                                            </Button>
                                                        ) : (
                                                            <Button 
                                                                variant="secondary" 
                                                                size="sm" 
                                                                onClick={() => handleImportSingle(hw)} 
                                                                disabled={importingHwId === hw.id}
                                                                className="font-bold text-xs rounded-xl h-8 gap-1.5 hover:bg-accent hover:text-white transition-all shadow-sm"
                                                            >
                                                                {importingHwId === hw.id ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <Plus className="w-3.5 h-3.5" />
                                                                )}
                                                                In meinen Planer
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add / Edit Homework Dialog */}
            <Dialog open={isHwDialogOpen} onOpenChange={setIsHwDialogOpen}>
                <DialogContent className="sm:max-w-lg rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-black">
                            <ListChecks className="w-5 h-5 text-accent" />
                            {editingHw ? "Hausaufgabe bearbeiten" : "Hausaufgabe für die Gruppe teilen"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingHw 
                                ? "Ändere die Details dieser geteilten Aufgabe."
                                : "Diese Aufgabe wird für alle Gruppenmitglieder sichtbar und synchronisierbar."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-3">
                        {/* Subject Selector */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider">Fach</Label>
                            {groupSubjects.length > 0 && !isCustomSubject ? (
                                <div className="space-y-2">
                                    <Select 
                                        value={newHwSubject} 
                                        onValueChange={(val) => {
                                            if (val === "__custom__") {
                                                setIsCustomSubject(true);
                                            } else {
                                                setNewHwSubject(val);
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="rounded-xl font-bold bg-secondary/30">
                                            <SelectValue placeholder="Fach auswählen" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Allgemein">Allgemein</SelectItem>
                                            {groupSubjects.filter(s => s !== "Allgemein").map(s => (
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
                                        value={isCustomSubject ? customSubjectName : newHwSubject} 
                                        onChange={e => {
                                            if (isCustomSubject) setCustomSubjectName(e.target.value);
                                            else setNewHwSubject(e.target.value);
                                        }}
                                        className="rounded-xl font-medium bg-secondary/30"
                                    />
                                    {groupSubjects.length > 0 && isCustomSubject && (
                                        <Button 
                                            type="button" 
                                            variant="link" 
                                            size="sm" 
                                            onClick={() => { setIsCustomSubject(false); setNewHwSubject(groupSubjects[0] || ""); }}
                                            className="text-xs h-auto p-0 text-accent font-bold"
                                        >
                                            ← Aus Stundenplan-Fächern wählen
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Task Title */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider">Aufgabe *</Label>
                            <Input 
                                placeholder="z.B. Buch S. 42 Nr. 3 a, b und 4" 
                                value={newHwTask} 
                                onChange={e => setNewHwTask(e.target.value)} 
                                className="rounded-xl font-bold bg-secondary/30 text-base"
                            />
                        </div>

                        {/* Description / Subtasks */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider">Zusatzinfos / Details (optional)</Label>
                            <Textarea 
                                placeholder="z.B. Nur ins Heft schreiben, Vokabeln auf S. 120 mitlernen..." 
                                value={newHwDescription} 
                                onChange={e => setNewHwDescription(e.target.value)} 
                                rows={3}
                                className="rounded-xl bg-secondary/30 text-sm resize-none"
                            />
                        </div>

                        {/* Due Date with Quick Presets */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wider">Fälligkeitsdatum</Label>
                            <Input 
                                type="date" 
                                value={newHwDue} 
                                onChange={e => setNewHwDue(e.target.value)} 
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
                                        setNewHwDue(d.toISOString().split('T')[0]);
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
                                        setNewHwDue(d.toISOString().split('T')[0]);
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
                                        setNewHwDue(d.toISOString().split('T')[0]);
                                    }}
                                    className="h-6 text-[10px] font-bold px-2 rounded-lg"
                                >
                                    Nächste Woche
                                </Button>
                                {newHwDue && (
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => setNewHwDue("")} 
                                        className="h-6 text-[10px] text-muted-foreground px-2 rounded-lg"
                                    >
                                        Zurücksetzen
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsHwDialogOpen(false)} className="rounded-xl font-bold">
                            Abbrechen
                        </Button>
                        <Button 
                            onClick={handleSaveHw} 
                            disabled={!newHwTask.trim()} 
                            className="bg-accent hover:bg-accent/90 text-white font-bold rounded-xl shadow-sm"
                        >
                            {editingHw ? "Speichern" : "Jetzt teilen"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Homework Confirmation Dialog */}
            <AlertDialog open={!!deletingHwId} onOpenChange={(open) => !open && setDeletingHwId(null)}>
                <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                            Hausaufgabe für alle löschen?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Diese Hausaufgabe wird unwiderruflich aus der Gruppenliste entfernt. Mitglieder, die diese Aufgabe bereits in ihren persönlichen Planer kopiert haben, behalten ihre eigene Kopie.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl font-bold">Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteHwConfirm} className="bg-destructive text-white rounded-xl font-bold">
                            Endgültig löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
