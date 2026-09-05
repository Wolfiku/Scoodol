
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, StickyNote, FileText, BarChart3, MoreHorizontal, Loader2, Edit, Share2, Trash2, ListTodo, BrainCircuit, Type, Presentation, ImageIcon } from 'lucide-react';
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import ShareNoteDialog from '@/app/components/share-note-dialog';
import { Badge } from '@/components/ui/badge';


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

type PresentationDoc = DocumentBase & {
    slides: any[];
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

    const presentationsQuery = useMemoFirebase(() =>
        user ? query(collection(firestore, `users/${user.uid}/presentations`), orderBy('updatedAt', 'desc'), limit(5)) : null
    , [firestore, user]);
    const { data: recentPresentations, isLoading: isLoadingPresentations } = useCollection<PresentationDoc>(presentationsQuery);
    
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
        const presWithType = (recentPresentations || []).map(pres => ({ ...pres, type: 'presentation' as const }));

        const allItems = [...notesWithType, ...docsWithType, ...todosWithType, ...quizzesWithType, ...statsWithType, ...presWithType];
        allItems.sort((a, b) => {
            const timeA = a.updatedAt?.seconds || 0;
            const timeB = b.updatedAt?.seconds || 0;
            return timeB - timeA;
        });
        
        return allItems.slice(0, 12);

    }, [recentNotes, recentDocs, recentTodoLists, recentQuizzes, recentStats, recentPresentations]);

    
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

    const handleDelete = async (item: {id: string, title: string, type: 'note' | 'document' | 'todo' | 'quiz' | 'statistic' | 'presentation'}) => {
      if (!user) return;
      let collectionName = '';
      switch(item.type) {
          case 'note': collectionName = 'quickNotes'; break;
          case 'document': collectionName = 'documents'; break;
          case 'todo': collectionName = 'todoLists'; break;
          case 'quiz': collectionName = 'quizzes'; break;
          case 'statistic': collectionName = 'statistics'; break;
          case 'presentation': collectionName = 'presentations'; break;
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

    const getItemUrl = (item: any) => {
        let path = '';
        switch(item.type) {
            case 'note': path = 'notes'; break;
            case 'document': path = 'documents'; break;
            case 'todo': path = 'todos'; break;
            case 'quiz': path = 'quizzes'; break;
            case 'statistic': path = 'statistics'; break;
            case 'presentation': path = 'presentations'; break;
        }
        return `/workspace/${path}/${item.id}`;
    }


    return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl">
            <header className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-4xl font-black text-primary tracking-tight">Workspace</h1>
                    <p className="text-muted-foreground mt-1">Willkommen zurück in deiner kreativen Zentrale.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" size="icon" className="rounded-xl h-11 w-11" asChild title="Galerie">
                        <Link href="/workspace/gallery"><ImageIcon className="h-5 w-5" /></Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button className="rounded-xl font-black h-11 shadow-lg shadow-primary/20">
                              <Plus className="mr-2 h-5 w-5" />
                              Erstellen
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-64 p-2 rounded-2xl" align="end">
                        <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50 tracking-widest">Neues Dokument</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild className="rounded-xl p-3">
                          <Link href="/workspace/documents/new">
                            <Type className="mr-3 h-5 w-5 text-primary" />
                            <div className="flex flex-col"><span className="font-bold">Text-Dokument</span><span className="text-[10px] text-muted-foreground">Formatierter Text & Bilder</span></div>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="rounded-xl p-3">
                          <Link href="/workspace/presentations/new">
                            <Presentation className="mr-3 h-5 w-5 text-primary" />
                            <div className="flex flex-col"><span className="font-bold">Präsentation</span><span className="text-[10px] text-muted-foreground">Interaktive Folien</span></div>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="rounded-xl p-3">
                          <Link href="/workspace/notes/new">
                            <StickyNote className="mr-3 h-5 w-5 text-primary" />
                            <div className="flex flex-col"><span className="font-bold">Quick Note</span><span className="text-[10px] text-muted-foreground">Schnelle Notizen</span></div>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="rounded-xl p-3">
                          <Link href="/workspace/statistics/new">
                            <BarChart3 className="mr-3 h-5 w-5 text-primary" />
                            <div className="flex flex-col"><span className="font-bold">Statistik</span><span className="text-[10px] text-muted-foreground">Daten visualisieren</span></div>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="rounded-xl p-3">
                          <Link href="/workspace/quizzes/new">
                            <BrainCircuit className="mr-3 h-5 w-5 text-primary" />
                            <div className="flex flex-col"><span className="font-bold">Quiz</span><span className="text-[10px] text-muted-foreground">Lern-Check erstellen</span></div>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="rounded-xl p-3">
                          <Link href="/workspace/todos/new">
                            <ListTodo className="mr-3 h-5 w-5 text-primary" />
                            <div className="flex flex-col"><span className="font-bold">To-Do-Liste</span><span className="text-[10px] text-muted-foreground">Aufgaben organisieren</span></div>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild className="rounded-xl p-3">
                          <Link href="/workspace/explore">
                            <MoreHorizontal className="mr-3 h-5 w-5 text-muted-foreground" />
                            <span className="font-bold">Mehr Entdecken...</span>
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 space-y-8">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Loader2 className="w-5 h-5 text-primary" /> 
                        Zuletzt geöffnet
                    </h2>
                    {(isLoadingNotes || isLoadingDocs || isLoadingTodos || isLoadingQuizzes || isLoadingStats || isLoadingPresentations) ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <Card key={i} className="h-32 animate-pulse bg-secondary/20" />
                            ))}
                        </div>
                    ) : recentItems && recentItems.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {recentItems.map(item => (
                            <Card key={item.id} className="hover:shadow-xl transition-all duration-300 flex flex-col group border-2 hover:border-primary/20 rounded-2xl overflow-hidden bg-card">
                            <div 
                                className="p-5 flex-1 cursor-pointer"
                                onClick={() => router.push(getItemUrl(item))}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 bg-secondary/50 rounded-lg group-hover:bg-primary/10 transition-colors">
                                        {item.type === 'note' && <StickyNote className="w-5 h-5 text-primary" />}
                                        {item.type === 'document' && <Type className="w-5 h-5 text-primary" />}
                                        {item.type === 'todo' && <ListTodo className="w-5 h-5 text-primary" />}
                                        {item.type === 'quiz' && <BrainCircuit className="w-5 h-5 text-primary" />}
                                        {item.type === 'statistic' && <BarChart3 className="w-5 h-5 text-primary" />}
                                        {item.type === 'presentation' && <Presentation className="w-5 h-5 text-primary" />}
                                    </div>
                                    <Badge variant="secondary" className="text-[9px] uppercase font-black tracking-widest px-2 h-5">
                                        {item.type === 'note' ? 'Note' : item.type === 'document' ? 'Doc' : item.type === 'todo' ? 'Todo' : item.type === 'quiz' ? 'Quiz' : item.type === 'statistic' ? 'Stat' : 'Pres'}
                                    </Badge>
                                </div>
                                <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors leading-tight mb-1">{item.title}</h3>
                                <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60">
                                    Bearbeitet {formatRelativeTime(item.updatedAt)}
                                </p>
                            </div>
                            <div className="p-2 px-3 border-t bg-secondary/10 flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                    <Link href={getItemUrl(item)} >
                                        <Edit className="h-4 w-4" />
                                    </Link>
                                    </Button>
                                    {item.type === 'note' && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleShareClick(item as QuickNote)}>
                                            <Share2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-3xl">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Dokument wirklich löschen?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Diese Aktion kann nicht rückgängig gemacht werden. Bist du sicher, dass du "{item.title}" löschen möchtest?
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel className="rounded-xl">Abbrechen</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(item)} className="bg-destructive text-white hover:bg-destructive/90 rounded-xl">Löschen</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                            </div>
                            </Card>
                        ))}
                        </div>
                    ) : (
                    <div className="p-20 text-center text-muted-foreground bg-secondary/30 rounded-3xl border-2 border-dashed flex flex-col items-center gap-4">
                        <FileText className="w-12 h-12 opacity-20" />
                        <p className="text-xl font-medium">Noch keine Dokumente vorhanden.</p>
                        <Button className="font-bold rounded-xl" onClick={() => router.push('/workspace/explore')}>Entdecke Vorlagen</Button>
                    </div>
                    )}
                </div>

                <aside className="space-y-8">
                    <Card className="rounded-3xl border-2 border-primary/20 shadow-lg shadow-primary/5 overflow-hidden">
                        <CardHeader className="bg-primary/5 pb-4">
                            <CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="h-5 w-5 text-primary"/> Deine Galerie</CardTitle>
                            <CardDescription className="text-xs">Zentrale für Bilder & Videos.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 text-center space-y-4">
                            <div className="p-4 bg-secondary/30 rounded-2xl border-2 border-dashed border-primary/10">
                                <ImageIcon className="h-10 w-10 mx-auto text-primary/30 mb-2" />
                                <p className="text-xs text-muted-foreground">Lade Dateien hoch, um sie in deinen Folien und Dokumenten zu nutzen.</p>
                            </div>
                            <Button className="w-full rounded-xl font-black gap-2 h-12" variant="outline" asChild>
                                <Link href="/workspace/gallery">Galerie öffnen <Plus className="h-4 w-4"/></Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-2 bg-secondary/5">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary"/> Lern-Hub</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button variant="ghost" className="w-full justify-start rounded-xl h-12 font-bold px-4 gap-3 bg-card border hover:border-primary/30" asChild>
                                <Link href="/workspace/quizzes/new"><Plus className="h-4 w-4 text-primary" /> Neues Quiz</Link>
                            </Button>
                            <Button variant="ghost" className="w-full justify-start rounded-xl h-12 font-bold px-4 gap-3 bg-card border hover:border-primary/30" asChild>
                                <Link href="/workspace/statistics/new"><Plus className="h-4 w-4 text-primary" /> Neue Statistik</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </aside>
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
