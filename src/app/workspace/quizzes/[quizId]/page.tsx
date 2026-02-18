'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Plus, MoreHorizontal, Trash2, BrainCircuit, Play, Save, Check, User, Hash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

type SlideType = 'welcome' | 'multiple-choice' | 'short-answer' | 'long-answer' | 'vocabulary' | 'text';

type Slide = {
  id: string;
  type: SlideType;
  content: any;
};

type Quiz = {
  title: string;
  creator: string;
  slides: Slide[];
  ownerId: string;
  createdAt: any;
  updatedAt: any;
};

type SaveStatus = 'idle' | 'dirty' | 'saving';

export default function QuizEditorPage() {
  const router = useRouter();
  const params = useParams();
  const { quizId } = params;
  const isNewQuiz = quizId === 'new';

  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  
  const [title, setTitle] = useState('');
  const [creator, setCreator] = useState('');
  const [slides, setSlides] = useState<Slide[]>([
    { id: 'welcome', type: 'welcome', content: { title: 'Willkommen zum Quiz', subtitle: '' } }
  ]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSetupDone, setIsSetupDone] = useState(!isNewQuiz);

  const quizDocRef = useMemoFirebase(() => 
    !isNewQuiz && user && typeof quizId === 'string'
      ? doc(firestore, `users/${user.uid}/quizzes`, quizId)
      : null
  , [firestore, user, quizId, isNewQuiz]);

  const { data: quiz, isLoading: isLoadingQuiz } = useDoc<Quiz>(quizDocRef);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (quiz) {
      setTitle(quiz.title);
      setCreator(quiz.creator);
      setSlides(quiz.slides || []);
      setIsSetupDone(true);
      setSaveStatus('idle');
    }
  }, [quiz]);

  const handleSave = useCallback(async () => {
    if (!firestore || !user || !title.trim() || !creator.trim()) return;
    setSaveStatus('saving');

    try {
      if (isNewQuiz) {
        const quizColRef = collection(firestore, `users/${user.uid}/quizzes`);
        const newDocRef = await addDoc(quizColRef, {
          title,
          creator,
          slides,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        router.replace(`/workspace/quizzes/${newDocRef.id}`);
      } else {
        if (!quizDocRef) return;
        await setDoc(quizDocRef, {
          title,
          creator,
          slides,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      setSaveStatus('idle');
    } catch (error) {
      setSaveStatus('dirty');
    }
  }, [firestore, user, title, creator, slides, isNewQuiz, quizDocRef, router]);

  useEffect(() => {
    if (isLoadingQuiz || !isSetupDone) return;
    
    const hasChanges = quiz 
        ? (title !== quiz.title || creator !== quiz.creator || JSON.stringify(slides) !== JSON.stringify(quiz.slides))
        : (title.trim() !== '' && creator.trim() !== '');

    if (hasChanges) {
      setSaveStatus('dirty');
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(handleSave, 2000);
    }

    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [title, creator, slides, quiz, isLoadingQuiz, isSetupDone, handleSave]);

  const addSlide = (type: SlideType) => {
    const newSlide: Slide = {
      id: Date.now().toString(),
      type,
      content: {}
    };
    setSlides([...slides, newSlide]);
    toast({ title: 'Folie hinzugefügt', description: `Ein neues ${type} wurde erstellt.` });
  };

  const deleteSlide = (id: string) => {
    if (id === 'welcome') {
        toast({ variant: 'destructive', title: 'Aktion nicht möglich', description: 'Die Willkommens-Seite kann nicht gelöscht werden.' });
        return;
    }
    setSlides(slides.filter(s => s.id !== id));
  };

  const handleDeleteQuiz = async () => {
    if (isNewQuiz || !quizDocRef) return;
    await deleteDoc(quizDocRef);
    toast({ title: 'Quiz gelöscht' });
    router.push('/workspace');
  };

  if (isUserLoading || (isLoadingQuiz && !isNewQuiz)) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin" /></div>;
  }

  if (!isSetupDone) {
    return (
      <div className="container mx-auto p-4 max-w-lg flex flex-col justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Neues Quiz erstellen</CardTitle>
            <CardDescription>Gib zuerst die grundlegenden Infos ein.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Thema / Titel</Label>
              <Input placeholder="z.B. Biologie - Zellen" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ersteller</Label>
              <Input placeholder="Dein Name" value={creator} onChange={e => setCreator(e.target.value)} />
            </div>
            <Button className="w-full" disabled={!title.trim() || !creator.trim()} onClick={() => setIsSetupDone(true)}>
              Editor starten
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-secondary/20">
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Quiz wirklich löschen?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuiz} className="bg-destructive">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="bg-background border-b p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4 flex-1">
          <Button variant="ghost" size="icon" onClick={() => router.push('/workspace')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <Input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="h-7 text-lg font-bold border-0 shadow-none focus-visible:ring-0 p-0" 
            />
            <span className="text-xs text-muted-foreground flex items-center gap-1">
                von {creator} • {saveStatus === 'saving' ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3"/>}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Play className="mr-2 h-4 w-4" /> Vorschau
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost"><Plus className="h-5 w-5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Folie hinzufügen</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => addSlide('multiple-choice')}>Auswahlmöglichkeiten</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addSlide('short-answer')}>Wort Antwort (kurz)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addSlide('long-answer')}>Antwort (KI-gestützt)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addSlide('vocabulary')}>Vokabeln</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addSlide('text')}>Textfolie</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost"><MoreHorizontal className="h-5 w-5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Quiz löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {slides.map((slide, index) => (
            <Card key={slide.id} className={slide.type === 'welcome' ? 'border-primary shadow-md' : ''}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="h-6 w-6 rounded-full flex items-center justify-center p-0">
                    {index + 1}
                  </Badge>
                  <div>
                    <CardTitle className="text-lg">
                        {slide.type === 'welcome' ? 'Willkommens-Seite' : 
                         slide.type === 'multiple-choice' ? 'Mehrfachauswahl' :
                         slide.type === 'short-answer' ? 'Kurzantwort' :
                         slide.type === 'long-answer' ? 'Freitext (KI)' :
                         slide.type === 'vocabulary' ? 'Vokabel-Test' : 'Info-Text'}
                    </CardTitle>
                  </div>
                </div>
                {slide.id !== 'welcome' && (
                  <Button variant="ghost" size="icon" onClick={() => deleteSlide(slide.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="p-12 border-2 border-dashed rounded-lg bg-secondary/10 flex flex-col items-center justify-center text-center">
                    <BrainCircuit className="h-8 w-8 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground font-medium">Editor für Folientyp "{slide.type}" folgt bald.</p>
                    <p className="text-xs text-muted-foreground mt-1">Hier kannst du dann Fragen und Antworten konfigurieren.</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
