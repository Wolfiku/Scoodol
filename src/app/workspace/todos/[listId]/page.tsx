'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Save, Check, MoreHorizontal, Trash2, Plus, Settings, Star, Calendar as CalendarIcon, Pencil, FilePlus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
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


type Task = {
  id: string;
  text: string;
  done: boolean;
  dueDate?: string;
  priority?: number;
  note?: string;
  subtasks?: Task[];
  group?: string;
};

type ListSettings = {
    advancedMode?: boolean;
    enableSubtasks?: boolean;
    enableGroups?: boolean;
    enableColorGroups?: boolean;
    sortBy?: 'default' | 'dueDate' | 'priority' | 'alphabetical';
    weeklyReset?: boolean;
    enableNumericPriority?: boolean;
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
  const [settings, setSettings] = useState<ListSettings>({});

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
  
  useEffect(() => {
    if (todoList) {
      setTitle(todoList.title);
      setTasks(todoList.tasks || []);
      setSettings(todoList.settings || {});
      setSaveStatus('idle');
    }
  }, [todoList]);

  const handleSave = useCallback(async () => {
    if (!firestore || !user || !title.trim()) return;
    setSaveStatus('saving');

    try {
      if (isNewList) {
        const listsColRef = collection(firestore, `users/${user.uid}/todoLists`);
        const newDocRef = await addDoc(listsColRef, {
          title,
          tasks,
          settings,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        router.replace(`/workspace/todos/${newDocRef.id}`);
      } else {
        if (!listDocRef) return;
        await setDoc(listDocRef, {
          title,
          tasks,
          settings,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      setSaveStatus('idle');
    } catch (error) {
      setSaveStatus('dirty');
    }
  }, [firestore, user, title, tasks, settings, isNewList, listDocRef, router]);

  useEffect(() => {
    if (isLoadingList) return;
    if (isNewList && !title.trim() && tasks.length === 0) return;
    
    const hasChanged = isNewList || (todoList && (
        title !== todoList.title || 
        JSON.stringify(tasks) !== JSON.stringify(todoList.tasks) ||
        JSON.stringify(settings) !== JSON.stringify(todoList.settings)
    ));
    
    if (!hasChanged) {
        setSaveStatus('idle');
        return;
    }

    setSaveStatus('dirty');
    handleSave();

  }, [title, tasks, settings, todoList, isLoadingList, handleSave, isNewList]);


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
    setTasks(prevTasks =>
        prevTasks.map(task => {
            if (task.id === taskId) {
                if (subtaskId) {
                    const updatedSubtasks = (task.subtasks || []).map(sub =>
                        sub.id === subtaskId ? { ...sub, done: !sub.done } : sub
                    );
                    return { ...task, subtasks: updatedSubtasks };
                } else {
                    return { ...task, done: !task.done };
                }
            }
            return task;
        })
    );
  };


  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };
  
  const handleSettingChange = (key: keyof ListSettings, value: any) => {
      const newSettings = {...settings, [key]: value};
      // Logic for dependent settings
      if (key === 'advancedMode' && !value) {
          newSettings.enableSubtasks = false;
          newSettings.enableGroups = false;
          newSettings.enableColorGroups = false;
          newSettings.enableNumericPriority = false;
      }
      if (key === 'enableGroups' && !value) {
          newSettings.enableColorGroups = false;
      }
      setSettings(newSettings);
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
            <ScrollArea className="flex-1 pr-6 -mr-6">
                <div className="py-4 space-y-6">
                    <div className="p-4 border rounded-lg space-y-4 bg-secondary/50">
                        <div className="flex flex-row items-center justify-between">
                            <Label htmlFor="advanced-mode" className="font-bold">Erweiterter Modus</Label>
                            <Switch id="advanced-mode" checked={settings.advancedMode} onCheckedChange={(c) => handleSettingChange('advancedMode', c)} />
                        </div>
                        <p className="text-xs text-muted-foreground">Aktiviere zusätzliche Funktionen für Power-User.</p>
                    </div>

                    <div className={`space-y-4 ${!settings.advancedMode ? 'opacity-50' : ''}`}>
                        <div className="flex flex-row items-center justify-between">
                            <Label htmlFor="subtasks-mode">Subtasks</Label>
                            <Switch id="subtasks-mode" disabled={!settings.advancedMode} checked={settings.enableSubtasks} onCheckedChange={(c) => handleSettingChange('enableSubtasks', c)} />
                        </div>
                        <div className="flex flex-row items-center justify-between">
                            <Label htmlFor="groups-mode">Gruppen</Label>
                            <Switch id="groups-mode" disabled={!settings.advancedMode} checked={settings.enableGroups} onCheckedChange={(c) => handleSettingChange('enableGroups', c)} />
                        </div>
                        <div className={`flex flex-row items-center justify-between ${!settings.enableGroups ? 'opacity-50' : ''}`}>
                            <Label htmlFor="color-groups-mode">Gruppen einfärben</Label>
                            <Switch id="color-groups-mode" disabled={!settings.advancedMode || !settings.enableGroups} checked={settings.enableColorGroups} onCheckedChange={(c) => handleSettingChange('enableColorGroups', c)} />
                        </div>
                        <div className="flex flex-row items-center justify-between">
                            <Label htmlFor="numeric-priority-mode">Numerische Priorität</Label>
                            <Switch id="numeric-priority-mode" disabled={!settings.advancedMode} checked={settings.enableNumericPriority} onCheckedChange={(c) => handleSettingChange('enableNumericPriority', c)} />
                        </div>
                    </div>
                    
                    <Separator />

                    <div className="space-y-2">
                        <Label>Standard-Sortierung</Label>
                        <Select value={settings.sortBy || 'default'} onValueChange={(v) => handleSettingChange('sortBy', v)}>
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
                        <Switch id="weekly-reset" checked={settings.weeklyReset} onCheckedChange={(c) => handleSettingChange('weeklyReset', c)} />
                    </div>


                    <Separator />

                    <div>
                        <h4 className="font-semibold mb-2">Gefahrenzone</h4>
                        <Button variant="destructive" onClick={() => {
                            setIsSettingsSheetOpen(false);
                            setIsDeleteDialogOpen(true);
                        }} disabled={isNewList}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Liste endgültig löschen
                        </Button>
                    </div>
                </div>
            </ScrollArea>
             <SheetFooter>
                <Button variant="outline" onClick={() => setIsSettingsSheetOpen(false)}>Schließen</Button>
            </SheetFooter>
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
             <DropdownMenuItem onClick={() => setIsSettingsSheetOpen(true)} disabled={isNewList}>
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
                               {task.priority && (
                                   <div className="flex items-center gap-0.5">
                                       {[...Array(task.priority)].map((_, i) => (
                                            <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                                       ))}
                                   </div>
                               )}
                            </div>
                             {task.note && (
                                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-background whitespace-pre-wrap">{task.note}</p>
                             )}
                            
                            {settings.enableSubtasks && task.subtasks && task.subtasks.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-background/50 space-y-2">
                                    {task.subtasks.map(subtask => (
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
                        <div className="flex">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(task)}>
                                <Pencil className="h-4 w-4 text-muted-foreground"/>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)}>
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                        </div>
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
    
    const handleAddSubtask = (e: React.FormEvent) => {
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
                            {(editedTask.subtasks || []).map(subtask => (
                                <div key={subtask.id} className="flex items-center gap-2 text-sm bg-secondary p-2 rounded-md">
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
                            <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-2">
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
                        <div className="text-center text-muted-foreground p-8">
                            <p>Gruppen-Zuweisung kommt bald hierher.</p>
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
