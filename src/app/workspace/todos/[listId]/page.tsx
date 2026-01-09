'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Save, Check, MoreHorizontal, Trash2, Plus, Settings, Star, Calendar as CalendarIcon, Pencil, ArrowUp, ArrowDown, GripVertical, RefreshCw } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';


type Task = {
  id: string;
  text: string;
  done: boolean;
  dueDate?: string;
  priority?: number;
  note?: string;
  subtasks?: Task[];
  group?: string; // Group ID
  homeworkId?: string; // Reference to the original homework item
};

type Homework = {
  id: string;
  task: string;
  subject: string;
  done: boolean;
}

type Group = {
    id: string;
    name: string;
    color: string;
};

type ListSettings = {
    advancedMode?: boolean;
    enableSubtasks?: boolean;
    enableGroups?: boolean;
    enableColorGroups?: boolean;
    sortBy?: 'default' | 'dueDate' | 'priority' | 'alphabetical';
    weeklyReset?: boolean;
    enableNumericPriority?: boolean;
    groups?: Group[];
    syncHomework?: boolean;
}

type TodoList = {
  title: string;
  tasks: Task[];
  settings?: ListSettings;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
  updatedAt: {
    seconds: number;
    nanoseconds: number;
  };
  ownerId: string;
};

type SaveStatus = 'idle' | 'dirty' | 'saving';

const generateColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 75%)`;
}

const HOMEWORK_SYNC_TASK_ID = 'system-homework-sync';

export default function TodoListPage() {
  const router = useRouter();
  const params = useParams();
  const { listId } = params;
  const isNewList = listId === 'new';

  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  
  const [title, setTitle] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<ListSettings>({ groups: [] });

  const [newTaskText, setNewTaskText] = useState('');
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false);


  const listDocRef = useMemoFirebase(() => 
    !isNewList && user && typeof listId === 'string'
      ? doc(firestore, `users/${user.uid}/todoLists`, listId)
      : null
  , [firestore, user, listId, isNewList]);

  const { data: todoList, isLoading: isLoadingList } = useDoc<TodoList>(listDocRef);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

   const homeworksRef = useMemoFirebase(() => 
    user ? collection(firestore, `users/${user.uid}/homeworks`) : null
  , [firestore, user]);

  const { data: homeworks } = useCollection<Omit<Homework, 'id'>>(homeworksRef);

  
  useEffect(() => {
    if (todoList) {
      setTitle(todoList.title);
      setTasks(todoList.tasks || []);
      setSettings(todoList.settings || { groups: [] });
      setSaveStatus('idle');
    }
  }, [todoList]);

    const handleSave = useCallback(async () => {
    if (!firestore || !user || !title.trim()) {
        return;
    };
    setSaveStatus('saving');

    try {
        if (isNewList) {
            const listsColRef = collection(firestore, `users/${user.uid}/todoLists`);
            const newDocRef = await addDoc(listsColRef, {
                title: title,
                tasks: tasks,
                settings: settings,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            router.replace(`/workspace/todos/${newDocRef.id}`);

        } else {
            if (!listDocRef) return;
            await setDoc(listDocRef, {
                title: title,
                tasks: tasks,
                settings: settings,
                updatedAt: serverTimestamp(),
            }, { merge: true });
        }
        setSaveStatus('idle');

    } catch (error) {
        setSaveStatus('dirty');
    }
  }, [firestore, user, title, tasks, settings, isNewList, listDocRef, router]);


  useEffect(() => {
    if (isLoadingList || (todoList && title === todoList.title && JSON.stringify(tasks) === JSON.stringify(todoList.tasks) && JSON.stringify(settings) === JSON.stringify(todoList.settings))) {
      return;
    }

    if (title.trim() || tasks.length > 0) {
        setSaveStatus('dirty');
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
            handleSave();
        }, 1500);
    }

    return () => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
    };
  }, [title, tasks, settings, todoList, isLoadingList, handleSave]);


  const handleDelete = async () => {
    if (isNewList || !listDocRef) return;
    await deleteDoc(listDocRef);
    toast({
      title: "Liste gelöscht!",
      description: `Die To-Do-Liste "${todoList?.title}" wurde entfernt.`,
    });
    router.push('/workspace');
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskText.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        text: newTaskText.trim(),
        done: false,
      };
      setTasks(prev => [...prev, newTask]);
      setNewTaskText('');
    }
  };

  const handleOpenEditDialog = (task: Task) => {
    setEditingTask(task);
    setIsEditTaskDialogOpen(true);
  }

  const handleOpenNewTaskDialog = () => {
    const tempTask: Task = {
        id: 'new',
        text: newTaskText,
        done: false
    };
    setEditingTask(tempTask);
    setIsEditTaskDialogOpen(true);
  }


  const handleSaveTaskDetails = (updatedTask: Task) => {
      if(updatedTask.id === 'new') {
          // This is a new task from the detailed edit sheet
          setTasks(prev => [...prev, { ...updatedTask, id: Date.now().toString() }]);
          setNewTaskText(''); // Clear input after adding
      } else {
          // This is an update to an existing task
          setTasks(prev => prev.map(task => task.id === updatedTask.id ? updatedTask : task));
      }
      setIsEditTaskDialogOpen(false);
      setEditingTask(null);
  }

  const toggleTaskDone = (taskId: string, subtaskId?: string) => {
    let homeworkIdToUpdate: string | undefined;

    setTasks(prevTasks =>
        prevTasks.map(task => {
            if (task.id === taskId) {
                if (subtaskId) {
                    const updatedSubtasks = (task.subtasks || []).map(sub => {
                        if (sub.id === subtaskId) {
                             if (!sub.done) { // Only update if marking as done
                                homeworkIdToUpdate = sub.homeworkId;
                            }
                            return { ...sub, done: !sub.done };
                        }
                        return sub;
                    });
                    return { ...task, subtasks: updatedSubtasks };
                } else {
                     if (!task.done) { // Only update if marking as done
                        homeworkIdToUpdate = task.homeworkId;
                    }
                    return { ...task, done: !task.done };
                }
            }
            return task;
        })
    );

    if (homeworkIdToUpdate && firestore && user) {
        const homeworkDocRef = doc(firestore, `users/${user.uid}/homeworks`, homeworkIdToUpdate);
        updateDoc(homeworkDocRef, { done: true, completedAt: Date.now() });
    }
  };


  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };
  
  const handleSettingChange = (key: keyof ListSettings, value: any) => {
    setSettings(prev => {
        let newSettings = {...prev, [key]: value};
        
        if (key === 'advancedMode' && !value) {
            newSettings.enableSubtasks = false;
            newSettings.enableGroups = false;
            newSettings.enableNumericPriority = false;
            newSettings.syncHomework = false;
        }
        if (key === 'enableGroups' && value && !newSettings.groups) {
            newSettings.groups = [];
        }

        if (key === 'enableNumericPriority' && !value) {
             const updatedTasks = tasks.map(task => ({
                ...task,
                priority: (task.priority && task.priority > 3) ? 3 : task.priority,
            }));
            setTasks(updatedTasks);
        }

        return newSettings;
    });
  }

  const getFormattedDate = (timestamp: TodoList['updatedAt'] | undefined) => {
    if (!timestamp) return '';
    const date = new Date(timestamp.seconds * 1000);
    return formatDistanceToNow(date, { addSuffix: true, locale: de });
  };

  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saving':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'idle':
        return <Check className="h-4 w-4" />;
      case 'dirty':
      default:
        return <Save className="h-4 w-4" />;
    }
  };
  
    const getGroupById = (groupId?: string) => {
        if (!groupId || !settings.groups) return null;
        return settings.groups.find(g => g.id === groupId);
    }
    
    const runHomeworkSync = (): string => {
        if (!settings.syncHomework || !homeworks) {
            return 'Sync nicht möglich: Hausaufgaben konnten nicht geladen werden oder die Funktion ist deaktiviert.';
        }
    
        const incompleteHomeworks = homeworks.filter(hw => !hw.done);
    
        if (settings.enableSubtasks) {
            const homeworkSubtasks: Task[] = incompleteHomeworks.map(hw => ({
                id: `hw-${hw.id}`,
                text: `${hw.subject || 'Hausaufgabe'}: ${hw.task}`,
                done: false,
                homeworkId: hw.id
            }));

            setTasks(currentTasks => {
                const newTasks = [...currentTasks];
                const existingTaskIndex = newTasks.findIndex(t => t.id === HOMEWORK_SYNC_TASK_ID);
    
                if (incompleteHomeworks.length === 0) {
                    if (existingTaskIndex > -1) {
                        newTasks.splice(existingTaskIndex, 1);
                    }
                } else {
                    const newSyncTask: Task = {
                        id: HOMEWORK_SYNC_TASK_ID,
                        text: "Hausaufgaben",
                        done: false,
                        subtasks: homeworkSubtasks,
                    };
                    if (existingTaskIndex > -1) {
                        newTasks[existingTaskIndex] = newSyncTask;
                    } else {
                        newTasks.unshift(newSyncTask);
                    }
                }
                return newTasks;
            });

             if (incompleteHomeworks.length === 0) {
                 return 'Keine offenen Hausaufgaben gefunden.';
             } else {
                 return `Hausaufgaben synchronisiert! ${incompleteHomeworks.length} unerledigte Aufgaben gefunden.`;
             }

        } else {
            const nonHomeworkTasks = tasks.filter(t => !t.homeworkId);
                
            const newHomeworkTasks: Task[] = incompleteHomeworks.map(hw => ({
                id: `hw-${hw.id}`,
                text: `HA: ${hw.subject || ''} - ${hw.task}`,
                done: false,
                homeworkId: hw.id,
            }));

            setTasks([...nonHomeworkTasks, ...newHomeworkTasks]);

            if (newHomeworkTasks.length > 0) {
                return `Hausaufgaben synchronisiert! ${newHomeworkTasks.length} Aufgaben wurden hinzugefügt.`;
            } else {
                return 'Keine offenen Hausaufgaben gefunden.';
            }
        }
    };


  const isLoading = isUserLoading || isLoadingList;

  if (isLoading && !isNewList) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }
  
  if (!isUserLoading && (!user || user.isAnonymous)) {
    router.push('/login');
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl">
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liste wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Bist du sicher, dass du "{todoList?.title}" löschen möchtest?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {editingTask && (
        <Dialog open={isEditTaskDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingTask(null); setIsEditTaskDialogOpen(isOpen);}}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{editingTask.id === 'new' ? 'Neue Aufgabe erstellen' : 'Aufgabe bearbeiten'}</DialogTitle>
                    {editingTask.id !== 'new' && <DialogDescription>{editingTask.text}</DialogDescription>}
                </DialogHeader>
                <TaskEditForm 
                    task={editingTask} 
                    onSave={handleSaveTaskDetails} 
                    onCancel={() => setIsEditTaskDialogOpen(false)}
                    settings={settings}
                />
            </DialogContent>
        </Dialog>
      )}


      <Sheet open={isSettingsSheetOpen} onOpenChange={setIsSettingsSheetOpen}>
        <SheetContent className="flex flex-col">
            <SheetHeader>
                <SheetTitle>Listen-Einstellungen</SheetTitle>
                <SheetDescription>Verwalte die Einstellungen für deine To-Do-Liste "{title}".</SheetDescription>
            </SheetHeader>
            <SettingsForm 
                settings={settings} 
                onSettingChange={handleSettingChange} 
                onDelete={handleDelete} 
                isNewList={isNewList} 
                closeSheet={() => setIsSettingsSheetOpen(false)}
                onSyncHomeworks={runHomeworkSync}
            />
        </SheetContent>
      </Sheet>

      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Input 
          placeholder="Titel der To-Do-Liste"
          className="text-3xl font-bold border-0 shadow-none focus-visible:ring-0 px-0 h-auto flex-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex items-center justify-center h-6 gap-2 text-sm text-muted-foreground">
          <span>{getFormattedDate(todoList?.updatedAt)}</span>
          {renderSaveStatus()}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={handleSave} disabled={saveStatus !== 'dirty'}>
                <Save className="mr-2 h-4 w-4" />
                <span>Jetzt speichern</span>
            </DropdownMenuItem>
             <DropdownMenuItem onClick={() => setIsSettingsSheetOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Einstellungen</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} disabled={isNewList} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Löschen</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="space-y-4">
        <form onSubmit={handleAddTask}>
            <div className="flex w-full items-center space-x-2">
                <Input 
                    placeholder="Neue Aufgabe hinzufügen..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    className="flex-1"
                />
                 <Button type="submit" size="icon">
                    <Plus className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={handleOpenNewTaskDialog}>
                    <Pencil className="h-4 w-4" />
                </Button>
            </div>
        </form>


        <div className="space-y-2">
            {tasks.map(task => (
                <div key={task.id} className="p-3 bg-secondary rounded-md">
                    <div className="flex items-start gap-3">
                        <Checkbox 
                            id={`task-${task.id}`}
                            className="mt-1"
                            checked={task.done}
                            onCheckedChange={() => toggleTaskDone(task.id)}
                            disabled={task.id === HOMEWORK_SYNC_TASK_ID && (task.subtasks || []).every(st => st.done)}
                        />
                        <div className="flex-1">
                            <label htmlFor={`task-${task.id}`} className={`text-sm ${task.done ? 'line-through text-muted-foreground' : ''}`}>{task.text}</label>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                               {task.dueDate && (
                                   <div className="flex items-center gap-1">
                                       <CalendarIcon className="w-3 h-3" />
                                       <span>{format(new Date(task.dueDate), 'd. MMM', {locale: de})}</span>
                                   </div>
                               )}
                               {settings.enableNumericPriority && task.priority ? (
                                    <Badge variant="outline" className="text-xs">
                                        P: {task.priority}
                                    </Badge>
                                ) : task.priority ? (
                                   <div className="flex items-center gap-0.5">
                                       {[...Array(task.priority)].map((_, i) => (
                                            <Button key={i} variant="ghost" className="p-0 h-auto cursor-default">
                                                <Star className={`w-3 h-3 text-amber-400 fill-amber-400`} />
                                            </Button>
                                       ))}
                                   </div>
                               ) : null}
                               {task.group && getGroupById(task.group) && (
                                    <Badge style={{ backgroundColor: getGroupById(task.group)?.color }} className={cn("text-xs font-medium")}>
                                        {getGroupById(task.group)?.name}
                                    </Badge>
                               )}
                            </div>
                             {task.note && (
                                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-background whitespace-pre-wrap">{task.note}</p>
                             )}
                            
                            {settings.enableSubtasks && task.subtasks && task.subtasks.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-background/50 space-y-2">
                                    {task.subtasks.map((subtask, index) => (
                                        <div key={subtask.id} className="flex items-center gap-2">
                                            <Checkbox 
                                                id={`subtask-${subtask.id}`}
                                                checked={subtask.done}
                                                onCheckedChange={() => toggleTaskDone(task.id, subtask.id)}
                                                className="w-3.5 h-3.5"
                                            />
                                            <label 
                                                htmlFor={`subtask-${subtask.id}`} 
                                                className={`text-xs flex-1 ${subtask.done ? 'line-through text-muted-foreground' : ''}`}
                                            >
                                                {subtask.text}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}

                        </div>
                        {task.id !== HOMEWORK_SYNC_TASK_ID && (
                            <div className="flex">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(task)}>
                                    <Pencil className="h-4 w-4 text-muted-foreground"/>
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)}>
                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
        {tasks.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Noch keine Aufgaben vorhanden. Leg los!</p>
        )}
      </main>
    </div>
  );
}


function TaskEditForm({ task, onSave, onCancel, settings }: { task: Task, onSave: (task: Task) => void, onCancel: () => void, settings: ListSettings }) {
    const [editedTask, setEditedTask] = useState<Task>(task);
    const [newSubtaskText, setNewSubtaskText] = useState("");

    useEffect(() => {
        setEditedTask(task);
    }, [task]);

    const handleFieldChange = (field: keyof Task, value: any) => {
        setEditedTask(prev => ({...prev, [field]: value }));
    }

    const handleSave = () => {
        onSave(editedTask);
    }
    
    const addSubtask = (e: React.FormEvent) => {
        e.preventDefault();
        if (newSubtaskText.trim()) {
            const newSubtask: Task = {
                id: Date.now().toString(),
                text: newSubtaskText.trim(),
                done: false
            };
            const updatedSubtasks = [...(editedTask.subtasks || []), newSubtask];
            handleFieldChange('subtasks', updatedSubtasks);
            setNewSubtaskText("");
        }
    }

    const toggleSubtask = (subtaskId: string) => {
        const updatedSubtasks = (editedTask.subtasks || []).map(sub => 
            sub.id === subtaskId ? {...sub, done: !sub.done} : sub
        );
        handleFieldChange('subtasks', updatedSubtasks);
    }

    const deleteSubtask = (subtaskId: string) => {
        const updatedSubtasks = (editedTask.subtasks || []).filter(sub => sub.id !== subtaskId);
        handleFieldChange('subtasks', updatedSubtasks);
    }

    const moveSubtask = (index: number, direction: 'up' | 'down') => {
        const subtasks = editedTask.subtasks || [];
        if (!subtasks) return;
    
        const newSubtasks = [...subtasks];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
        if (targetIndex >= 0 && targetIndex < newSubtasks.length) {
            [newSubtasks[index], newSubtasks[targetIndex]] = [newSubtasks[targetIndex], newSubtasks[index]];
            handleFieldChange('subtasks', newSubtasks);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <Tabs defaultValue="general" className="w-full flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="general">Allgemein</TabsTrigger>
                    <TabsTrigger value="subtasks" disabled={!settings.enableSubtasks}>Subtasks</TabsTrigger>
                    <TabsTrigger value="groups" disabled={!settings.enableGroups}>Gruppen</TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="flex-1 overflow-auto">
                     <ScrollArea className="h-[300px] pr-4">
                        <div className="space-y-4 my-4">
                            <div>
                                <Label htmlFor="edit-task-text">Aufgabe</Label>
                                <Input 
                                    id="edit-task-text"
                                    value={editedTask.text}
                                    onChange={(e) => handleFieldChange('text', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="edit-task-due-date">Fälligkeit</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !editedTask.dueDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {editedTask.dueDate ? format(new Date(editedTask.dueDate), "PPP", { locale: de }) : <span>Datum wählen</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={editedTask.dueDate ? new Date(editedTask.dueDate) : undefined}
                                            onSelect={(date) => handleFieldChange('dueDate', date ? format(date, 'yyyy-MM-dd') : undefined)}
                                            initialFocus
                                            locale={de}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            {settings.enableNumericPriority ? (
                                <div>
                                    <Label className="mb-2 block">Priorität: {editedTask.priority || 'Keine'}</Label>
                                    <Slider
                                        defaultValue={[editedTask.priority || 0]}
                                        min={0}
                                        max={10}
                                        step={1}
                                        onValueChange={(value) => handleFieldChange('priority', value[0])}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <Label className="mb-2 block">Priorität</Label>
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3].map(p => (
                                            <Button key={p} type="button" variant="ghost" size="icon" onClick={() => handleFieldChange('priority', p === editedTask.priority ? 0 : p)}>
                                                <Star className={`w-5 h-5 ${ (editedTask.priority || 0) >= p ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'}`}/>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <Label htmlFor="edit-task-note">Notiz</Label>
                                <Textarea 
                                    id="edit-task-note"
                                    placeholder="Zusätzliche Details..."
                                    value={editedTask.note || ''}
                                    onChange={(e) => handleFieldChange('note', e.target.value)}
                                    rows={4}
                                />
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>
                <TabsContent value="subtasks" className="flex-1 overflow-auto">
                    <ScrollArea className="h-[300px] pr-4">
                        <div className="space-y-2 mt-4">
                            {(editedTask.subtasks || []).map((subtask, index) => (
                                <div key={subtask.id} className="flex items-center gap-2 text-sm bg-secondary p-2 rounded-md">
                                    <div className="flex flex-col">
                                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => moveSubtask(index, 'up')} disabled={index === 0}>
                                            <ArrowUp className="w-3 h-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => moveSubtask(index, 'down')} disabled={index === (editedTask.subtasks || []).length - 1}>
                                            <ArrowDown className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <Checkbox 
                                        id={`subtask-edit-${subtask.id}`}
                                        checked={subtask.done}
                                        onCheckedChange={() => toggleSubtask(subtask.id)}
                                    />
                                    <label 
                                        htmlFor={`subtask-edit-${subtask.id}`}
                                        className={`flex-1 ${subtask.done ? 'line-through text-muted-foreground' : ''}`}
                                    >
                                        {subtask.text}
                                    </label>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSubtask(subtask.id)}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            ))}
                            <form onSubmit={addSubtask} className="flex items-center gap-2 pt-2">
                                <Input 
                                    placeholder="Neue Subtask"
                                    value={newSubtaskText}
                                    onChange={(e) => setNewSubtaskText(e.target.value)}
                                    className="h-9"
                                />
                                <Button type="submit" size="icon" className="h-9 w-9">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </form>
                        </div>
                     </ScrollArea>
                </TabsContent>
                <TabsContent value="groups" className="flex-1 overflow-auto">
                     <ScrollArea className="h-[300px] pr-4">
                        <div className="my-4 space-y-2">
                             <Label>Gruppe zuweisen</Label>
                            {(settings.groups && settings.groups.length > 0) ? (
                                <Select value={editedTask.group || 'no-group'} onValueChange={(value) => handleFieldChange('group', value === 'no-group' ? undefined : value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Gruppe wählen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="no-group">Keine Gruppe</SelectItem>
                                        {settings.groups.map(group => (
                                            <SelectItem key={group.id} value={group.id}>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-full" style={{backgroundColor: group.color}}></span>
                                                    {group.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="text-sm text-muted-foreground">Keine Gruppen für diese Liste erstellt. Füge welche in den Listen-Einstellungen hinzu.</p>
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>
            <DialogFooter className="pt-4 mt-4 border-t">
                <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
                <Button onClick={handleSave}>Speichern</Button>
            </DialogFooter>
        </div>
    )
}

function SettingsForm({ settings, onSettingChange, onDelete, isNewList, closeSheet, onSyncHomeworks }: { settings: ListSettings, onSettingChange: (key: keyof ListSettings, value: any) => void, onDelete: () => void, isNewList: boolean, closeSheet: () => void, onSyncHomeworks: () => string }) {
    const [newGroupName, setNewGroupName] = useState('');
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingGroupName, setEditingGroupName] = useState('');
    const [editingGroupColor, setEditingGroupColor] = useState('#ffffff');
    const [newGroupColor, setNewGroupColor] = useState(generateColor());
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const { toast } = useToast();

    const handleAddGroup = (e: React.FormEvent) => {
        e.preventDefault();
        if (newGroupName.trim() && (settings.groups?.length || 0) < 10) {
            const newGroup: Group = {
                id: Date.now().toString(),
                name: newGroupName.trim(),
                color: newGroupColor,
            };
            onSettingChange('groups', [...(settings.groups || []), newGroup]);
            setNewGroupName('');
            setNewGroupColor(generateColor());
        }
    };

    const handleUpdateGroup = () => {
        if (editingGroupId && editingGroupName.trim()) {
            const updatedGroups = (settings.groups || []).map(g =>
                g.id === editingGroupId ? { ...g, name: editingGroupName.trim(), color: editingGroupColor } : g
            );
            onSettingChange('groups', updatedGroups);
            setEditingGroupId(null);
            setEditingGroupName('');
        }
    }

    const handleDeleteGroup = (groupId: string) => {
        const updatedGroups = (settings.groups || []).filter(g => g.id !== groupId);
        onSettingChange('groups', updatedGroups);
    }

    const handleSyncClick = () => {
        const message = onSyncHomeworks();
        toast({
            title: 'Hausaufgaben-Sync',
            description: message
        });
    }
    
    return (
         <ScrollArea className="flex-1 pr-6 -mr-6">
                <div className="py-4 space-y-6">
                    <div className="p-4 border rounded-lg space-y-4 bg-secondary/50">
                        <div className="flex flex-row items-center justify-between">
                            <Label htmlFor="advanced-mode" className="font-bold">Erweiterter Modus</Label>
                            <Switch id="advanced-mode" checked={settings.advancedMode} onCheckedChange={(c) => onSettingChange('advancedMode', c)} />
                        </div>
                        <p className="text-xs text-muted-foreground">Aktiviere zusätzliche Funktionen für Power-User.</p>
                    </div>

                    <div className={`space-y-4 ${!settings.advancedMode ? 'opacity-50' : ''}`}>
                        <div className="flex flex-row items-center justify-between">
                            <Label htmlFor="subtasks-mode">Subtasks</Label>
                            <Switch id="subtasks-mode" disabled={!settings.advancedMode} checked={settings.enableSubtasks} onCheckedChange={(c) => onSettingChange('enableSubtasks', c)} />
                        </div>
                        <div className="flex flex-row items-center justify-between">
                            <Label htmlFor="groups-mode">Gruppen</Label>
                            <Switch id="groups-mode" disabled={!settings.advancedMode} checked={settings.enableGroups} onCheckedChange={(c) => onSettingChange('enableGroups', c)} />
                        </div>
                        <div className="flex flex-row items-center justify-between">
                            <Label htmlFor="numeric-priority-mode">Numerische Priorität</Label>
                            <Switch id="numeric-priority-mode" disabled={!settings.advancedMode} checked={settings.enableNumericPriority} onCheckedChange={(c) => onSettingChange('enableNumericPriority', c)} />
                        </div>
                         <Separator />
                        <h4 className="font-semibold">Syncs</h4>
                         <div className="flex flex-row items-center justify-between">
                            <Label htmlFor="sync-homework-mode" className="flex flex-col gap-1">
                                <span>Hausaufgaben synchronisieren</span>
                                 <span className="text-xs font-normal text-muted-foreground">Erstellt Aufgaben aus deinem Hausaufgabenplaner.</span>
                            </Label>
                            <Switch id="sync-homework-mode" disabled={!settings.advancedMode} checked={settings.syncHomework} onCheckedChange={(c) => onSettingChange('syncHomework', c)} />
                        </div>
                        {settings.syncHomework && (
                            <Button variant="outline" onClick={handleSyncClick} className="w-full">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Jetzt synchronisieren
                            </Button>
                        )}
                    </div>
                    
                    <Separator />

                    <div className="space-y-2">
                        <Label>Standard-Sortierung</Label>
                        <Select value={settings.sortBy || 'default'} onValueChange={(v) => onSettingChange('sortBy', v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Sortierung wählen" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Manuell</SelectItem>
                                <SelectItem value="dueDate">Fälligkeitsdatum</SelectItem>
                                <SelectItem value="priority">Priorität</SelectItem>
                                <SelectItem value="alphabetical">Alphabetisch</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-row items-center justify-between">
                        <Label htmlFor="weekly-reset">Wöchentlicher Reset</Label>
                        <Switch id="weekly-reset" checked={settings.weeklyReset} onCheckedChange={(c) => onSettingChange('weeklyReset', c)} />
                    </div>
                    
                     {settings.enableGroups && (
                        <>
                            <Separator />
                            <div className="space-y-4">
                                <h4 className="font-semibold">Gruppen verwalten</h4>
                                <div className="space-y-2">
                                    {(settings.groups || []).map(group => (
                                        <div key={group.id} className="flex items-center gap-2">
                                            {editingGroupId === group.id ? (
                                                <>
                                                    <Input 
                                                        value={editingGroupName}
                                                        onChange={e => setEditingGroupName(e.target.value)}
                                                        className="h-8 flex-1"
                                                    />
                                                     <Input 
                                                        type="color"
                                                        value={editingGroupColor}
                                                        onChange={e => setEditingGroupColor(e.target.value)}
                                                        className="h-8 w-10 p-1"
                                                    />
                                                </>

                                            ) : (
                                                <>
                                                    <span className="w-3 h-3 rounded-full" style={{backgroundColor: group.color}}></span>
                                                    <span className="flex-1">{group.name}</span>
                                                </>
                                            )}
                                            {editingGroupId === group.id ? (
                                                <Button size="icon" variant="ghost" onClick={handleUpdateGroup} className="h-8 w-8"><Check className="h-4 w-4"/></Button>
                                            ) : (
                                                <Button size="icon" variant="ghost" onClick={() => { setEditingGroupId(group.id); setEditingGroupName(group.name); setEditingGroupColor(group.color); }} className="h-8 w-8"><Pencil className="h-4 w-4"/></Button>
                                            )}
                                            <Button size="icon" variant="ghost" onClick={() => handleDeleteGroup(group.id)} className="h-8 w-8"><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    ))}
                                </div>
                                { (settings.groups?.length || 0) < 10 && (
                                    <form onSubmit={handleAddGroup} className="flex items-center gap-2">
                                        <Input
                                            placeholder="Neue Gruppe"
                                            value={newGroupName}
                                            onChange={e => setNewGroupName(e.target.value)}
                                            className="h-9 flex-1"
                                        />
                                         <Input 
                                            type="color"
                                            value={newGroupColor}
                                            onChange={e => setNewGroupColor(e.target.value)}
                                            className="h-9 w-12 p-1"
                                        />
                                        <Button type="submit" size="icon" className="h-9 w-9"><Plus className="h-4 w-4"/></Button>
                                    </form>
                                )}
                            </div>
                        </>
                    )}


                    <Separator />

                     <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <AlertDialogTrigger asChild>
                             <div className="space-y-2">
                                <h4 className="font-semibold mb-2">Gefahrenzone</h4>
                                <Button variant="destructive" disabled={isNewList}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Liste endgültig löschen
                                </Button>
                            </div>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Liste wirklich löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                            Diese Aktion kann nicht rückgängig gemacht werden. Bist du sicher?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {onDelete(); closeSheet();}} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
                        </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </ScrollArea>
    )
}
