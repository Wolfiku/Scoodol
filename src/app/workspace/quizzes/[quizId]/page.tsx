'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Plus, MoreHorizontal, Trash2, BrainCircuit, Play, Save, Check, User, Info, Sparkles, MessageSquareText, ChevronRight, ChevronLeft, X, AlertCircle, HelpCircle, Languages, FileText } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { verifyQuizAnswer, checkLongAnswer } from '@/app/actions';
import { useTheme } from '@/hooks/use-theme';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

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
    } : type === 'short-answer' ? {
        question: '',
        answer: '',
        answerType: 'word',
        checkMode: 'helpfull',
    } : type === 'long-answer' ? {
        question: '',
        referenceAnswer: '',
        criteria: '',
        enablePoints: false
    } : type === 'vocabulary' ? {
        checkMode: 'helpfull',
        pairs: [{ id: '1', foreign: '', german: '' }]
    } : type === 'text' ? {
        title: '',
        text: ''
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

  const usesAI = useMemo(() => slides.some(s => s.type === 'long-answer' || (s.type === 'short-answer' && s.content.checkMode === 'ai')), [slides]);

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
            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">von {creator}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                    • {saveStatus === 'saving' ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3"/>}
                </span>
            </div>
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
              <DropdownMenuItem onClick={() => addSlide('short-answer')}>Wort-Antwort</DropdownMenuItem>
              <DropdownMenuItem onClick={() => addSlide('long-answer')}>Freitext (KI)</DropdownMenuItem>
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
                         slide.type === 'short-answer' ? 'Wort-Antwort' :
                         slide.type === 'long-answer' ? 'Freitext (KI)' :
                         slide.type === 'vocabulary' ? 'Vokabel-Test' : 'Textfolie'}
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

                {slide.type === 'short-answer' && (
                    <div className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="font-bold">Frage</Label>
                                    <Input 
                                        placeholder="z.B. Wie heißt die Hauptstadt von Frankreich?" 
                                        value={slide.content.question || ''} 
                                        onChange={(e) => updateSlideContent(slide.id, { question: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">Korrekte Antwort</Label>
                                    <Input 
                                        placeholder="Die exakte Lösung..." 
                                        value={slide.content.answer || ''} 
                                        onChange={(e) => updateSlideContent(slide.id, { answer: e.target.value })}
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-4 p-4 border rounded-lg bg-secondary/10">
                                <div className="space-y-2">
                                    <Label>Antwort-Typ</Label>
                                    <Select value={slide.content.answerType} onValueChange={(val) => updateSlideContent(slide.id, { answerType: val })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="word">Wort</SelectItem>
                                            <SelectItem value="year">Jahreszahl</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {slide.content.answerType === 'word' && (
                                    <div className="space-y-2">
                                        <Label>Prüf-Modus</Label>
                                        <Select value={slide.content.checkMode} onValueChange={(val) => updateSlideContent(slide.id, { checkMode: val })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="strict">Rechtschreib-sensitiv (Exakt)</SelectItem>
                                                <SelectItem value="helpfull">Tolerant (Klein/Groß egal)</SelectItem>
                                                <SelectItem value="ai">KI-Modus (Typo-Check)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {slide.type === 'long-answer' && (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Frage</Label>
                                <Input 
                                    placeholder="z.B. Erkläre den Treibhauseffekt..." 
                                    value={slide.content.question || ''} 
                                    onChange={(e) => updateSlideContent(slide.id, { question: e.target.value })}
                                />
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-bold">Musterlösung</Label>
                                    <Textarea 
                                        placeholder="Wie die perfekte Antwort aussehen sollte..." 
                                        value={slide.content.referenceAnswer || ''} 
                                        onChange={(e) => updateSlideContent(slide.id, { referenceAnswer: e.target.value })}
                                        className="min-h-[120px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">Bewertungskriterien</Label>
                                    <Textarea 
                                        placeholder="Was muss unbedingt vorkommen? (z.B. Stichworte: CO2, Atmosphäre, Strahlung)" 
                                        value={slide.content.criteria || ''} 
                                        onChange={(e) => updateSlideContent(slide.id, { criteria: e.target.value })}
                                        className="min-h-[120px]"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-primary/5">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Punkte verteilen (1-10)</Label>
                                    <p className="text-xs text-muted-foreground">Die KI bewertet die Antwort auf einer Skala von 1 bis 10.</p>
                                </div>
                                <Switch 
                                    checked={slide.content.enablePoints} 
                                    onCheckedChange={(val) => updateSlideContent(slide.id, { enablePoints: val })} 
                                />
                            </div>
                        </div>
                    </div>
                )}

                {slide.type === 'vocabulary' && (
                    <div className="space-y-6">
                        <Alert className="bg-primary/5 border-primary/20">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Wichtiger Hinweis</AlertTitle>
                            <AlertDescription>
                                Bitte frage immer nur **ein einzelnes Wort** pro Feld ab. Vermeide mehrere Formen (z.B. go, went, gone) in einem Feld, um Fehler bei der Prüfung zu verhindern.
                            </AlertDescription>
                        </Alert>

                        <div className="flex items-center gap-4 p-4 border rounded-lg bg-secondary/10">
                            <div className="flex-1">
                                <Label>Prüf-Modus</Label>
                                <Select value={slide.content.checkMode} onValueChange={(val) => updateSlideContent(slide.id, { checkMode: val })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="strict">Rechtschreib-sensitiv (Exakt)</SelectItem>
                                        <SelectItem value="helpfull">Tolerant (Klein/Groß egal)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="text-right">
                                <Badge variant="secondary" className="font-mono">
                                    {slide.content.pairs?.length || 0} / 20
                                </Badge>
                            </div>
                        </div>

                        <div className="grid gap-3">
                            <div className="grid grid-cols-[1fr_1fr_40px] gap-2 px-2 text-xs font-bold text-muted-foreground">
                                <span>Fremdsprache</span>
                                <span>Deutsch</span>
                                <span></span>
                            </div>
                            {(slide.content.pairs || []).map((pair: any, pIndex: number) => (
                                <div key={pair.id} className="grid grid-cols-[1fr_1fr_40px] gap-2 group">
                                    <Input 
                                        placeholder="Foreign word..."
                                        value={pair.foreign}
                                        onChange={(e) => {
                                            const newPairs = [...slide.content.pairs];
                                            newPairs[pIndex].foreign = e.target.value;
                                            updateSlideContent(slide.id, { pairs: newPairs });
                                        }}
                                    />
                                    <Input 
                                        placeholder="Deutsch..."
                                        value={pair.german}
                                        onChange={(e) => {
                                            const newPairs = [...slide.content.pairs];
                                            newPairs[pIndex].german = e.target.value;
                                            updateSlideContent(slide.id, { pairs: newPairs });
                                        }}
                                    />
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        disabled={slide.content.pairs.length <= 1}
                                        onClick={() => {
                                            const newPairs = slide.content.pairs.filter((_: any, i: number) => i !== pIndex);
                                            updateSlideContent(slide.id, { pairs: newPairs });
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        {(!slide.content.pairs || slide.content.pairs.length < 20) && (
                            <Button 
                                variant="outline" 
                                className="w-full border-dashed"
                                onClick={() => {
                                    const newPairs = [...(slide.content.pairs || []), { id: Date.now().toString(), foreign: '', german: '' }];
                                    updateSlideContent(slide.id, { pairs: newPairs });
                                }}
                            >
                                <Plus className="h-4 w-4 mr-2" /> Vokabel hinzufügen
                            </Button>
                        )}
                    </div>
                )}

                {slide.type === 'text' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                        <Label className="font-bold">Überschrift</Label>
                        <Input 
                            placeholder="z.B. Einleitung oder Informationen" 
                            value={slide.content.title || ''} 
                            onChange={(e) => updateSlideContent(slide.id, { title: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="font-bold">Text</Label>
                        <Textarea 
                            placeholder="Schreibe hier die Informationen für die Teilnehmer..." 
                            value={slide.content.text || ''} 
                            onChange={(e) => updateSlideContent(slide.id, { text: e.target.value })}
                            className="min-h-[200px]"
                        />
                    </div>
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
    const [userAnswer, setUserAnswer] = useState('');
    const [vocabAnswers, setVocabAnswers] = useState<Record<string, string>>({});
    const [vocabResults, setVocabResults] = useState<Record<string, boolean>>({});
    const [answerStatus, setAnswerStatus] = useState<'none' | 'correct' | 'incorrect' | 'checking'>('none');
    const [aiFeedback, setAiFeedback] = useState<string | null>(null);
    const [aiScore, setAiScore] = useState<number | null>(null);
    const [selectedMcOption, setSelectedMcOption] = useState<string | null>(null);
    const currentSlide = slides[currentIndex];
    const { aiLanguage } = useTheme();

    useEffect(() => {
        if (open) {
            setCurrentIndex(0);
            setAnswerStatus('none');
            setUserAnswer('');
            setSelectedMcOption(null);
            setAiFeedback(null);
            setAiScore(null);
            setVocabAnswers({});
            setVocabResults({});
        }
    }, [open]);

    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setAnswerStatus('none');
            setUserAnswer('');
            setSelectedMcOption(null);
            setAiFeedback(null);
            setAiScore(null);
            setVocabAnswers({});
            setVocabResults({});
        }
    };

    const handleBack = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setAnswerStatus('none');
            setUserAnswer('');
            setSelectedMcOption(null);
            setAiFeedback(null);
            setAiScore(null);
            setVocabAnswers({});
            setVocabResults({});
        }
    };

    const normalizeText = (text: string) => {
        return text.trim().toLowerCase().replace(/ss/g, 'ß').replace(/\s+/g, ' ');
    }

    const checkShortAnswer = async () => {
        if (!userAnswer.trim()) return;
        setAnswerStatus('checking');

        const { answer, answerType, checkMode, question } = currentSlide.content;
        const normalizedCorrect = normalizeText(answer);
        const normalizedUser = normalizeText(userAnswer);

        let isCorrect = false;

        if (answerType === 'year') {
            isCorrect = userAnswer.trim() === answer.trim();
        } else {
            if (checkMode === 'strict') {
                isCorrect = userAnswer.trim() === answer.trim();
            } else if (checkMode === 'helpfull') {
                isCorrect = normalizedUser === normalizedCorrect;
            } else if (checkMode === 'ai') {
                if (normalizedUser === normalizedCorrect) {
                    isCorrect = true;
                } else {
                    const result = await verifyQuizAnswer(question, answer, userAnswer, aiLanguage);
                    isCorrect = result.isCorrect;
                }
            }
        }

        setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    }

    const checkLongAnswerAction = async () => {
        if (!userAnswer.trim()) return;
        setAnswerStatus('checking');

        const { question, referenceAnswer, criteria } = currentSlide.content;
        const result = await checkLongAnswer(question, referenceAnswer, criteria, userAnswer, aiLanguage);
        
        setAiScore(result.score);
        setAiFeedback(result.feedback);
        setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
    }

    const checkVocabulary = () => {
        const { pairs, checkMode } = currentSlide.content;
        const results: Record<string, boolean> = {};
        let allCorrect = true;

        pairs.forEach((pair: any) => {
            const userVal = vocabAnswers[pair.id] || '';
            const correctVal = pair.german;
            
            let isCorrect = false;
            if (checkMode === 'strict') {
                isCorrect = userVal.trim() === correctVal.trim();
            } else {
                isCorrect = normalizeText(userVal) === normalizeText(correctVal);
            }
            
            results[pair.id] = isCorrect;
            if (!isCorrect) allCorrect = false;
        });

        setVocabResults(results);
        setAnswerStatus(allCorrect ? 'correct' : 'incorrect');
    }

    const handleMcSelect = (optionId: string) => {
        if (answerStatus !== 'none') return;
        setSelectedMcOption(optionId);
        
        const option = currentSlide.content.options.find((o: any) => o.id === optionId);
        setAnswerStatus(option.isCorrect ? 'correct' : 'incorrect');
    }

    const correctMcOptions = useMemo(() => {
        if (currentSlide?.type !== 'multiple-choice') return [];
        return currentSlide.content.options.filter((o: any) => o.isCorrect);
    }, [currentSlide]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden">
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
                                        <p className="text-sm italic text-muted-foreground leading-relaxed">
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
                                {(currentSlide.content.options || []).map((opt: any, i: number) => {
                                    const isSelected = selectedMcOption === opt.id;
                                    const isCorrect = opt.isCorrect;
                                    
                                    let btnVariant: "outline" | "default" | "destructive" = "outline";
                                    if (answerStatus !== 'none') {
                                        if (isCorrect) btnVariant = "default";
                                        else if (isSelected && !isCorrect) btnVariant = "destructive";
                                    }

                                    return (
                                        <Button 
                                            key={opt.id} 
                                            variant={btnVariant}
                                            disabled={answerStatus !== 'none'}
                                            onClick={() => handleMcSelect(opt.id)}
                                            className={cn(
                                                "justify-start h-auto py-4 px-6 text-left text-base border-2 transition-all",
                                                btnVariant === "outline" && "hover:border-primary hover:bg-primary/5",
                                                btnVariant === "default" && "bg-green-600 hover:bg-green-600 text-white border-green-700",
                                                btnVariant === "destructive" && "bg-red-600 hover:bg-red-600 text-white border-red-700"
                                            )}
                                        >
                                            <span className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mr-4 shrink-0 font-bold text-xs">
                                                {String.fromCharCode(65 + i)}
                                            </span>
                                            <span className="flex-1">{opt.text || 'Option...'}</span>
                                            {answerStatus !== 'none' && isCorrect && <Check className="ml-2 h-5 w-5" />}
                                            {answerStatus !== 'none' && isSelected && !isCorrect && <X className="ml-2 h-5 w-5" />}
                                        </Button>
                                    );
                                })}
                            </div>

                            {answerStatus === 'correct' && (
                                <div className="p-4 bg-green-100 text-green-800 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
                                    <Check className="h-6 w-6" />
                                    <p className="font-bold">Super! Das ist richtig.</p>
                                </div>
                            )}
                            {answerStatus === 'incorrect' && (
                                <div className="p-4 bg-red-100 text-red-800 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
                                    <AlertCircle className="h-6 w-6" />
                                    <div>
                                        <p className="font-bold">Leider falsch.</p>
                                        <p className="text-sm">Richtig wäre: {correctMcOptions.map((o: any) => o.text).join(", ")}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : currentSlide?.type === 'short-answer' ? (
                        <div className="w-full max-w-xl space-y-8 animate-in slide-in-from-right duration-300">
                            <div className="space-y-4">
                                <Badge variant="secondary">Frage {currentIndex}</Badge>
                                <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                                    {currentSlide.content.question || 'Keine Frage eingegeben.'}
                                </h2>
                            </div>

                            <div className="space-y-4 min-h-[160px]">
                                <div className="relative">
                                    <Input 
                                        type={currentSlide.content.answerType === 'year' ? 'number' : 'text'}
                                        placeholder="Deine Antwort hier tippen..." 
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        disabled={answerStatus !== 'none' && answerStatus !== 'checking'}
                                        className={cn(
                                            "text-xl py-8 px-6",
                                            answerStatus === 'correct' && "border-green-500 bg-green-50 focus-visible:ring-green-500",
                                            answerStatus === 'incorrect' && "border-red-500 bg-red-50 focus-visible:ring-red-500"
                                        )}
                                        onKeyDown={(e) => e.key === 'Enter' && answerStatus === 'none' && checkShortAnswer()}
                                    />
                                    {answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
                                    {answerStatus === 'correct' && <Check className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600 h-8 w-8" />}
                                    {answerStatus === 'incorrect' && <X className="absolute right-4 top-1/2 -translate-y-1/2 text-red-600 h-8 w-8" />}
                                </div>

                                <div className="min-h-[60px] flex items-center justify-center">
                                    {answerStatus === 'none' && (
                                        <Button className="w-full" size="lg" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>
                                            Antwort prüfen
                                        </Button>
                                    )}

                                    {answerStatus === 'correct' && (
                                        <div className="text-center text-green-600 font-bold animate-in zoom-in">
                                            Richtig! Gut gemacht.
                                        </div>
                                    )}

                                    {answerStatus === 'incorrect' && (
                                        <div className="p-4 bg-red-100 text-red-800 rounded-lg space-y-1 animate-in fade-in w-full">
                                            <p className="font-bold">Nicht ganz richtig.</p>
                                            <p className="text-sm">Die korrekte Antwort lautet: <span className="font-mono bg-white/50 px-1 rounded">{currentSlide.content.answer}</span></p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : currentSlide?.type === 'long-answer' ? (
                        <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right duration-300">
                            <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <Badge variant="secondary">Freitext {currentIndex}</Badge>
                                    {currentSlide.content.enablePoints && aiScore !== null && (
                                        <Badge className="text-lg py-1 px-3 bg-primary text-primary-foreground">
                                            {aiScore} / 10 Punkte
                                        </Badge>
                                    )}
                                </div>
                                <h2 className="text-2xl md:text-3xl font-bold leading-tight">
                                    {currentSlide.content.question || 'Keine Frage eingegeben.'}
                                </h2>
                            </div>

                            <div className="space-y-4 min-h-[300px]">
                                <div className="relative">
                                    <Textarea 
                                        placeholder="Deine ausführliche Antwort hier schreiben..." 
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        disabled={answerStatus !== 'none' && answerStatus !== 'checking'}
                                        className={cn(
                                            "text-lg p-6 min-h-[180px] transition-all",
                                            answerStatus === 'correct' && "border-green-500 bg-green-50",
                                            answerStatus === 'incorrect' && "border-amber-500 bg-amber-50"
                                        )}
                                    />
                                    {answerStatus === 'checking' && (
                                        <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center rounded-md animate-in fade-in">
                                            <Loader2 className="animate-spin text-primary h-8 w-8 mb-2" />
                                            <p className="text-sm font-medium">KI bewertet deine Antwort...</p>
                                        </div>
                                    )}
                                </div>

                                <div className="min-h-[80px]">
                                    {answerStatus === 'none' && (
                                        <Button className="w-full" size="lg" onClick={checkLongAnswerAction} disabled={!userAnswer.trim() || userAnswer.length < 5}>
                                            <Sparkles className="w-4 h-4 mr-2" /> Antwort von KI prüfen lassen
                                        </Button>
                                    )}

                                    {answerStatus !== 'none' && answerStatus !== 'checking' && aiFeedback && (
                                        <div className={cn(
                                            "p-4 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2",
                                            answerStatus === 'correct' ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                                        )}>
                                            {answerStatus === 'correct' ? <Check className="h-6 w-6 mt-1 shrink-0" /> : <AlertCircle className="h-6 w-6 mt-1 shrink-0" />}
                                            <div className="space-y-1">
                                                <p className="font-bold">{answerStatus === 'correct' ? 'Gut gemacht!' : 'Fast geschafft.'}</p>
                                                <p className="text-sm leading-relaxed">{aiFeedback}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : currentSlide?.type === 'vocabulary' ? (
                        <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right duration-300">
                            <div className="space-y-4">
                                <Badge variant="secondary">Vokabel-Test {currentIndex}</Badge>
                                <h2 className="text-2xl font-bold">Übersetze die folgenden Begriffe</h2>
                            </div>

                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                {(currentSlide.content.pairs || []).map((pair: any) => (
                                    <div key={pair.id} className="space-y-1">
                                        <div className="grid grid-cols-[1fr_1fr] items-center gap-4 p-3 bg-secondary/30 rounded-lg">
                                            <span className="font-semibold text-lg">{pair.foreign}</span>
                                            <div className="relative">
                                                <Input 
                                                    placeholder="..." 
                                                    value={vocabAnswers[pair.id] || ''}
                                                    onChange={(e) => setVocabAnswers(prev => ({ ...prev, [pair.id]: e.target.value }))}
                                                    disabled={answerStatus !== 'none'}
                                                    className={cn(
                                                        "bg-background",
                                                        answerStatus !== 'none' && vocabResults[pair.id] === true && "border-green-500 bg-green-50",
                                                        answerStatus !== 'none' && vocabResults[pair.id] === false && "border-red-500 bg-red-50"
                                                    )}
                                                />
                                                {answerStatus !== 'none' && vocabResults[pair.id] === true && <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />}
                                                {answerStatus !== 'none' && vocabResults[pair.id] === false && <X className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-red-600" />}
                                            </div>
                                        </div>
                                        {answerStatus !== 'none' && vocabResults[pair.id] === false && (
                                            <p className="text-xs text-red-600 px-3 font-medium">Richtig wäre: {pair.german}</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4">
                                {answerStatus === 'none' ? (
                                    <Button className="w-full" size="lg" onClick={checkVocabulary}>
                                        Vokabeln prüfen
                                    </Button>
                                ) : (
                                    <div className={cn(
                                        "p-4 rounded-lg flex items-center justify-center gap-3 font-bold",
                                        answerStatus === 'correct' ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                                    )}>
                                        {answerStatus === 'correct' ? (
                                            <><Check className="h-6 w-6" /> Alle Vokabeln korrekt!</>
                                        ) : (
                                            <><AlertCircle className="h-6 w-6" /> Einige Fehler gefunden.</>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : currentSlide?.type === 'text' ? (
                        <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right duration-300">
                            <div className="space-y-4 text-center md:text-left">
                                <Badge variant="secondary"><FileText className="w-3 h-3 mr-1" /> Info</Badge>
                                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                                    {currentSlide.content.title || 'Keine Überschrift'}
                                </h2>
                            </div>
                            
                            <Card className="bg-secondary/10 border-none">
                                <CardContent className="p-6 md:p-10">
                                    <p className="text-lg md:text-xl text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                        {currentSlide.content.text || 'Kein Text eingegeben.'}
                                    </p>
                                </CardContent>
                            </Card>
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
                    <Button 
                        onClick={handleNext} 
                        disabled={currentIndex === slides.length - 1 || (currentSlide?.type !== 'welcome' && currentSlide?.type !== 'text' && (answerStatus === 'none' || answerStatus === 'checking'))}
                    >
                        Weiter <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
}
