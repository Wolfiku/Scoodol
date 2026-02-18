'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Plus, MoreHorizontal, Trash2, BrainCircuit, Play, Save, Check, User, Info, Sparkles, MessageSquareText, ChevronRight, ChevronLeft, X } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

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
    { id: 'welcome', type: 'welcome', content: { title: 'Willkommen zum Quiz', subtitle: '', askName: false } }
  ]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSetupDone, setIsSetupDone] = useState(!isNewQuiz);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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

  const updateSlideContent = (id: string, newContent: any) => {
    setSlides(prev => prev.map(s => s.id === id ? { ...s, content: { ...s.content, ...newContent } } : s));
  };

  const addSlide = (type: SlideType) => {
    const baseContent = type === 'multiple-choice' ? {
        question: '',
        options: [
            { id: '1', text: '', isCorrect: false },
            { id: '2', text: '', isCorrect: false },
            { id: '3', text: '', isCorrect: false },
            { id: '4', text: '', isCorrect: false },
        ]
    } : {};

    const newSlide: Slide = {
      id: Date.now().toString(),
      type,
      content: baseContent
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

  const usesAI = useMemo(() => slides.some(s => s.type === 'long-answer'), [slides]);

  if (isUserLoading || (isLoadingQuiz && !isNewQuiz)) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
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
            <AlertDialogAction onClick={handleDeleteQuiz} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuizPreviewDialog 
        open={isPreviewOpen} 
        onOpenChange={setIsPreviewOpen} 
        title={title} 
        creator={creator} 
        slides={slides} 
      />

      <header className="bg-background border-b p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4 flex-1">
          <Button variant="ghost" size="icon" onClick={() => router.push('/workspace')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <Input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="h-7 text-lg font-bold border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent" 
            />
            <span className="text-xs text-muted-foreground flex items-center gap-1">
                von {creator} • {saveStatus === 'saving' ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3"/>}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(true)}>
            <Play className="mr-2 h-4 w-4" /> Vorschau
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost"><Plus className="h-5 w-5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Folie hinzufügen</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => addSlide('multiple-choice')}>Mehrfachauswahl</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addSlide('short-answer')}>Kurzantwort (1 Wort)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addSlide('long-answer')}>Freitext (KI-gestützt)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addSlide('vocabulary')}>Vokabel-Test</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addSlide('text')}>Textfolie</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost"><MoreHorizontal className="h-5 w-5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Quiz löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {slides.map((slide, index) => (
            <Card key={slide.id} className={slide.type === 'welcome' ? 'border-primary shadow-sm' : ''}>
              <CardHeader className="flex flex-row items-start justify-between pb-4">
                <div className="flex items-center gap-3">
                  <Badge variant={slide.type === 'welcome' ? 'default' : 'secondary'} className="h-6 w-6 rounded-full flex items-center justify-center p-0 font-bold">
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
                    {slide.type === 'welcome' && <CardDescription>Der erste Eindruck für deine Teilnehmer.</CardDescription>}
                  </div>
                </div>
                {slide.id !== 'welcome' && (
                  <Button variant="ghost" size="icon" onClick={() => deleteSlide(slide.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {slide.type === 'welcome' && (
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/30">
                            <div className="space-y-0.5">
                                <Label className="text-base">Namen abfragen</Label>
                                <p className="text-xs text-muted-foreground">Teilnehmer müssen ihren Namen angeben.</p>
                            </div>
                            <Switch 
                                checked={slide.content.askName} 
                                onCheckedChange={(val) => updateSlideContent(slide.id, { askName: val })} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Zusatz-Text (optional)</Label>
                            <Textarea 
                                placeholder="z.B. Viel Erfolg! Du hast 10 Minuten Zeit." 
                                value={slide.content.subtitle || ''} 
                                onChange={(e) => updateSlideContent(slide.id, { subtitle: e.target.value })}
                                className="min-h-[100px]"
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl bg-background/50 text-center space-y-4">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold">{title || 'Unbenanntes Quiz'}</h2>
                            <p className="text-sm text-muted-foreground">Erstellt von {creator || 'Anonym'}</p>
                        </div>
                        
                        <div className="flex flex-wrap justify-center gap-2">
                            <Badge variant="outline" className="bg-background">
                                {slide.content.askName ? <User className="w-3 h-3 mr-1" /> : null}
                                {slide.content.askName ? 'Name erforderlich' : 'Anonymes Quiz'}
                            </Badge>
                            {usesAI && (
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                    <Sparkles className="w-3 h-3 mr-1" /> KI-gestützt
                                </Badge>
                            )}
                        </div>

                        {slide.content.subtitle && (
                            <p className="text-sm italic text-muted-foreground max-w-[250px] line-clamp-3">
                                "{slide.content.subtitle}"
                            </p>
                        )}

                        <Button className="w-full max-w-[200px]" variant="secondary" disabled>
                            Quiz starten
                        </Button>
                    </div>
                  </div>
                )}

                {slide.type === 'multiple-choice' && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-base font-bold">Frage</Label>
                            <Input 
                                placeholder="z.B. Wie viele Planeten hat unser Sonnensystem?" 
                                value={slide.content.question || ''} 
                                onChange={(e) => updateSlideContent(slide.id, { question: e.target.value })}
                                className="text-lg py-6"
                            />
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label className="font-semibold">Antworten (Markiere die richtigen)</Label>
                                <span className="text-xs text-muted-foreground">{slide.content.options?.length || 0} von 8</span>
                            </div>
                            <div className="grid gap-3">
                                {(slide.content.options || []).map((option: any, optIndex: number) => (
                                    <div key={option.id} className="flex items-center gap-2 group">
                                        <div className="flex items-center justify-center h-10 w-10">
                                            <Checkbox 
                                                id={`opt-${slide.id}-${option.id}`}
                                                checked={option.isCorrect} 
                                                onCheckedChange={(val) => {
                                                    const currentCorrect = slide.content.options.filter((o: any) => o.isCorrect).length;
                                                    const maxCorrect = Math.floor(slide.content.options.length * 0.9);
                                                    
                                                    if (val === true && currentCorrect >= maxCorrect) {
                                                        toast({
                                                            variant: 'destructive',
                                                            title: 'Zu viele richtige Antworten',
                                                            description: `Bei ${slide.content.options.length} Optionen dürfen maximal ${maxCorrect} richtig sein.`,
                                                        });
                                                        return;
                                                    }

                                                    const newOptions = [...slide.content.options];
                                                    newOptions[optIndex].isCorrect = !!val;
                                                    updateSlideContent(slide.id, { options: newOptions });
                                                }}
                                                className="h-6 w-6"
                                            />
                                        </div>
                                        <Input 
                                            placeholder={`Antwort ${optIndex + 1}...`}
                                            value={option.text}
                                            onChange={(e) => {
                                                const newOptions = [...slide.content.options];
                                                newOptions[optIndex].text = e.target.value;
                                                updateSlideContent(slide.id, { options: newOptions });
                                            }}
                                            className={cn("flex-1", option.isCorrect && "border-primary bg-primary/5")}
                                        />
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            disabled={slide.content.options.length <= 2}
                                            onClick={() => {
                                                const newOptions = slide.content.options.filter((_: any, i: number) => i !== optIndex);
                                                updateSlideContent(slide.id, { options: newOptions });
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            {(!slide.content.options || slide.content.options.length < 8) && (
                                <Button 
                                    variant="outline" 
                                    className="w-full border-dashed"
                                    onClick={() => {
                                        const newOptions = [...(slide.content.options || []), { id: Date.now().toString(), text: '', isCorrect: false }];
                                        updateSlideContent(slide.id, { options: newOptions });
                                    }}
                                >
                                    <Plus className="h-4 w-4 mr-2" /> Antwort hinzufügen
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {['short-answer', 'long-answer', 'vocabulary', 'text'].includes(slide.type) && slide.type !== 'multiple-choice' && (
                  <div className="p-12 border-2 border-dashed rounded-lg bg-secondary/10 flex flex-col items-center justify-center text-center">
                    <BrainCircuit className="h-8 w-8 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground font-medium">Editor für Folientyp "{slide.type}" folgt bald.</p>
                    <p className="text-xs text-muted-foreground mt-1">Hier kannst du bald die Logik für diesen Typ einstellen.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

function QuizPreviewDialog({ open, onOpenChange, title, creator, slides }: { open: boolean, onOpenChange: (open: boolean) => void, title: string, creator: string, slides: Slide[] }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userName, setUserName] = useState('');
    const currentSlide = slides[currentIndex];

    useEffect(() => {
        if (open) setCurrentIndex(0);
    }, [open]);

    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const handleBack = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b bg-secondary/20 flex flex-row justify-between items-center space-y-0">
                    <div className="flex flex-col text-left">
                        <DialogTitle className="text-sm font-bold truncate max-w-[200px]">{title}</DialogTitle>
                        <DialogDescription className="text-[10px] text-muted-foreground">Vorschau-Modus</DialogDescription>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-mono">{currentIndex + 1} / {slides.length}</span>
                    </div>
                </DialogHeader>

                <main className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center bg-background">
                    {currentSlide?.type === 'welcome' ? (
                        <div className="text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-300">
                            <div className="space-y-2">
                                <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
                                <p className="text-muted-foreground">von {creator}</p>
                            </div>
                            
                            {currentSlide.content.subtitle && (
                                <Card className="bg-secondary/30 border-none">
                                    <CardContent className="p-4">
                                        <p className="text-sm italic italic text-muted-foreground leading-relaxed">
                                            "{currentSlide.content.subtitle}"
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {currentSlide.content.askName && (
                                <div className="space-y-2 text-left">
                                    <Label>Wie heißt du?</Label>
                                    <Input 
                                        placeholder="Dein Name..." 
                                        value={userName} 
                                        onChange={(e) => setUserName(e.target.value)}
                                        className="text-lg py-6"
                                    />
                                </div>
                            )}

                            <Button 
                                className="w-full text-lg py-6 h-auto font-bold shadow-lg" 
                                size="lg" 
                                onClick={handleNext}
                                disabled={currentSlide.content.askName && !userName.trim()}
                            >
                                Quiz starten
                            </Button>
                        </div>
                    ) : currentSlide?.type === 'multiple-choice' ? (
                        <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right duration-300">
                            <div className="space-y-4">
                                <Badge variant="secondary">Frage {currentIndex}</Badge>
                                <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                                    {currentSlide.content.question || 'Keine Frage eingegeben.'}
                                </h2>
                            </div>

                            <div className="grid gap-3">
                                {(currentSlide.content.options || []).map((opt: any, i: number) => (
                                    <Button 
                                        key={opt.id} 
                                        variant="outline" 
                                        className="justify-start h-auto py-4 px-6 text-left text-base border-2 hover:border-primary hover:bg-primary/5 transition-all"
                                    >
                                        <span className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mr-4 shrink-0 font-bold text-xs">
                                            {String.fromCharCode(65 + i)}
                                        </span>
                                        <span className="flex-1">{opt.text || 'Option...'}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center space-y-4">
                            <BrainCircuit className="h-16 w-16 text-primary mx-auto opacity-20" />
                            <h3 className="text-xl font-bold">Folientyp: {currentSlide?.type}</h3>
                            <p className="text-muted-foreground">Hier folgt bald die interaktive Ansicht.</p>
                        </div>
                    )}
                </main>

                <footer className="p-4 border-t bg-secondary/10 flex justify-between items-center">
                    <Button variant="ghost" onClick={handleBack} disabled={currentIndex === 0}>
                        <ChevronLeft className="mr-2 h-4 w-4" /> Zurück
                    </Button>
                    <div className="h-2 flex-1 mx-8 bg-secondary rounded-full overflow-hidden max-w-[200px] hidden md:block">
                        <div 
                            className="h-full bg-primary transition-all duration-500" 
                            style={{ width: `${((currentIndex + 1) / slides.length) * 100}%` }}
                        />
                    </div>
                    <Button onClick={handleNext} disabled={currentIndex === slides.length - 1}>
                        Weiter <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
}