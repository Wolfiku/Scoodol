'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { Loader2, BrainCircuit, User, Calendar, ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Sparkles, Frown, Meh, Smile, Shield, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  authorName?: string;
  slides: Slide[];
  isPublished?: boolean;
  createdAt: any;
};

export default function PublicQuizPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const quizId = params?.quizId as string;
  const firestore = useFirestore();
  const router = useRouter();
  const { aiLanguage } = useTheme();

  const docRef = useMemoFirebase(() => 
    userId && quizId ? doc(firestore, `users/${userId}/quizzes`, quizId) : null
  , [firestore, userId, quizId]);

  const { data, isLoading } = useDoc<Quiz>(docRef);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userName, setUserName] = useState('');
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [answerStatus, setAnswerStatus] = useState<'none' | 'correct' | 'incorrect' | 'checking'>('none');
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [feedbackRating, setFeedbackValue] = useState<'sad' | 'neutral' | 'happy' | null>(null);

  const currentSlide = data?.slides[currentIndex];
  const totalQuestions = data?.slides.filter(s => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length || 0;

  const handleNext = async () => {
    if (!data) return;
    if (currentIndex < data.slides.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setAnswerStatus('none');
        setAiFeedback(null);
        setAiScore(null);
    } else {
        await finishQuiz();
    }
  };

  const finishQuiz = async () => {
      if (!data) return;
      setIsCompleted(true);
      const responsesRef = collection(firestore, `users/${userId}/quizzes/${quizId}/responses`);
      await addDoc(responsesRef, {
          userName: userName || 'Anonym',
          answers: userAnswers,
          percentage: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
          rating: feedbackRating,
          completedAt: serverTimestamp(),
      });
  };

  const checkShortAnswer = async (input: string) => {
    if (!input.trim() || !currentSlide) return;
    setAnswerStatus('checking');
    const { answer, checkMode, question } = currentSlide.content;
    
    let isCorrect = input.trim().toLowerCase() === answer.trim().toLowerCase();
    
    if (!isCorrect && checkMode === 'ai') {
        const result = await verifyQuizAnswer(question, answer, input, aiLanguage);
        isCorrect = result.isCorrect;
    }

    if (isCorrect) setCorrectCount(prev => prev + 1);
    setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    setUserAnswers(prev => ({ ...prev, [currentSlide.id]: { text: input, isCorrect } }));
  }

  const checkLongAnswerAction = async (input: string) => {
    if (!input.trim() || !currentSlide) return;
    setAnswerStatus('checking');
    const { question, referenceAnswer, criteria } = currentSlide.content;
    const result = await checkLongAnswer(question, referenceAnswer, criteria, input, aiLanguage);
    setAiScore(result.score);
    setAiFeedback(result.feedback);
    if (result.isCorrect) setCorrectCount(prev => prev + 1);
    setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
    setUserAnswers(prev => ({ ...prev, [currentSlide.id]: { text: input, isCorrect: result.isCorrect, score: result.score } }));
  }

  const handleMcSelect = (optionId: string) => {
    if (answerStatus !== 'none' || !currentSlide) return;
    const option = currentSlide.content.options.find((o: any) => o.id === optionId);
    if (option.isCorrect) setCorrectCount(prev => prev + 1);
    setAnswerStatus(option.isCorrect ? 'correct' : 'incorrect');
    setUserAnswers(prev => ({ ...prev, [currentSlide.id]: optionId }));
  }

  if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  if (!data || data.isPublished === false) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-4">
        <h1 className="text-2xl font-bold mb-2">Quiz nicht verfügbar</h1>
        <Button onClick={() => router.push('/')}><ArrowLeft className="mr-2 h-4 w-4" /> Zurück</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b p-4 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><BrainCircuit className="h-5 w-5" /></div>
                <span className="font-black text-xl tracking-tighter">Scoodol Quiz</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{data.title}</span>
                <span>von {data.authorName || data.creator}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/')}>Beenden</Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-3xl p-6 md:p-12 flex flex-col justify-center">
        {currentSlide?.type === 'welcome' ? (
            <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
                <h1 className="text-5xl font-black tracking-tight">{data.title}</h1>
                <div className="flex items-center justify-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="h-4 w-4" /> {data.authorName || data.creator}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {data.createdAt ? format(new Date(data.createdAt.seconds * 1000), 'PPP', { locale: de }) : 'Neu'}</span>
                </div>
                {currentSlide.content.subtitle && <p className="text-xl text-muted-foreground italic">"{currentSlide.content.subtitle}"</p>}
                {currentSlide.content.askName && (
                    <div className="max-w-xs mx-auto space-y-2 text-left">
                        <Label>Dein Name</Label>
                        <Input placeholder="Eingeben..." value={userName} onChange={e => setUserName(e.target.value)} className="text-center py-6 text-lg" />
                    </div>
                )}
                <Button size="lg" className="w-full max-w-xs h-14 text-lg font-bold" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>Starten</Button>
            </div>
        ) : currentSlide?.type === 'conclusion' || isCompleted ? (
            <div className="text-center space-y-10 animate-in fade-in duration-700">
                <div className="space-y-4">
                    <h1 className="text-5xl font-black">Fertig!</h1>
                    <p className="text-xl text-muted-foreground">Das war's. Vielen Dank für deine Teilnahme!</p>
                </div>
                {currentSlide?.content.showScore && (
                    <div className="p-10 bg-primary/5 rounded-3xl border-2 border-primary/10 inline-block w-full">
                        <p className="text-muted-foreground font-black uppercase text-xs tracking-widest mb-2">Dein Ergebnis</p>
                        <p className="text-8xl font-black text-primary">{totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%</p>
                        <p className="text-sm font-medium mt-2">{correctCount} von {totalQuestions} Aufgaben richtig gelöst</p>
                    </div>
                )}
                {currentSlide?.content.collectFeedback && !feedbackRating && (
                    <div className="space-y-6">
                        <p className="font-bold text-lg">Wie war das Quiz?</p>
                        <div className="flex justify-center gap-8">
                            <button onClick={() => setFeedbackValue('sad')} className="p-2 rounded-full transition-all hover:scale-110 text-muted-foreground hover:text-red-500"><Frown className="w-16 h-16" /></button>
                            <button onClick={() => setFeedbackValue('neutral')} className="p-2 rounded-full transition-all hover:scale-110 text-muted-foreground hover:text-amber-500"><Meh className="w-16 h-16" /></button>
                            <button onClick={() => setFeedbackValue('happy')} className="p-2 rounded-full transition-all hover:scale-110 text-muted-foreground hover:text-green-500"><Smile className="w-16 h-16" /></button>
                        </div>
                    </div>
                )}
                <div className="pt-4"><Button variant="outline" onClick={() => router.push('/')}>Zurück zu Scoodol</Button></div>
            </div>
        ) : (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-end">
                    <Badge variant="secondary" className="px-3 py-1 uppercase tracking-widest font-black text-[10px]">{currentSlide?.type}</Badge>
                    <span className="text-xs font-mono font-bold text-muted-foreground">{currentIndex} / {data.slides.length - 2}</span>
                </div>
                
                {currentSlide?.type === 'multiple-choice' && (
                    <div className="space-y-8">
                        <h2 className="text-3xl font-black leading-tight">{currentSlide.content.question}</h2>
                        <div className="grid gap-3">
                            {currentSlide.content.options.map((opt: any) => (
                                <Button 
                                    key={opt.id} 
                                    variant="outline" 
                                    disabled={answerStatus !== 'none'}
                                    onClick={() => handleMcSelect(opt.id)}
                                    className={cn(
                                        "justify-start h-auto py-5 px-6 text-left border-2 text-lg transition-all",
                                        answerStatus !== 'none' && opt.isCorrect && "bg-green-500 border-green-600 text-white opacity-100",
                                        answerStatus !== 'none' && !opt.isCorrect && userAnswers[currentSlide.id] === opt.id && "bg-red-500 border-red-600 text-white opacity-100"
                                    )}
                                >
                                    {answerStatus !== 'none' && opt.isCorrect && <CheckCircle2 className="h-5 w-5 mr-3 shrink-0" />}
                                    {answerStatus !== 'none' && !opt.isCorrect && userAnswers[currentSlide.id] === opt.id && <XCircle className="h-5 w-5 mr-3 shrink-0" />}
                                    {opt.text}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {currentSlide?.type === 'short-answer' && (
                    <div className="space-y-8 text-center">
                        <h2 className="text-3xl font-black">{currentSlide.content.question}</h2>
                        <div className="max-w-md mx-auto space-y-4">
                            <Input 
                                placeholder="Deine Antwort..." 
                                className="text-2xl py-8 text-center font-bold"
                                disabled={answerStatus !== 'none'}
                                onKeyDown={e => e.key === 'Enter' && checkShortAnswer((e.target as HTMLInputElement).value)}
                            />
                            {answerStatus === 'none' ? (
                                <p className="text-xs text-muted-foreground">Drücke Enter zum Bestätigen</p>
                            ) : (
                                <div className={cn("p-4 rounded-xl font-bold flex items-center justify-center gap-2", answerStatus === 'correct' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                                    {answerStatus === 'correct' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                                    {answerStatus === 'correct' ? 'Richtig!' : `Falsch. Lösung: ${currentSlide.content.answer}`}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {currentSlide?.type === 'long-answer' && (
                    <div className="space-y-6">
                        <h2 className="text-3xl font-black">{currentSlide.content.question}</h2>
                        <Textarea 
                            placeholder="Schreibe hier deine ausführliche Antwort..." 
                            className="min-h-[200px] text-lg p-6"
                            disabled={answerStatus !== 'none'}
                        />
                        {answerStatus === 'none' && (
                            <Button className="w-full h-14 text-lg font-bold" onClick={() => {
                                const val = (document.querySelector('textarea') as HTMLTextAreaElement).value;
                                checkLongAnswerAction(val);
                            }} disabled={answerStatus === 'checking'}>
                                {answerStatus === 'checking' ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                                KI-Prüfung starten
                            </Button>
                        )}
                        {aiFeedback && (
                            <div className="p-6 rounded-2xl bg-secondary/50 border animate-in slide-in-from-top-2">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><Sparkles className="h-4 w-4" /> KI-Bewertung</span>
                                    <Badge className="text-lg px-3 py-1">{aiScore} / 10</Badge>
                                </div>
                                <p className="text-muted-foreground leading-relaxed">{aiFeedback}</p>
                            </div>
                        )}
                    </div>
                )}

                {currentSlide?.type === 'text' && (
                    <div className="space-y-6">
                        <h2 className="text-4xl font-black border-b pb-4">{currentSlide.content.title}</h2>
                        <div className="text-xl leading-relaxed text-muted-foreground whitespace-pre-wrap">{currentSlide.content.text}</div>
                    </div>
                )}

                <div className="pt-10 flex justify-between items-center border-t">
                    <Button variant="ghost" disabled={currentIndex === 0} onClick={() => setCurrentIndex(currentIndex - 1)}><ChevronLeft className="mr-2 h-4 w-4" /> Zurück</Button>
                    <Button size="lg" className="px-8 font-bold" onClick={handleNext} disabled={answerStatus === 'none' && currentSlide?.type !== 'text' && currentSlide?.type !== 'welcome'}>
                        {currentIndex === data.slides.length - 1 ? 'Abschließen' : 'Weiter'} <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        )}
      </main>

      <footer className="p-4 border-t bg-secondary/5">
        <div className="container mx-auto max-w-3xl">
            <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground mb-2">
                <span>Fortschritt</span>
                <span>{Math.round((currentIndex / (data.slides.length - 1)) * 100)}%</span>
            </div>
            <Progress value={(currentIndex / (data.slides.length - 1)) * 100} className="h-1.5" />
        </div>
      </footer>
    </div>
  );
}
