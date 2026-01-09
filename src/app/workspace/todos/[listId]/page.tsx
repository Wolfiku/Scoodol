'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Save, Check, MoreHorizontal, Trash2, Plus, Settings } from 'lucide-react';
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
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

type Task = {
  id: string;
  text: string;
  done: boolean;
};

type TodoList = {
  title: string;
  tasks: Task[];
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
  const [newTaskText, setNewTaskText] = useState('');

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);

  const listDocRef = useMemoFirebase(() => 
    !isNewList && user && typeof listId === 'string'
      ? doc(firestore, `users/${user.uid}/todoLists`, listId)
      : null
  , [firestore, user, listId, isNewList]);

  const { data: todoList, isLoading: isLoadingList } = useDoc<TodoList>(listDocRef);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (todoList) {
      setTitle(todoList.title);
      setTasks(todoList.tasks);
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
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      setSaveStatus('idle');
    } catch (error) {
      setSaveStatus('dirty');
    }
  }, [firestore, user, title, tasks, isNewList, listDocRef, router]);

  useEffect(() => {
    if (isLoadingList) return;
    if (isNewList && !title.trim()) return;
    
    const hasChanged = isNewList || (todoList && (title !== todoList.title || JSON.stringify(tasks) !== JSON.stringify(todoList.tasks)));
    
    if (!hasChanged) {
        return;
    }

    setSaveStatus('dirty');
    if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
        handleSave();
    }, 1500);

    return () => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
    };
  }, [title, tasks, todoList, isLoadingList, handleSave, isNewList]);


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

  const toggleTaskDone = (taskId: string) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId ? { ...task, done: !task.done } : task
      )
    );
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

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

      <Sheet open={isSettingsSheetOpen} onOpenChange={setIsSettingsSheetOpen}>
        <SheetContent>
            <SheetHeader>
                <SheetTitle>Listen-Einstellungen</SheetTitle>
                <SheetDescription>Verwalte die Einstellungen für deine To-Do-Liste "{title}".</SheetDescription>
            </SheetHeader>
            <div className="py-4 space-y-6">
                <p className="text-sm text-muted-foreground">Hier kommen bald weitere Einstellungen, z.B. für die Sortierung.</p>
                
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
        <form onSubmit={handleAddTask} className="flex gap-2">
          <Input 
            placeholder="Neue Aufgabe hinzufügen..."
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
          />
          <Button type="submit">
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="space-y-2">
            {tasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 p-2 bg-secondary rounded-md">
                    <Checkbox 
                        id={`task-${task.id}`}
                        checked={task.done}
                        onCheckedChange={() => toggleTaskDone(task.id)}
                    />
                    <label htmlFor={`task-${task.id}`} className={`flex-1 text-sm ${task.done ? 'line-through text-muted-foreground' : ''}`}>{task.text}</label>
                    <Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
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
