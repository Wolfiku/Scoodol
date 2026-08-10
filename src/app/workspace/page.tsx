
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, StickyNote, FileText, BarChart3, MoreHorizontal, Loader2, Edit, Share2, Trash2, ListTodo, BrainCircuit, Type } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useRouter } from 'next/navigation';
import { doc, collection, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
} from "@/components/ui/alert-dialog"
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import ShareNoteDialog from '@/app/components/share-note-dialog';


type UserProfile = {
  role?: 'user' | 'admin' | 'workspace_plus_user';
}

type DocumentBase = {
    id: string;
    title: string;
    updatedAt: {
        seconds: number;
        nanoseconds: number;
    }
}

type QuickNote = DocumentBase & {
  content: string;
}

type TextDocument = DocumentBase & {
    content: string;
}

type TodoList = DocumentBase & {
    tasks: any[];
}

type Quiz = DocumentBase & {
    slides: any[];
}

type Statistic = DocumentBase & {
    charts: any[];
}

export default function WorkspacePage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [sharingNote, setSharingNote] = useState<QuickNote | null>(null);
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

    const userDocRef = useMemoFirebase(() => 
        user ? doc(firestore, 'users', user.uid) : null
    , [firestore, user]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    const notesQuery = useMemoFirebase(() =>
      user ? query(collection(firestore, `users/${user.uid}/quickNotes`), orderBy('updatedAt', 'desc'), limit(5)) : null
    , [firestore, user]);
    const { data: recentNotes, isLoading: isLoadingNotes } = useCollection<QuickNote>(notesQuery);

    const docsQuery = useMemoFirebase(() =>
        user ? query(collection(firestore, `users/${user.uid}/documents`), orderBy('updatedAt', 'desc'), limit(5)) : null
    , [firestore, user]);
    const { data: recentDocs, isLoading: isLoadingDocs } = useCollection<TextDocument>(docsQuery);

    const todosQuery = useMemoFirebase(() =>
      user ? query(collection(firestore, `users/${user.uid}/todoLists`), orderBy('updatedAt', 'desc'), limit(5)) : null
    , [firestore, user]);
    const { data: recentTodoLists, isLoading: isLoadingTodos } = useCollection<TodoList>(todosQuery);

    const quizzesQuery = useMemoFirebase(() =>
        user ? query(collection(firestore, `users/${user.uid}/quizzes`), orderBy('updatedAt', 'desc'), limit(5)) : null
    , [firestore, user]);
    const { data: recentQuizzes, isLoading: isLoadingQuizzes } = useCollection<Quiz>(quizzesQuery);

    const statsQuery = useMemoFirebase(() =>
        user ? query(collection(firestore, `users/${user.uid}/statistics`), orderBy('updatedAt', 'desc'), limit(5)) : null
    , [firestore, user]);
    const { data: recentStats, isLoading: isLoadingStats } = useCollection<Statistic>(statsQuery);
    
    useEffect(() => {
      if (isUserLoading || isProfileLoading) return;
      if (!user || user.isAnonymous) {
        router.push('/login');
        return;
      }
    }, [user, isUserLoading, isProfileLoading, router]);

    const recentItems = useMemo(() => {
        const notesWithType = (recentNotes || []).map(note => ({ ...note, type: 'note' as const }));
        const docsWithType = (recentDocs || []).map(doc => ({ ...doc, type: 'document' as const }));
        const todosWithType = (recentTodoLists || []).map(todo => ({ ...todo, type: 'todo' as const }));
        const quizzesWithType = (recentQuizzes || []).map(quiz => ({ ...quiz, type: 'quiz' as const }));
        const statsWithType = (recentStats || []).map(stat => ({ ...stat, type: 'statistic' as const }));

        const allItems = [...notesWithType, ...docsWithType, ...todosWithType, ...quizzesWithType, ...statsWithType];
        allItems.sort((a, b) => {
            const timeA = a.updatedAt?.seconds || 0;
            const timeB = b.updatedAt?.seconds || 0;
            return timeB - timeA;
        });
        
        return allItems.slice(0, 12);

    }, [recentNotes, recentDocs, recentTodoLists, recentQuizzes, recentStats]);

    
    if (isUserLoading || isProfileLoading) {
        return (
             <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        )
    }

    if (!user || user.isAnonymous) {
        return null;
    }

    const formatRelativeTime = (timestamp: DocumentBase['updatedAt']) => {
      if (!timestamp) return 'Gerade eben';
      const date = new Date(timestamp.seconds * 1000);
      return formatDistanceToNow(date, { addSuffix: true, locale: de });
    }

    const handleDelete = async (item: {id: string, title: string, type: 'note' | 'document' | 'todo' | 'quiz' | 'statistic'}) => {
      if (!user) return;
      let collectionName = '';
      switch(item.type) {
          case 'note': collectionName = 'quickNotes'; break;
          case 'document': collectionName = 'documents'; break;
          case 'todo': collectionName = 'todoLists'; break;
          case 'quiz': collectionName = 'quizzes'; break;
          case 'statistic': collectionName = 'statistics'; break;
      }
      const docRef = doc(firestore, `users/${user.uid}/${collectionName}`, item.id);
      
      await deleteDoc(docRef);
      toast({
        title: "Dokument gelöscht!",
        description: `"${item.title}" wurde endgültig gelöscht.`
      });
    }

    const handleShareClick = (note: QuickNote) => {
      setSharingNote(note);
      setIsShareDialogOpen(true);
    }


    return (
        <div className="container mx-auto p-4 md:p-8">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-primary">Workspace</h1>
                <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button>
                              <Plus className="mr-2" />
                              Neu
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56" align="end">
                        <DropdownMenuLabel>Erstellen</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/workspace/documents/new">
                            <Type className="mr-2 h-4 w-4" />
                            <span>Text-Dokument</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/workspace/notes/new">
                            <StickyNote className="mr-2 h-4 w-4" />
                            <span>Quick Note</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/workspace/statistics/new">
                            <BarChart3 className="mr-2 h-4 w-4" />
                            <span>Statistik</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/workspace/quizzes/new">
                            <BrainCircuit className="mr-2 h-4 w-4" />
                            <span>Quiz</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/workspace/todos/new">
                            <ListTodo className="mr-2 h-4 w-4" />
                            <span>To-Do-Liste</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/workspace/explore">
                            <MoreHorizontal className="mr-2 h-4 w-4" />
                            <span>Weiteres</span>
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <div>
                <h2 className="text-xl font-semibold mb-4">Zuletzt geöffnet</h2>
                {(isLoadingNotes || isLoadingDocs || isLoadingTodos || isLoadingQuizzes || isLoadingStats) ? (
                    <div className="p-8 text-center text-muted-foreground bg-secondary rounded-lg">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </div>
                ) : recentItems && recentItems.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recentItems.map(item => (
                        <Card key={item.id} className="hover:shadow-md transition-shadow flex flex-col">
                           <div className="p-4 flex-1">
                              <div className="flex justify-between items-start mb-2">
                                <h3 className="font-semibold truncate pr-4">{item.title}</h3>
                                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full whitespace-nowrap flex items-center gap-1">
                                  {item.type === 'note' && <StickyNote className="w-3 h-3" />}
                                  {item.type === 'document' && <Type className="w-3 h-3" />}
                                  {item.type === 'todo' && <ListTodo className="w-3 h-3" />}
                                  {item.type === 'quiz' && <BrainCircuit className="w-3 h-3" />}
                                  {item.type === 'statistic' && <BarChart3 className="w-3 h-3" />}
                                  {item.type === 'note' ? 'Quick Note' : item.type === 'document' ? 'Dokument' : item.type === 'todo' ? 'To-Do-Liste' : item.type === 'quiz' ? 'Quiz' : 'Statistik'}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Bearbeitet {formatRelativeTime(item.updatedAt)}
                              </p>
                           </div>
                           <div className="p-2 border-t flex justify-end items-center gap-1">
                                <Button asChild variant="ghost" size="icon">
                                  <Link href={`/workspace/${item.type === 'note' ? 'notes' : item.type === 'document' ? 'documents' : item.type === 'todo' ? 'todos' : item.type === 'quiz' ? 'quizzes' : 'statistics'}/${item.id}`} >
                                    <Edit className="h-4 w-4" />
                                  </Link>
                                </Button>
                                {item.type === 'note' && (
                                   <Button variant="ghost" size="icon" onClick={() => handleShareClick(item as QuickNote)}>
                                        <Share2 className="h-4 w-4" />
                                    </Button>
                                )}
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Dokument wirklich löschen?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Diese Aktion kann nicht rückgängig gemacht werden. Bist du sicher, dass du "{item.title}" löschen möchtest?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(item)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                           </div>
                        </Card>
                      ))}
                    </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground bg-secondary rounded-lg">
                      <p>Noch keine Dokumente vorhanden. Erstelle deine erstes!</p>
                  </div>
                )}
            </div>

            {sharingNote && (
              <ShareNoteDialog 
                open={isShareDialogOpen} 
                onOpenChange={setIsShareDialogOpen} 
                note={sharingNote} 
              />
            )}
        </div>
    );
}
