
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, Sparkles, ChevronRight, Frown, Meh, Smile, Shield, User, CheckCircle2, Star, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { verifyQuizAnswer, checkLongAnswer } from '@/app/actions';
import { useTheme } from '@/hooks/use-theme';

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
  const params = useParams();
  const userId = params?.userId as string;
  const quizId = params?.quizId as string;

  const { toast } = useToast();
  const firestore = useFirestore();
  const { aiLanguage } = useTheme();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userName, setUserName] = useState('');
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [currentAnswer, setCurrentAnswer] = useState<any>('');
  const [answerStatus, setAnswerStatus] = useState<'none' | 'correct' | 'incorrect' | 'checking'>('none');
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showFooter, setShowFooter] = useState(false);
  const [isSubmitting, setIsJoining] = useState(false);

  const quizDocRef = useMemoFirebase(() => 
    userId && quizId ? doc(firestore, `users/${userId}/quizzes`, quizId) : null
  , [firestore, userId, quizId]);

  const { data: quiz, isLoading: isLoadingQuiz } = useDoc<Quiz>(quizDocRef);

  const currentSlide = quiz?.slides?.[currentIndex];
  const totalQuestions = useMemo(() => quiz?.slides?.filter(s => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length || 0, [quiz]);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolledDown = window.scrollY > 50;
      setShowFooter(isScrolledDown || answerStatus !== 'none');
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [answerStatus]);

  const handleNext = () => {
    if (currentIndex < (quiz?.slides?.length || 0) - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setAnswerStatus('none');
      setCurrentAnswer('');
      setAiFeedback(null);
      setAiScore(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const submitResponse = async (rating?: string) => {
    if (!firestore || !userId || !quizId) return;
    setIsJoining(true);
    try {
      const responseRef = collection(firestore, `users/${userId}/quizzes/${quizId}/responses`);
      await addDoc(responseRef, {
        userName: userName || 'Anonym',
        answers: userAnswers,
        percentage: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
        rating: rating || null,
        completedAt: serverTimestamp()
      });
      toast({ title: "Abgeschickt!", description: "Vielen Dank für deine Teilnahme." });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Fehler beim Speichern' });
    } finally {
      setIsJoining(false);
    }
  };

  const handleAction = async () => {
    if (!currentSlide) return;

    if (currentSlide.type === 'welcome') {
      handleNext();
      return;
    }

    if (currentSlide.type === 'short-answer') {
      const answer = currentAnswer as string;
      if (!answer.trim()) return;
      setAnswerStatus('checking');
      const { answer: correct, checkMode, question } = currentSlide.content;
      
      // Zuerst lokale Prüfung
      if (answer.trim().toLowerCase() === correct.trim().toLowerCase()) {
        setCorrectCount(prev => prev + 1);
        setAnswerStatus('correct');
        setUserAnswers(prev => ({ ...prev, [currentSlide.id]: true }));
        return;
      }

      if (checkMode === 'ai') {
        const result = await verifyQuizAnswer(question, correct, answer, aiLanguage);
        if (result.isCorrect) setCorrectCount(prev => prev + 1);
        setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
        setUserAnswers(prev => ({ ...prev, [currentSlide.id]: result.isCorrect }));
      } else {
        setAnswerStatus('incorrect');
        setUserAnswers(prev => ({ ...prev, [currentSlide.id]: false }));
      }
    }

    if (currentSlide.type === 'long-answer') {
      const answer = currentAnswer as string;
      if (!answer.trim()) return;
      setAnswerStatus('checking');
      const { question, referenceAnswer, criteria } = currentSlide.content;
      const result = await checkLongAnswer(question, referenceAnswer, criteria, answer, aiLanguage);
      setAiScore(result.score);
      setAiFeedback(result.feedback);
      if (result.isCorrect) setCorrectCount(prev => prev + 1);
      setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
      setUserAnswers(prev => ({ ...prev, [currentSlide.id]: { text: answer, isCorrect: result.isCorrect, score: result.score } }));
    }

    if (currentSlide.type === 'multiple-choice') {
      // Logic handled in button click
    }

    if (currentSlide.type === 'vocabulary') {
      const results: Record<string, boolean> = {};
      let allCorrect = true;
      currentSlide.content.pairs.forEach((p: any) => {
        const isCorrect = (currentAnswer[p.id] || '').trim().toLowerCase() === p.german.trim().toLowerCase();
        results[p.id] = isCorrect;
        if (!isCorrect) allCorrect = false;
      });
      if (allCorrect) setCorrectCount(prev => prev + 1);
      setAnswerStatus(allCorrect ? 'correct' : 'incorrect');
      setUserAnswers(prev => ({ ...prev, [currentSlide.id]: allCorrect }));
    }
  };

  const handleMcSelect = (optionId: string) => {
    if (answerStatus !== 'none') return;
    const option = currentSlide?.content.options.find((o: any) => o.id === optionId);
    if (option.isCorrect) setCorrectCount(prev => prev + 1);
    setAnswerStatus(option.isCorrect ? 'correct' : 'incorrect');
    setUserAnswers(prev => ({ ...prev, [currentSlide!.id]: optionId }));
  };

  if (isLoadingQuiz) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  if (!quiz || !quiz.isPublished) return <div className="flex flex-col items-center justify-center h-screen gap-4 p-4 text-center"><Globe className="w-12 h-12 text-muted-foreground" /><h1 className="text-2xl font-bold">Quiz nicht verfügbar</h1><p className="text-muted-foreground">Dieses Quiz wurde entweder offline genommen oder existiert nicht.</p></div>;

  const renderSlide = () => {
    if (!currentSlide) return null;

    switch (currentSlide.type) {
      case 'welcome':
        return (
          <div className="text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-500">
            <h1 className="text-5xl font-black tracking-tight">{quiz.title}</h1>
            <p className="text-xl text-muted-foreground">Erstellt von {quiz.creator}</p>
            {currentSlide.content.askName && (
              <div className="space-y-3 text-left">
                <Label className="text-lg font-bold">Wie heißt du?</Label>
                <Input placeholder="Dein Name..." value={userName} onChange={e => setUserName(e.target.value)} className="text-xl h-14" />
              </div>
            )}
            <Button className="w-full h-16 text-xl font-bold" onClick={handleAction} disabled={currentSlide.content.askName && !userName.trim()}>Quiz starten</Button>
          </div>
        );

      case 'multiple-choice':
        return (
          <div className="w-full max-w-2xl space-y-8">
            <h2 className="text-3xl font-black">{currentSlide.content.question}</h2>
            <div className="grid gap-4">
              {currentSlide.content.options.map((opt: any) => {
                const isSelected = userAnswers[currentSlide.id] === opt.id;
                const showResults = answerStatus !== 'none';
                let variant: "outline" | "default" | "secondary" = "outline";
                let className = "justify-start h-auto py-6 px-8 text-left text-lg border-2 transition-all";
                
                if (showResults) {
                  if (opt.isCorrect) className += " bg-green-600 border-green-700 text-white";
                  else if (isSelected && !opt.isCorrect) className += " bg-red-600 border-red-700 text-white";
                }

                return (
                  <Button key={opt.id} variant={variant} disabled={showResults} onClick={() => handleMcSelect(opt.id)} className={className}>
                    {showResults && opt.isCorrect && <CheckCircle2 className="mr-3 h-6 w-6" />}
                    {opt.text}
                  </Button>
                );
              })}
            </div>
          </div>
        );

      case 'short-answer':
        return (
          <div className="w-full max-w-xl space-y-8 text-center">
            <h2 className="text-3xl font-black">{currentSlide.content.question}</h2>
            <div className="relative">
              <Input placeholder="Deine Antwort..." value={currentAnswer} onChange={e => setCurrentAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-2xl py-10 px-6 text-center shadow-sm" />
              {answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
            </div>
            {answerStatus === 'none' && <Button size="lg" className="px-12 h-14 text-lg font-bold" onClick={handleAction} disabled={!currentAnswer.trim()}>Prüfen</Button>}
            {answerStatus === 'correct' && <div className="p-4 bg-green-100 text-green-700 rounded-xl font-bold text-xl animate-in zoom-in">Richtig! ✨</div>}
            {answerStatus === 'incorrect' && <div className="p-4 bg-red-100 text-red-700 rounded-xl font-bold text-xl animate-in zoom-in">Leider falsch. Lösung: {currentSlide.content.answer}</div>}
          </div>
        );

      case 'long-answer':
        return (
          <div className="w-full max-w-2xl space-y-8">
            <h2 className="text-3xl font-black">{currentSlide.content.question}</h2>
            <div className="relative">
              <Textarea placeholder="Schreibe hier deine Antwort..." value={currentAnswer} onChange={e => setCurrentAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-lg p-6 min-h-[200px] leading-relaxed" />
              {answerStatus === 'checking' && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-md z-10">
                  <Loader2 className="animate-spin h-10 w-10 text-primary mb-2" />
                  <p className="font-bold">KI wertet Antwort aus...</p>
                </div>
              )}
            </div>
            {answerStatus === 'none' && (
              <Button size="lg" className="w-full h-16 text-xl font-bold" onClick={handleAction} disabled={!currentAnswer.trim() || answerStatus === 'checking'}>
                <Sparkles className="mr-2 h-6 w-6" /> KI-Antwort prüfen
              </Button>
            )}
            {aiFeedback && (
              <div className="p-6 rounded-2xl bg-primary/5 border-2 border-primary/10 animate-in slide-in-from-top-4 duration-500">
                <p className="text-base font-black flex items-center gap-2 mb-3"><Star className="w-5 h-5 text-amber-500 fill-amber-500" /> KI-Feedback ({aiScore}/10):</p>
                <p className="text-lg leading-relaxed">{aiFeedback}</p>
              </div>
            )}
          </div>
        );

      case 'vocabulary':
        return (
          <div className="w-full max-w-2xl space-y-8">
            <h2 className="text-3xl font-black text-center">Vokabel-Test</h2>
            <div className="grid gap-4">
              {currentSlide.content.pairs.map((p: any) => (
                <div key={p.id} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center p-4 bg-secondary/30 rounded-xl">
                  <div className="text-xl font-bold text-muted-foreground">{p.foreign}</div>
                  <Input 
                    placeholder="Übersetzung..." 
                    value={currentAnswer[p.id] || ''} 
                    onChange={e => setCurrentAnswer((prev: any) => ({ ...prev, [p.id]: e.target.value }))}
                    disabled={answerStatus !== 'none'}
                    className={cn("text-lg h-12", answerStatus !== 'none' && (currentAnswer[p.id]?.trim().toLowerCase() === p.german.trim().toLowerCase() ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"))}
                  />
                </div>
              ))}
            </div>
            {answerStatus === 'none' && <Button className="w-full h-14 text-lg font-bold" onClick={handleAction}>Vokabeln prüfen</Button>}
          </div>
        );

      case 'text':
        return (
          <div className="w-full max-w-3xl space-y-8 animate-in fade-in duration-700">
            <h2 className="text-5xl font-black border-b-4 border-primary pb-6">{currentSlide.content.title}</h2>
            <div className="text-2xl leading-relaxed text-muted-foreground whitespace-pre-wrap">{currentSlide.content.text}</div>
            <Button size="lg" className="h-16 px-12 text-xl font-bold" onClick={handleNext}>Verstanden <ChevronRight className="ml-2" /></Button>
          </div>
        );

      case 'conclusion':
        return (
          <div className="text-center space-y-12 w-full max-w-lg animate-in zoom-in duration-500">
            <div className="space-y-4">
              <h1 className="text-6xl font-black tracking-tight">Vielen Dank!</h1>
              <p className="text-2xl text-muted-foreground font-medium">Du bist mit dem Quiz fertig! Du kannst diese Seite nun schließen.</p>
            </div>
            {currentSlide.content.showScore && (
              <div className="p-10 bg-primary/5 rounded-3xl border-4 border-primary/10 space-y-2">
                <p className="text-muted-foreground font-black uppercase tracking-widest text-sm">Dein Ergebnis</p>
                <p className="text-8xl font-black text-primary">{totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%</p>
                <p className="text-xl text-muted-foreground font-bold">{correctCount} von {totalQuestions} richtig</p>
              </div>
            )}
            {currentSlide.content.collectFeedback && (
              <div className="space-y-8">
                <p className="font-black text-2xl">Wie fandest du das Quiz?</p>
                <div className="flex justify-center gap-10">
                  <button onClick={() => submitResponse('sad')} className="p-4 rounded-3xl bg-red-50 text-muted-foreground hover:text-red-600 transition-all hover:scale-110"><Frown className="w-20 h-20" /></button>
                  <button onClick={() => submitResponse('neutral')} className="p-4 rounded-3xl bg-amber-50 text-muted-foreground hover:text-amber-600 transition-all hover:scale-110"><Meh className="w-20 h-20" /></button>
                  <button onClick={() => submitResponse('happy')} className="p-4 rounded-3xl bg-green-50 text-muted-foreground hover:text-green-600 transition-all hover:scale-110"><Smile className="w-20 h-20" /></button>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-4">
              <Button className="w-full h-16 text-xl font-bold" onClick={() => submitResponse()} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : 'Quiz beenden'}</Button>
              {currentSlide.content.collectFeedback && <Button variant="ghost" onClick={() => submitResponse()}>Ohne Bewertung beenden</Button>}
            </div>
          </div>
        );

      default:
        return <div className="text-center">Unbekannter Folientyp.</div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-primary-foreground">
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
        {renderSlide()}
      </main>

      {currentSlide && currentSlide.type !== 'welcome' && currentSlide.type !== 'conclusion' && (
        <footer className={cn(
          "fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-background/80 backdrop-blur-xl border-t z-50 transition-all duration-500 ease-in-out transform",
          showFooter ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        )}>
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">
            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-xs font-black uppercase tracking-widest text-muted-foreground">
                <span>Fortschritt</span>
                <span>{currentIndex + 1} / {quiz.slides.length}</span>
              </div>
              <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-700 ease-out" style={{ width: `${((currentIndex + 1) / quiz.slides.length) * 100}%` }} />
              </div>
            </div>
            <Button size="lg" className="h-14 px-10 text-lg font-bold shadow-xl shadow-primary/20" onClick={handleNext} disabled={answerStatus === 'none' && currentSlide.type !== 'text'}>
              Weiter <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}
