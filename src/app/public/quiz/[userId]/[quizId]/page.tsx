
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { initializeFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, serverTimestamp, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, ChevronRight, CheckCircle2, XCircle, Frown, Meh, Smile, QrCode, ArrowLeft, Globe, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { verifyQuizAnswer, checkLongAnswer } from '@/app/actions';

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
};

export default function PublicQuizPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.userId as string;
  const quizId = params?.quizId as string;

  const { toast } = useToast();
  const { firestore } = useMemo(() => initializeFirebase(), []);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userName, setUserName] = useState('');
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [answerStatus, setAnswerStatus] = useState<'none' | 'correct' | 'incorrect' | 'checking'>('none');
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [selectedMcOption, setSelectedMcOption] = useState<string | null>(null);
  const [feedbackValue, setFeedbackValue] = useState<'sad' | 'neutral' | 'happy' | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [isFooterVisible, setIsFooterVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quizDocRef = useMemoFirebase(() => 
    userId && quizId ? doc(firestore, `users/${userId}/quizzes`, quizId) : null
  , [firestore, userId, quizId]);

  const { data: quiz, isLoading: isLoadingQuiz } = useDoc<Quiz>(quizDocRef);

  const currentSlide = quiz?.slides[currentIndex];
  const totalQuestions = useMemo(() => quiz?.slides.filter(s => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length || 0, [quiz]);

  // Handle Scroll for Footer
  useEffect(() => {
    const handleScroll = () => {
        const scrolled = window.scrollY > 20;
        setIsFooterVisible(scrolled || answerStatus !== 'none' || (currentSlide?.type === 'welcome' || currentSlide?.type === 'text' || currentSlide?.type === 'conclusion'));
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [answerStatus, currentSlide]);

  const handleNext = () => {
    if (quiz && currentIndex < quiz.slides.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setAnswerStatus('none');
        setCurrentAnswer('');
        setSelectedMcOption(null);
        setAiFeedback(null);
        setAiScore(null);
        window.scrollTo(0, 0);
    }
  };

  const checkShortAnswer = async () => {
    if (!currentAnswer.trim() || !currentSlide) return;
    setAnswerStatus('checking');
    const { answer, checkMode, question } = currentSlide.content;
    
    // Zuerst lokale Prüfung
    if (currentAnswer.trim().toLowerCase() === answer.trim().toLowerCase()) {
        setCorrectCount(prev => prev + 1);
        setAnswerStatus('correct');
        setUserAnswers(prev => ({ ...prev, [currentSlide.id]: true }));
        setIsFooterVisible(true);
        return;
    }

    if (checkMode === 'ai') {
        const result = await verifyQuizAnswer(question, answer, currentAnswer, 'German');
        if (result.isCorrect) setCorrectCount(prev => prev + 1);
        setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
        setUserAnswers(prev => ({ ...prev, [currentSlide.id]: result.isCorrect }));
    } else {
        setAnswerStatus('incorrect');
        setUserAnswers(prev => ({ ...prev, [currentSlide.id]: false }));
    }
    setIsFooterVisible(true);
  }

  const checkLongAnswerAction = async () => {
    if (!currentAnswer.trim() || !currentSlide) return;
    setAnswerStatus('checking');
    const { question, referenceAnswer, criteria } = currentSlide.content;
    const result = await checkLongAnswer(question, referenceAnswer, criteria, currentAnswer, 'German');
    setAiScore(result.score);
    setAiFeedback(result.feedback);
    if (result.isCorrect) setCorrectCount(prev => prev + 1);
    setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
    setUserAnswers(prev => ({ ...prev, [currentSlide.id]: { isCorrect: result.isCorrect, score: result.score, text: currentAnswer } }));
    setIsFooterVisible(true);
  }

  const handleMcSelect = (optionId: string) => {
    if (answerStatus !== 'none' || !currentSlide) return;
    setSelectedMcOption(optionId);
    const option = currentSlide.content.options.find((o: any) => o.id === optionId);
    if (option.isCorrect) setCorrectCount(prev => prev + 1);
    setAnswerStatus(option.isCorrect ? 'correct' : 'incorrect');
    setUserAnswers(prev => ({ ...prev, [currentSlide.id]: optionId }));
    setIsFooterVisible(true);
  }

  const submitQuiz = async (rating?: 'sad' | 'neutral' | 'happy') => {
    if (isSubmitting || !quiz) return;
    setIsSubmitting(true);
    try {
        const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
        const responsesCol = collection(firestore, `users/${userId}/quizzes/${quizId}/responses`);
        await addDoc(responsesCol, {
            userName: userName || 'Anonym',
            answers: userAnswers,
            percentage,
            rating: rating || null,
            completedAt: serverTimestamp()
        });
        toast({ title: "Abgeschlossen", description: "Deine Ergebnisse wurden gespeichert." });
        window.close();
    } catch (e) {
        toast({ variant: 'destructive', title: "Fehler beim Speichern" });
    }
    setIsSubmitting(false);
  }

  if (isLoadingQuiz) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  if (!quiz || !quiz.isPublished) return <div className="flex items-center justify-center h-screen p-8 text-center"><Card><CardHeader><CardTitle>Quiz nicht verfügbar</CardTitle><CardDescription>Dieses Quiz existiert nicht oder wurde offline genommen.</CardDescription></CardHeader></Card></div>;

  const renderSlide = () => {
    if (!currentSlide) return null;
    switch(currentSlide.type) {
        case 'welcome':
            return (
                <div className="text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-500">
                    <h1 className="text-5xl font-black tracking-tight">{quiz.title}</h1>
                    <p className="text-muted-foreground text-xl">von {quiz.creator}</p>
                    {currentSlide.content.askName && (
                        <div className="space-y-3 text-left">
                            <Label className="text-base font-bold">Wie heißt du?</Label>
                            <Input placeholder="Dein Name..." value={userName} onChange={(e) => setUserName(e.target.value)} className="text-lg py-6" />
                        </div>
                    )}
                    <Button className="w-full h-14 text-xl font-bold" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>Quiz starten</Button>
                </div>
            );
        case 'multiple-choice':
            return (
                <div className="w-full max-w-2xl space-y-10">
                    <h2 className="text-3xl md:text-4xl font-bold leading-tight">{currentSlide.content.question}</h2>
                    <div className="grid gap-4">
                        {(currentSlide.content.options || []).map((opt: any) => {
                            const isSelected = selectedMcOption === opt.id;
                            const isCorrect = opt.isCorrect;
                            let btnClass = "justify-start h-auto py-6 px-8 text-left border-2 text-xl transition-all duration-300";
                            if (answerStatus !== 'none') {
                                if (isCorrect) btnClass += " bg-green-600 border-green-700 text-white shadow-lg";
                                else if (isSelected && !isCorrect) btnClass += " bg-red-600 border-red-700 text-white";
                            }
                            return (
                                <Button key={opt.id} variant="outline" disabled={answerStatus !== 'none'} onClick={() => handleMcSelect(opt.id)} className={btnClass}>
                                    <div className="flex items-center gap-4">
                                        {answerStatus !== 'none' && (isCorrect ? <CheckCircle2 className="h-6 w-6 shrink-0"/> : isSelected ? <XCircle className="h-6 w-6 shrink-0"/> : null)}
                                        {opt.text}
                                    </div>
                                </Button>
                            );
                        })}
                    </div>
                </div>
            );
        case 'short-answer':
            return (
                <div className="w-full max-w-xl space-y-10 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold">{currentSlide.content.question}</h2>
                    <div className="space-y-6">
                        <div className="relative">
                            <Input 
                                placeholder="Deine Antwort..." 
                                value={currentAnswer} 
                                onChange={(e) => setCurrentAnswer(e.target.value)} 
                                disabled={answerStatus !== 'none' && answerStatus !== 'checking'} 
                                className="text-2xl py-10 px-6 text-center shadow-sm" 
                            />
                            {answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
                        </div>
                        {answerStatus === 'none' && <Button size="lg" className="w-full h-14 text-lg" onClick={checkShortAnswer} disabled={!currentAnswer.trim()}>Prüfen</Button>}
                        {answerStatus === 'correct' && <div className="p-4 bg-green-100 text-green-700 rounded-xl font-bold text-xl animate-in zoom-in">Richtig! ✨</div>}
                        {answerStatus === 'incorrect' && <div className="p-4 bg-red-100 text-red-700 rounded-xl font-bold text-xl animate-in zoom-in">Nicht ganz... Lösung: {currentSlide.content.answer}</div>}
                    </div>
                </div>
            );
        case 'long-answer':
            return (
                <div className="w-full max-w-3xl space-y-8">
                    <h2 className="text-3xl md:text-4xl font-bold">{currentSlide.content.question}</h2>
                    <div className="space-y-4">
                        <div className="relative">
                            <Textarea 
                                placeholder="Schreibe deine Antwort hier ausführlich auf..." 
                                value={currentAnswer} 
                                onChange={(e) => setCurrentAnswer(e.target.value)} 
                                disabled={answerStatus !== 'none' && answerStatus !== 'checking'} 
                                className="text-xl p-8 min-h-[250px] leading-relaxed" 
                            />
                            {answerStatus === 'checking' && (
                                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-md z-10">
                                    <Loader2 className="animate-spin h-12 w-12 text-primary mb-4" />
                                    <p className="font-bold text-lg">Die KI analysiert deine Antwort...</p>
                                </div>
                            )}
                        </div>
                        {answerStatus === 'none' && <Button size="lg" className="w-full h-14 text-xl" onClick={checkLongAnswerAction} disabled={!currentAnswer.trim()}>Antwort absenden & prüfen</Button>}
                        {aiFeedback && (
                            <div className="p-6 rounded-2xl bg-primary/5 border-2 border-primary/10 mt-6 animate-in slide-in-from-top-4 duration-500">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-lg font-bold flex items-center gap-2 text-primary"><Sparkles className="w-6 h-6" /> KI-Feedback</p>
                                    <Badge className="text-lg py-1 px-3">{aiScore} / 10</Badge>
                                </div>
                                <p className="text-lg leading-relaxed text-muted-foreground">{aiFeedback}</p>
                            </div>
                        )}
                    </div>
                </div>
            );
        case 'text':
            return (
                <div className="w-full max-w-3xl space-y-10 animate-in fade-in duration-700">
                    <h2 className="text-4xl md:text-5xl font-black border-b-4 border-primary/20 pb-6">{currentSlide.content.title}</h2>
                    <div className="text-xl md:text-2xl leading-relaxed whitespace-pre-wrap text-muted-foreground font-medium">
                        {currentSlide.content.text}
                    </div>
                </div>
            );
        case 'conclusion':
            return (
                <div className="text-center space-y-12 w-full max-w-xl animate-in zoom-in duration-500">
                    <div className="space-y-4">
                        <h1 className="text-6xl font-black tracking-tighter">Vielen Dank!</h1>
                        <p className="text-2xl text-muted-foreground font-medium">Du bist mit dem Quiz fertig! Du kannst diese Seite nun schließen.</p>
                    </div>
                    {currentSlide.content.showScore && (
                        <div className="p-10 bg-primary/5 rounded-3xl border-4 border-primary/10 shadow-inner">
                            <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm mb-2">Dein Endergebnis</p>
                            <p className="text-8xl font-black text-primary mb-2">{totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%</p>
                            <p className="text-xl text-muted-foreground">{correctCount} von {totalQuestions} Aufgaben richtig gelöst</p>
                        </div>
                    )}
                    {currentSlide.content.collectFeedback && (
                        <div className="space-y-8">
                            <p className="font-black text-2xl">Wie hat es dir gefallen?</p>
                            <div className="flex justify-center gap-10">
                                <button onClick={() => submitQuiz('sad')} className="group transition-transform hover:scale-110"><Frown className="w-20 h-20 text-muted-foreground group-hover:text-red-500 transition-colors" /></button>
                                <button onClick={() => submitQuiz('neutral')} className="group transition-transform hover:scale-110"><Meh className="w-20 h-20 text-muted-foreground group-hover:text-amber-500 transition-colors" /></button>
                                <button onClick={() => submitQuiz('happy')} className="group transition-transform hover:scale-110"><Smile className="w-20 h-20 text-muted-foreground group-hover:text-green-500 transition-colors" /></button>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col gap-4">
                        <Button className="w-full h-16 text-2xl font-black rounded-2xl shadow-lg" onClick={() => submitQuiz()} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin"/> : 'Quiz beenden'}
                        </Button>
                        <Button variant="ghost" className="text-muted-foreground" onClick={() => window.close()}>Ohne Bewertung beenden</Button>
                    </div>
                </div>
            );
        default: return null;
    }
  }

  const canGoNext = currentSlide?.type === 'welcome' || currentSlide?.type === 'text' || currentSlide?.type === 'conclusion' || answerStatus !== 'none';

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20 flex flex-col">
        <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
            {renderSlide()}
        </main>

        <footer className={cn(
            "fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t transition-all duration-500 z-50",
            isFooterVisible ? "translate-y-0" : "translate-y-full"
        )}>
            <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex justify-between items-end">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Fortschritt</span>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-primary">{currentIndex + 1}</span>
                            <span className="text-muted-foreground font-bold">/ {quiz.slides.length}</span>
                        </div>
                    </div>
                    <Button 
                        onClick={handleNext} 
                        disabled={!canGoNext || currentIndex === quiz.slides.length - 1}
                        className="h-14 px-8 text-xl font-black rounded-xl shadow-md group"
                    >
                        Weiter <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-primary transition-all duration-700 ease-in-out" 
                        style={{ width: `${((currentIndex + 1) / quiz.slides.length) * 100}%` }} 
                    />
                </div>
            </div>
        </footer>
    </div>
  );
}
