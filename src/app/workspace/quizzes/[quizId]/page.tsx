
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Plus, MoreHorizontal, Trash2, BrainCircuit, Play, Save, Check, User, Info, Sparkles, MessageSquareText, ChevronRight, ChevronLeft, X, AlertCircle, HelpCircle, FileText, BarChart3, Frown, Meh, Smile, ArrowUp, ArrowDown, Globe, Copy, Link as LinkIcon, Shield, CheckCircle2, Star, QrCode, Download } from 'lucide-react';
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
import QRCode from 'qrcode';

type SlideType = 'welcome' | 'multiple-choice' | 'short-answer' | 'long-answer' | 'vocabulary' | 'text' | 'conclusion';

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
  isPublished?: boolean;
  createdAt: any;
  updatedAt: any;
};

type Response = {
    id: string;
    userName: string;
    answers: Record<string, any>;
    percentage: number;
    rating?: 'sad' | 'neutral' | 'happy';
    completedAt: any;
}

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
    { id: 'welcome', type: 'welcome', content: { title: 'Willkommen zum Quiz', subtitle: '', askName: false } },
    { id: 'conclusion', type: 'conclusion', content: { showScore: true, showComparison: false, collectFeedback: true } }
  ]);
  const [isPublished, setIsPublished] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSetupDone, setIsSetupDone] = useState(!isNewQuiz);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // QR Code State
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

  const quizDocRef = useMemoFirebase(() => 
    !isNewQuiz && user && typeof quizId === 'string'
      ? doc(firestore, `users/${user.uid}/quizzes`, quizId)
      : null
  , [firestore, user, quizId, isNewQuiz]);

  const { data: quiz, isLoading: isLoadingQuiz } = useDoc<Quiz>(quizDocRef);
  
  const responsesRef = useMemoFirebase(() => 
    !isNewQuiz && user ? collection(firestore, `users/${user.uid}/quizzes/${quizId}/responses`) : null
  , [firestore, user, quizId, isNewQuiz]);
  const responsesQuery = useMemoFirebase(() => responsesRef ? query(responsesRef, orderBy('completedAt', 'desc')) : null, [responsesRef]);
  const { data: responses, isLoading: isLoadingResponses } = useCollection<Response>(responsesQuery);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (quiz) {
      setTitle(quiz.title);
      setCreator(quiz.creator);
      setSlides(quiz.slides || []);
      setIsPublished(!!quiz.isPublished);
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
          isPublished: false,
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
          isPublished,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      setSaveStatus('idle');
    } catch (error) {
      setSaveStatus('dirty');
    }
  }, [firestore, user, title, creator, slides, isPublished, isNewQuiz, quizDocRef, router]);

  useEffect(() => {
    if (isLoadingQuiz || !isSetupDone) return;
    
    const hasChanges = quiz 
        ? (title !== quiz.title || creator !== quiz.creator || JSON.stringify(slides) !== JSON.stringify(quiz.slides) || isPublished !== quiz.isPublished)
        : (title.trim() !== '' && creator.trim() !== '');

    if (hasChanges) {
      setSaveStatus('dirty');
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(handleSave, 2000);
    }

    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [title, creator, slides, isPublished, quiz, isLoadingQuiz, isSetupDone, handleSave]);

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
    } : type === 'conclusion' ? {
        showScore: true,
        showComparison: false,
        collectFeedback: true
    } : {};

    const newSlide: Slide = {
      id: Date.now().toString(),
      type,
      content: baseContent
    };

    setSlides(prev => {
        const conclusionIndex = prev.findIndex(s => s.type === 'conclusion');
        if (conclusionIndex !== -1) {
            const newSlides = [...prev];
            newSlides.splice(conclusionIndex, 0, newSlide);
            return newSlides;
        }
        return [...prev, newSlide];
    });

    toast({ title: 'Folie hinzugefügt' });
  };

  const deleteSlide = (id: string) => {
    if (id === 'welcome' || id === 'conclusion') return;
    setSlides(slides.filter(s => s.id !== id));
  };

  const moveSlide = (id: string, direction: 'up' | 'down') => {
    const index = slides.findIndex(s => s.id === id);
    if (index <= 0 || index >= slides.length - 1) return;

    const newSlides = [...slides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex <= 0 || targetIndex >= slides.length - 1) return;

    [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
    setSlides(newSlides);
  };

  const handleDeleteQuiz = async () => {
    if (isNewQuiz || !quizDocRef) return;
    await deleteDoc(quizDocRef);
    toast({ title: 'Quiz gelöscht' });
    router.push('/workspace');
  };

  const togglePublish = () => {
    setIsPublished(!isPublished);
    toast({
        title: !isPublished ? "Quiz veröffentlicht!" : "Quiz offline genommen",
        description: !isPublished ? "Dein Quiz ist jetzt über den Link erreichbar." : "Der öffentliche Zugriff wurde deaktiviert."
    });
  }

  const publicUrl = useMemo(() => {
    if (typeof window === 'undefined' || !user || !quizId) return '';
    return `${window.location.origin}/public/quiz/${user.uid}/${quizId}`;
  }, [user, quizId]);

  const copyPublicLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Link kopiert!", description: "Du kannst ihn jetzt teilen." });
  }
  
  const handleShowQr = async () => {
    try {
        const url = await QRCode.toDataURL(publicUrl, {
            width: 400,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
        });
        setQrCodeUrl(url);
        setIsQrDialogOpen(true);
    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Fehler', description: 'QR-Code konnte nicht generiert werden.' });
    }
  };

  const downloadQr = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `quiz-qr-${title.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <Button className="w-full" disabled={!title.trim() || !creator.trim()} onClick={() => setIsSetupDone(true)}>Editor starten</Button>
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

      <QuizPreviewDialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen} title={title} creator={creator} slides={slides} />
      
      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>QR-Code für dein Quiz</DialogTitle>
                <DialogDescription>Teile diesen Code, damit andere dein Quiz scannen und starten können.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center p-6 gap-4">
                {qrCodeUrl && (
                    <div className="bg-white p-4 rounded-lg shadow-sm border">
                        <img src={qrCodeUrl} alt="Quiz QR Code" className="w-64 h-64" />
                    </div>
                )}
                <Button onClick={downloadQr} className="w-full"><Download className="mr-2 h-4 w-4" /> Herunterladen (.png)</Button>
            </div>
        </DialogContent>
      </Dialog>

      <header className="bg-background border-b p-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <Button variant="ghost" size="icon" onClick={() => router.push('/workspace')}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex flex-col">
            <Input value={title} onChange={e => setTitle(e.target.value)} className="h-7 text-lg font-bold border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent" />
            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">von {creator}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">• {saveStatus === 'saving' ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3"/>}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant={isPublished ? "secondary" : "default"} size="sm" onClick={togglePublish}><Globe className="mr-2 h-4 w-4" /> {isPublished ? 'Veröffentlicht' : 'Veröffentlichen'}</Button>
          <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(true)}><Play className="mr-2 h-4 w-4" /> Vorschau</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><Plus className="h-5 w-5" /></Button></DropdownMenuTrigger>
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
            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Quiz löschen</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {isPublished && (
          <div className="bg-background border-b p-3 flex flex-wrap items-center justify-center gap-4 animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                  <div className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></div>
                  <span className="text-sm font-bold">Quiz ist LIVE</span>
              </div>
              <Separator orientation="vertical" className="h-6 hidden md:block" />
              <div className="flex items-center gap-2 text-xs font-mono bg-secondary/50 px-3 py-1.5 rounded-md border"><LinkIcon className="h-3 w-3 text-muted-foreground" /><span className="truncate max-w-[300px]">{publicUrl}</span></div>
              <div className="flex items-center gap-2"><Button variant="outline" className="h-8 text-xs" onClick={copyPublicLink}><Copy className="mr-2 h-3 w-3" /> Kopieren</Button><Button variant="outline" className="h-8 text-xs" onClick={handleShowQr}><QrCode className="mr-2 h-3 w-3" /> QR-Code</Button></div>
          </div>
      )}

      <main className="flex-1 overflow-auto p-4 md:p-8">
        {isPublished && responses && responses.length > 0 ? (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-primary/5 border-primary/20"><CardHeader className="pb-2"><CardDescription className="uppercase tracking-wider font-bold text-[10px]">Teilnehmer</CardDescription><CardTitle className="text-4xl">{responses.length}</CardTitle></CardHeader></Card>
                    <Card className="bg-accent/5 border-accent/20"><CardHeader className="pb-2"><CardDescription className="uppercase tracking-wider font-bold text-[10px]">Durchschnitt</CardDescription><CardTitle className="text-4xl">{Math.round(responses.reduce((acc, r) => acc + r.percentage, 0) / responses.length)}%</CardTitle></CardHeader></Card>
                    <Card className="bg-secondary/50 border-border"><CardHeader className="pb-2"><CardDescription className="uppercase tracking-wider font-bold text-[10px]">Letzte Antwort</CardDescription><CardTitle className="text-xl truncate">{responses[0].userName || 'Anonym'}</CardTitle></CardHeader></Card>
                </div>

                <div className="space-y-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" /> Auswertung pro Frage</h2>
                    {slides.filter(s => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').map((slide, sIdx) => {
                        const slideResponses = responses.map(r => r.answers[slide.id]);
                        return (
                            <Card key={slide.id}>
                                <CardHeader className="pb-4"><Badge variant="outline" className="mb-2 w-fit">Frage {sIdx + 1} ({slide.type})</Badge><CardTitle className="text-lg">{slide.content.question || 'Quiz-Aufgabe'}</CardTitle></CardHeader>
                                <CardContent>
                                    {slide.type === 'multiple-choice' && (
                                        <div className="space-y-3">
                                            {slide.content.options.map((opt: any) => {
                                                const count = slideResponses.filter(r => r === opt.id).length;
                                                const perc = responses.length > 0 ? Math.round((count / responses.length) * 100) : 0;
                                                return (
                                                    <div key={opt.id} className="space-y-1">
                                                        <div className="flex justify-between text-sm"><span className={cn("font-medium", opt.isCorrect && "text-green-600 flex items-center gap-1")}>{opt.isCorrect && <CheckCircle2 className="h-3 w-3"/>} {opt.text}</span><span className="text-muted-foreground">{count} ({perc}%)</span></div>
                                                        <div className="h-2 bg-secondary rounded-full overflow-hidden"><div className={cn("h-full transition-all duration-1000", opt.isCorrect ? "bg-green-500" : "bg-primary/40")} style={{ width: `${perc}%` }} /></div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {(slide.type === 'short-answer' || slide.type === 'vocabulary') && (
                                        <div className="flex items-center gap-8 p-4 bg-secondary/30 rounded-lg">
                                            <div className="text-center"><p className="text-3xl font-bold text-green-600">{slideResponses.filter(r => r && (typeof r === 'boolean' ? r : r.isCorrect)).length}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">Richtig</p></div>
                                            <div className="text-center border-l pl-8"><p className="text-3xl font-bold text-red-600">{slideResponses.filter(r => r === false || (r && r.isCorrect === false)).length}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">Falsch</p></div>
                                        </div>
                                    )}
                                    {slide.type === 'long-answer' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2"><Star className="h-4 w-4 text-amber-500 fill-amber-500" /><span className="text-sm font-bold">Durchschnittlicher KI-Score:</span><Badge className="bg-primary">{(slideResponses.reduce((acc, r) => acc + (r?.score || 0), 0) / responses.length).toFixed(1)} / 10</Badge></div>
                                            <ScrollArea className="h-32 bg-secondary/20 p-3 rounded-md border"><div className="space-y-3">{responses.map((r, i) => (<div key={i} className="text-xs border-b pb-2 last:border-0"><p className="font-bold text-primary">{r.userName || 'Anonym'}:</p><p className="italic line-clamp-2">"{r.answers[slide.id]?.text}"</p></div>))}</div></ScrollArea>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}

                    <h2 className="text-2xl font-bold flex items-center gap-2 pt-8"><MessageSquareText className="h-6 w-6 text-primary" /> Teilnehmer-Feedback</h2>
                    <Card><CardContent className="p-8 flex justify-around items-center"><div className="text-center space-y-2"><Smile className="h-12 w-12 text-green-500 mx-auto" /><p className="text-2xl font-bold">{responses.filter(r => r.rating === 'happy').length}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">SUPER</p></div><div className="text-center space-y-2 border-x px-12"><Meh className="h-12 w-12 text-amber-500 mx-auto" /><p className="text-2xl font-bold">{responses.filter(r => r.rating === 'neutral').length}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">OKAY</p></div><div className="text-center space-y-2"><Frown className="h-12 w-12 text-red-500 mx-auto" /><p className="text-2xl font-bold">{responses.filter(r => r.rating === 'sad').length}</p><p className="text-[10px] uppercase font-bold text-muted-foreground">SCHLECHT</p></div></CardContent></Card>
                </div>
                <div className="flex justify-center pt-8"><Button variant="outline" onClick={() => setIsPublished(false)}>Editor-Modus reaktivieren</Button></div>
            </div>
        ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {slides.map((slide, index) => (
                <Card key={slide.id} className={slide.type === 'welcome' || slide.type === 'conclusion' ? 'border-primary shadow-sm' : ''}>
                  <CardHeader className="flex flex-row items-start justify-between pb-4">
                    <div className="flex items-center gap-3">
                      <Badge variant={slide.type === 'welcome' || slide.type === 'conclusion' ? 'default' : 'secondary'} className="h-6 w-6 rounded-full flex items-center justify-center p-0 font-bold">{index + 1}</Badge>
                      <div><CardTitle className="text-lg">{slide.type === 'welcome' ? 'Willkommens-Seite' : slide.type === 'multiple-choice' ? 'Mehrfachauswahl' : slide.type === 'short-answer' ? 'Wort-Antwort' : slide.type === 'long-answer' ? 'Freitext (KI)' : slide.type === 'vocabulary' ? 'Vokabel-Test' : slide.type === 'conclusion' ? 'Schlussfolie' : 'Textfolie'}</CardTitle></div>
                    </div>
                    <div className="flex items-center gap-1">
                      {slide.id !== 'welcome' && slide.id !== 'conclusion' && (
                        <><div className="flex items-center border rounded-md mr-2 bg-secondary/30"><Button variant="ghost" size="icon" className="h-8 w-8" disabled={index === 1} onClick={() => moveSlide(slide.id, 'up')}><ArrowUp className="h-4 w-4" /></Button><Separator orientation="vertical" className="h-4" /><Button variant="ghost" size="icon" className="h-8 w-8" disabled={index === slides.length - 2} onClick={() => moveSlide(slide.id, 'down')}><ArrowDown className="h-4 w-4" /></Button></div><Button variant="ghost" size="icon" onClick={() => deleteSlide(slide.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button></>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {slide.type === 'welcome' && (
                      <div className="grid md:grid-cols-2 gap-8"><div className="space-y-6"><div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/30"><div className="space-y-0.5"><Label className="text-base">Namen abfragen</Label><p className="text-xs text-muted-foreground">Teilnehmer müssen ihren Namen angeben.</p></div><Switch checked={slide.content.askName} onCheckedChange={(val) => updateSlideContent(slide.id, { askName: val })} /></div><div className="space-y-2"><Label>Zusatz-Text (optional)</Label><Textarea placeholder="z.B. Viel Erfolg!" value={slide.content.subtitle || ''} onChange={(e) => updateSlideContent(slide.id, { subtitle: e.target.value })} className="min-h-[100px]" /></div></div><div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl bg-background/50 text-center space-y-4"><h2 className="text-2xl font-bold">{title || 'Unbenanntes Quiz'}</h2><p className="text-sm text-muted-foreground">Erstellt von {creator || 'Anonym'}</p><div className="flex flex-wrap justify-center gap-2"><Badge variant="outline" className="bg-background">{slide.content.askName ? <User className="w-3.5 h-3.5 mr-1" /> : <Shield className="w-3.5 h-3.5 mr-1" />}{slide.content.askName ? 'Name erforderlich' : 'Anonymes Quiz'}</Badge>{usesAI && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20"><Sparkles className="w-3.5 h-3.5 mr-1" /> KI-gestützt</Badge>}</div><Button className="w-full max-w-[200px]" variant="secondary" disabled>Quiz starten</Button></div></div>
                    )}
                    {slide.type === 'multiple-choice' && (
                        <div className="space-y-6"><div className="space-y-2"><Label className="text-base font-bold">Frage</Label><Input placeholder="Frage eingeben..." value={slide.content.question || ''} onChange={(e) => updateSlideContent(slide.id, { question: e.target.value })} className="text-lg py-6" /></div><div className="grid gap-3">{(slide.content.options || []).map((option: any, optIndex: number) => (<div key={option.id} className="flex items-center gap-2 group"><Checkbox checked={option.isCorrect} onCheckedChange={(val) => { const newOptions = [...slide.content.options]; newOptions[optIndex].isCorrect = !!val; updateSlideContent(slide.id, { options: newOptions }); }} /><Input placeholder={`Antwort ${optIndex + 1}...`} value={option.text} onChange={(e) => { const newOptions = [...slide.content.options]; newOptions[optIndex].text = e.target.value; updateSlideContent(slide.id, { options: newOptions }); }} className={cn("flex-1", option.isCorrect && "border-primary bg-primary/5")} /><Button variant="ghost" size="icon" disabled={slide.content.options.length <= 2} onClick={() => { const newOptions = slide.content.options.filter((_: any, i: number) => i !== optIndex); updateSlideContent(slide.id, { options: newOptions }); }}><Trash2 className="h-4 w-4" /></Button></div>))}{slide.content.options.length < 8 && (<Button variant="outline" className="w-full border-dashed" onClick={() => { const newOptions = [...slide.content.options, { id: Date.now().toString(), text: '', isCorrect: false }]; updateSlideContent(slide.id, { options: newOptions }); }}><Plus className="h-4 w-4 mr-2" /> Antwort hinzufügen</Button>)}</div></div>
                    )}
                    {slide.type === 'short-answer' && (
                        <div className="space-y-6"><div className="grid md:grid-cols-2 gap-6"><div className="space-y-4"><Label className="font-bold">Frage</Label><Input placeholder="Frage..." value={slide.content.question || ''} onChange={(e) => updateSlideContent(slide.id, { question: e.target.value })} /><Label className="font-bold">Korrekte Antwort</Label><Input placeholder="Die Lösung..." value={slide.content.answer || ''} onChange={(e) => updateSlideContent(slide.id, { answer: e.target.value })} /></div><div className="space-y-4 p-4 border rounded-lg bg-secondary/10"><Label>Prüf-Modus</Label><Select value={slide.content.checkMode} onValueChange={(val) => updateSlideContent(slide.id, { checkMode: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="strict">Exakt</SelectItem><SelectItem value="helpfull">Tolerant (Groß/Klein egal)</SelectItem><SelectItem value="ai">KI-Modus</SelectItem></SelectContent></Select></div></div></div>
                    )}
                    {slide.type === 'long-answer' && (
                        <div className="space-y-6"><Label className="font-bold flex items-center gap-2"><Sparkles className="w-4 h-4" /> Frage</Label><Input placeholder="Frage..." value={slide.content.question || ''} onChange={(e) => updateSlideContent(slide.id, { question: e.target.value })} /><div className="grid md:grid-cols-2 gap-4"><div className="space-y-2"><Label>Musterlösung</Label><Textarea value={slide.content.referenceAnswer || ''} onChange={(e) => updateSlideContent(slide.id, { referenceAnswer: e.target.value })} className="min-h-[120px]" /></div><div className="space-y-2"><Label>Kriterien</Label><Textarea value={slide.content.criteria || ''} onChange={(e) => updateSlideContent(slide.id, { criteria: e.target.value })} className="min-h-[120px]" /></div></div></div>
                    )}
                    {slide.type === 'vocabulary' && (
                        <div className="space-y-6"><div className="grid gap-3">{(slide.content.pairs || []).map((pair: any, pIndex: number) => (<div key={pair.id} className="grid grid-cols-[1fr_1fr_40px] gap-2"><Input placeholder="Fremd..." value={pair.foreign} onChange={(e) => { const newPairs = [...slide.content.pairs]; newPairs[pIndex].foreign = e.target.value; updateSlideContent(slide.id, { pairs: newPairs }); }} /><Input placeholder="Deutsch..." value={pair.german} onChange={(e) => { const newPairs = [...slide.content.pairs]; newPairs[pIndex].german = e.target.value; updateSlideContent(slide.id, { pairs: newPairs }); }} /><Button variant="ghost" size="icon" disabled={slide.content.pairs.length <= 1} onClick={() => { const newPairs = slide.content.pairs.filter((_: any, i: number) => i !== pIndex); updateSlideContent(slide.id, { pairs: newPairs }); }}><Trash2 className="h-4 w-4" /></Button></div>))}<Button variant="outline" onClick={() => { const newPairs = [...slide.content.pairs, { id: Date.now().toString(), foreign: '', german: '' }]; updateSlideContent(slide.id, { pairs: newPairs }); }}><Plus className="h-4 w-4 mr-2" /> Vokabel hinzufügen</Button></div></div>
                    )}
                    {slide.type === 'text' && (
                      <div className="space-y-6"><Label>Überschrift</Label><Input value={slide.content.title || ''} onChange={(e) => updateSlideContent(slide.id, { title: e.target.value })} /><Label>Text Folientext</Label><Textarea value={slide.content.text || ''} onChange={(e) => updateSlideContent(slide.id, { text: e.target.value })} className="min-h-[200px]" /></div>
                    )}
                    {slide.type === 'conclusion' && (
                        <div className="space-y-4"><Label className="font-bold">Optionen für das Ende</Label><div className="grid gap-4"><div className="flex items-center justify-between p-4 border rounded-lg"><Label>Score anzeigen</Label><Switch checked={slide.content.showScore} onCheckedChange={(val) => updateSlideContent(slide.id, { showScore: val })} /></div><div className="flex items-center justify-between p-4 border rounded-lg"><Label>Feedback sammeln (Smileys)</Label><Switch checked={slide.content.collectFeedback} onCheckedChange={(val) => updateSlideContent(slide.id, { collectFeedback: val })} /></div></div></div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
        )}
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
    const [feedbackValue, setFeedbackValue] = useState<'sad' | 'neutral' | 'happy' | null>(null);
    const [correctCount, setCorrectCount] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);

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
            setFeedbackValue(null);
            setCorrectCount(0);
            setTotalQuestions(slides.filter(s => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length);
        }
    }, [open, slides]);

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

    const checkShortAnswer = async () => {
        if (!userAnswer.trim()) return;
        setAnswerStatus('checking');
        const { answer, checkMode, question } = currentSlide.content;
        let isCorrect = false;
        if (checkMode === 'strict') isCorrect = userAnswer.trim() === answer.trim();
        else if (checkMode === 'helpfull') isCorrect = userAnswer.trim().toLowerCase() === answer.trim().toLowerCase();
        else {
            const result = await verifyQuizAnswer(question, answer, userAnswer, aiLanguage);
            isCorrect = result.isCorrect;
        }
        if (isCorrect) setCorrectCount(prev => prev + 1);
        setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    }

    const checkLongAnswerAction = async () => {
        if (!userAnswer.trim()) return;
        setAnswerStatus('checking');
        const { question, referenceAnswer, criteria } = currentSlide.content;
        const result = await checkLongAnswer(question, referenceAnswer, criteria, userAnswer, aiLanguage);
        setAiScore(result.score);
        setAiFeedback(result.feedback);
        if (result.isCorrect) setCorrectCount(prev => prev + 1);
        setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
    }

    const handleMcSelect = (optionId: string) => {
        if (answerStatus !== 'none') return;
        setSelectedMcOption(optionId);
        const option = currentSlide.content.options.find((o: any) => o.id === optionId);
        if (option.isCorrect) setCorrectCount(prev => prev + 1);
        setAnswerStatus(option.isCorrect ? 'correct' : 'incorrect');
    }

    const checkVocab = () => {
        const pairs = currentSlide.content.pairs;
        const results: Record<string, boolean> = {};
        let allCorrect = true;
        pairs.forEach((p: any) => {
            const isCorrect = (vocabAnswers[p.id] || '').trim().toLowerCase() === p.german.trim().toLowerCase();
            results[p.id] = isCorrect;
            if (!isCorrect) allCorrect = false;
        });
        setVocabResults(results);
        if (allCorrect) setCorrectCount(prev => prev + 1);
        setAnswerStatus(allCorrect ? 'correct' : 'incorrect');
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b bg-secondary/20 flex flex-row justify-between items-center space-y-0">
                    <DialogTitle className="text-sm font-bold truncate max-w-[200px]">{title}</DialogTitle>
                    <span className="text-xs font-mono">{currentIndex + 1} / {slides.length}</span>
                </DialogHeader>
                <main className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center bg-background">
                    {currentSlide?.type === 'welcome' ? (
                        <div className="text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-300">
                            <h1 className="text-4xl font-extrabold">{title}</h1>
                            <p className="text-muted-foreground">von {creator}</p>
                            {currentSlide.content.askName && (<div className="space-y-2 text-left"><Label>Dein Name</Label><Input placeholder="..." value={userName} onChange={(e) => setUserName(e.target.value)} /></div>)}
                            <Button className="w-full" size="lg" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>Quiz starten</Button>
                        </div>
                    ) : currentSlide?.type === 'multiple-choice' ? (
                        <div className="w-full max-w-2xl space-y-8">
                            <h2 className="text-2xl font-bold">{currentSlide.content.question}</h2>
                            <div className="grid gap-3">{(currentSlide.content.options || []).map((opt: any) => { const isSelected = selectedMcOption === opt.id; const isCorrect = opt.isCorrect; let btnClass = "justify-start h-auto py-4 px-6 text-left border-2"; if (answerStatus !== 'none') { if (isCorrect) btnClass += " bg-green-600 border-green-700 text-white"; else if (isSelected && !isCorrect) btnClass += " bg-red-600 border-red-700 text-white"; } return (<Button key={opt.id} variant="outline" disabled={answerStatus !== 'none'} onClick={() => handleMcSelect(opt.id)} className={btnClass}>{opt.text}</Button>); })}</div>
                        </div>
                    ) : currentSlide?.type === 'short-answer' ? (
                        <div className="w-full max-w-xl space-y-8 text-center"><h2 className="text-2xl font-bold">{currentSlide.content.question}</h2><div className="relative"><Input placeholder="Antwort..." value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-xl py-8 px-6 text-center" />{answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin" />}</div>{answerStatus === 'none' && <Button size="lg" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Prüfen</Button>}{answerStatus === 'correct' && <p className="text-green-600 font-bold">Richtig!</p>}{answerStatus === 'incorrect' && <p className="text-red-600 font-bold">Falsch. Lösung: {currentSlide.content.answer}</p>}</div>
                    ) : currentSlide?.type === 'long-answer' ? (
                        <div className="w-full max-w-2xl space-y-8"><h2 className="text-2xl font-bold">{currentSlide.content.question}</h2><div className="relative"><Textarea placeholder="Schreibe hier..." value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-lg p-6 min-h-[180px]" />{answerStatus === 'checking' && <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center rounded-md z-10"><Loader2 className="animate-spin h-8 w-8" /><p>KI prüft...</p></div>}</div>{answerStatus === 'none' && <Button size="lg" onClick={checkLongAnswerAction} disabled={!userAnswer.trim()}>KI-Prüfung</Button>}{aiFeedback && <div className="p-4 rounded-lg bg-secondary/50 mt-4 animate-in slide-in-from-top-2 duration-300"><p className="text-sm font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> KI-Feedback ({aiScore}/10):</p><p className="text-sm">{aiFeedback}</p></div>}</div>
                    ) : currentSlide?.type === 'vocabulary' ? (
                        <div className="w-full max-w-2xl space-y-6"><h2 className="text-2xl font-bold mb-4 text-center">Vokabel-Check</h2><div className="grid gap-4">{currentSlide.content.pairs.map((pair: any) => (<div key={pair.id} className="grid grid-cols-[1fr_1fr] gap-4 items-center"><div className="text-right font-medium">{pair.foreign}</div><Input placeholder="Übersetzung..." value={vocabAnswers[pair.id] || ''} onChange={(e) => setVocabAnswers(prev => ({...prev, [pair.id]: e.target.value}))} className={cn("text-center", vocabResults[pair.id] === true && "border-green-500 bg-green-50", vocabResults[pair.id] === false && "border-red-500 bg-red-50")} disabled={answerStatus !== 'none'} /></div>))}</div>{answerStatus === 'none' && (<Button className="w-full mt-4" onClick={checkVocab}>Prüfen</Button>)}</div>
                    ) : currentSlide?.type === 'text' ? (
                        <div className="w-full max-w-2xl space-y-6"><h2 className="text-3xl font-bold border-b pb-4">{currentSlide.content.title}</h2><div className="text-lg leading-relaxed whitespace-pre-wrap text-muted-foreground">{currentSlide.content.text}</div></div>
                    ) : currentSlide?.type === 'conclusion' ? (
                        <div className="text-center space-y-10 w-full max-w-md"><div className="space-y-4"><h1 className="text-5xl font-extrabold tracking-tight">Vielen Dank!</h1><p className="text-xl text-muted-foreground font-medium">Du bist mit dem Quiz fertig! Du kannst diese Seite nun schließen.</p></div>{currentSlide.content.showScore && (<div className="p-8 bg-primary/5 rounded-2xl border-2 border-primary/10 space-y-2"><p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Dein Ergebnis</p><p className="text-7xl font-black text-primary">{totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%</p><p className="text-sm text-muted-foreground">{correctCount} von {totalQuestions} richtig</p></div>)}{currentSlide.content.collectFeedback && (<div className="space-y-6"><p className="font-bold text-lg">Wie fandest du das Quiz?</p><div className="flex justify-center gap-8"><button onClick={() => setFeedbackValue('sad')} className={cn("p-2 rounded-full transition-colors", feedbackValue === 'sad' ? "bg-red-100 text-red-600" : "text-muted-foreground hover:text-red-400")}><Frown className="w-16 h-16" /></button><button onClick={() => setFeedbackValue('neutral')} className={cn("p-2 rounded-full transition-colors", feedbackValue === 'neutral' ? "bg-amber-100 text-amber-600" : "text-muted-foreground hover:text-amber-400")}><Meh className="w-16 h-16" /></button><button onClick={() => setFeedbackValue('happy')} className={cn("p-2 rounded-full transition-colors", feedbackValue === 'happy' ? "bg-green-100 text-green-600" : "text-muted-foreground hover:text-green-400")}><Smile className="w-16 h-16" /></button></div></div>)}<div className="flex flex-col gap-3"><Button className="w-full h-14 text-lg font-bold" onClick={() => onOpenChange(false)}>Quiz beenden</Button>{currentSlide.content.collectFeedback && (<Button variant="ghost" onClick={() => onOpenChange(false)}>Ohne Bewertung beenden</Button>)}</div></div>
                    ) : (<div className="text-center">Kein Inhalt für diesen Folientyp.</div>)}
                </main>
                <footer className="p-2 px-4 border-t bg-secondary/10 relative"><div className="flex justify-end mb-1"><span className="text-[10px] font-mono font-bold text-muted-foreground">{currentIndex + 1} / {slides.length}</span></div><div className="h-1 w-full bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentIndex + 1) / slides.length) * 100}%` }} /></div><div className="flex justify-between mt-2"><Button variant="ghost" size="sm" onClick={handleBack} disabled={currentIndex === 0}><ChevronLeft className="mr-2 h-4 w-4" /> Zurück</Button><Button size="sm" onClick={handleNext} disabled={currentIndex === slides.length - 1 || answerStatus === 'checking'}>Weiter <ChevronRight className="ml-2 h-4 w-4" /></Button></div></footer>
            </DialogContent>
        </Dialog>
    );
}
