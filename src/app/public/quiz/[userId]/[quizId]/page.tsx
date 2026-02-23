
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check, X, AlertCircle, ChevronRight, Sparkles, User, Shield, FileText, BarChart3, Frown, Meh, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import { verifyQuizAnswer, checkLongAnswer } from '@/app/actions';
import { useTheme } from '@/hooks/use-theme';

type Slide = {
  id: string;
  type: string;
  content: any;
};

type Quiz = {
  title: string;
  creator: string;
  slides: Slide[];
  isPublished?: boolean;
};

export default function PublicQuizPage() {
  const params = useParams();
  const { userId, quizId } = params;
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { aiLanguage } = useTheme();

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
  const [allAnswers, setAllAnswers] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAlreadyDone, setIsAlreadyDone] = useState(false);

  const quizDocRef = useMemoFirebase(() => 
    userId && quizId ? doc(firestore, `users/${userId}/quizzes/${quizId}`) : null
  , [firestore, userId, quizId]);

  const { data: quiz, isLoading: isLoadingQuiz } = useDoc<Quiz>(quizDocRef);

  useEffect(() => {
    if (typeof window !== 'undefined' && quizId) {
        const done = localStorage.getItem(`quiz_done_${quizId}`);
        if (done) setIsAlreadyDone(true);
    }
  }, [quizId]);

  useEffect(() => {
    if (quiz?.slides) {
        const count = quiz.slides.filter(s => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length;
        setTotalQuestions(count);
    }
  }, [quiz]);

  const currentSlide = quiz?.slides[currentIndex];

  const handleNext = async () => {
    // Record current answer
    if (currentSlide && currentSlide.type !== 'welcome' && currentSlide.type !== 'text' && currentSlide.type !== 'conclusion') {
        const answerData = {
            slideId: currentSlide.id,
            type: currentSlide.type,
            question: currentSlide.content.question,
            answer: currentSlide.type === 'multiple-choice' ? selectedMcOption : (currentSlide.type === 'vocabulary' ? vocabAnswers : userAnswer),
            isCorrect: answerStatus === 'correct',
            score: aiScore,
            feedback: aiFeedback
        };
        setAllAnswers(prev => [...prev, answerData]);
        if (answerStatus === 'correct') setCorrectCount(prev => prev + 1);
    }

    if (currentIndex < (quiz?.slides.length || 0) - 1) {
        setCurrentIndex(currentIndex + 1);
        setAnswerStatus('none');
        setUserAnswer('');
        setSelectedMcOption(null);
        setAiFeedback(null);
        setAiScore(null);
        setVocabAnswers({});
        setVocabResults({});
    } else {
        await saveResults();
    }
  };

  const saveResults = async () => {
    if (isSaving || !quizId || !userId) return;
    setIsSaving(true);
    try {
        const resultsRef = collection(firestore, `users/${userId}/quizzes/${quizId}/responses`);
        await addDoc(resultsRef, {
            name: userName || 'Anonym',
            answers: allAnswers,
            correctCount,
            totalQuestions,
            percentage: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
            rating: feedbackValue,
            completedAt: serverTimestamp()
        });
        localStorage.setItem(`quiz_done_${quizId}`, 'true');
        toast({ title: "Ergebnisse gespeichert!" });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Fehler beim Speichern" });
    } finally {
        setIsSaving(false);
    }
  }

  const normalizeText = (text: string) => text.trim().toLowerCase().replace(/ss/g, 'ß').replace(/\s+/g, ' ');

  const checkShortAnswer = async () => {
    if (!userAnswer.trim()) return;
    setAnswerStatus('checking');
    const { answer, answerType, checkMode, question } = currentSlide?.content;
    let isCorrect = false;
    if (answerType === 'year') {
        isCorrect = userAnswer.trim() === answer.trim();
    } else {
        if (checkMode === 'strict') isCorrect = userAnswer.trim() === answer.trim();
        else if (checkMode === 'helpfull') isCorrect = normalizeText(userAnswer) === normalizeText(answer);
        else if (checkMode === 'ai') {
            if (normalizeText(userAnswer) === normalizeText(answer)) isCorrect = true;
            else {
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
    const { question, referenceAnswer, criteria } = currentSlide?.content;
    const result = await checkLongAnswer(question, referenceAnswer, criteria, userAnswer, aiLanguage);
    setAiScore(result.score);
    setAiFeedback(result.feedback);
    setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
  }

  const checkVocabulary = () => {
    const { pairs, checkMode } = currentSlide?.content;
    const results: Record<string, boolean> = {};
    let allCorrect = true;
    pairs.forEach((pair: any) => {
        const userVal = vocabAnswers[pair.id] || '';
        const correctVal = pair.german;
        let isCorrect = checkMode === 'strict' ? userVal.trim() === correctVal.trim() : normalizeText(userVal) === normalizeText(correctVal);
        results[pair.id] = isCorrect;
        if (!isCorrect) allCorrect = false;
    });
    setVocabResults(results);
    setAnswerStatus(allCorrect ? 'correct' : 'incorrect');
  }

  const handleMcSelect = (optionId: string) => {
    if (answerStatus !== 'none') return;
    setSelectedMcOption(optionId);
    const option = currentSlide?.content.options.find((o: any) => o.id === optionId);
    setAnswerStatus(option.isCorrect ? 'correct' : 'incorrect');
  }

  if (isLoadingQuiz) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary w-12 h-12" /></div>;
  if (!quiz || !quiz.isPublished) return <div className="flex items-center justify-center min-h-screen"><p>Dieses Quiz ist nicht verfügbar.</p></div>;
  if (isAlreadyDone) return <div className="flex items-center justify-center min-h-screen text-center p-4"><Card className="max-w-md"><CardContent className="p-8 space-y-4"><h2 className="text-2xl font-bold">Teilnahme bereits erfolgt</h2><p>Du hast an diesem Quiz bereits teilgenommen. Vielen Dank!</p><Button onClick={() => router.push('/')}>Zurück zur App</Button></CardContent></Card></div>;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
        {currentSlide?.type === 'welcome' && (
            <div className="text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-300">
                <h1 className="text-4xl font-extrabold">{quiz.title}</h1>
                <p className="text-muted-foreground">von {quiz.creator}</p>
                <div className="flex flex-wrap justify-center gap-3">
                    <Badge variant="outline" className="bg-background">
                        {currentSlide.content.askName ? <User className="w-3 h-3 mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
                        {currentSlide.content.askName ? 'Name erforderlich' : 'Anonym'}
                    </Badge>
                    {quiz.slides.some(s => s.type === 'long-answer') && <Badge variant="outline"><Sparkles className="w-3 h-3 mr-1" /> KI-gestützt</Badge>}
                </div>
                {currentSlide.content.askName && (
                    <div className="space-y-2 text-left">
                        <Label>Wie heißt du?</Label>
                        <Input placeholder="Dein Name..." value={userName} onChange={e => setUserName(e.target.value)} className="text-lg py-6" />
                    </div>
                )}
                <Button className="w-full text-lg py-6 font-bold" size="lg" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>Quiz starten</Button>
            </div>
        )}

        {currentSlide?.type === 'multiple-choice' && (
            <div className="w-full max-w-2xl space-y-8">
                <h2 className="text-2xl md:text-3xl font-bold">{currentSlide.content.question}</h2>
                <div className="grid gap-3">
                    {currentSlide.content.options.map((opt: any, i: number) => {
                        const isSelected = selectedMcOption === opt.id;
                        const isCorrect = opt.isCorrect;
                        let variant: "outline" | "default" | "destructive" = "outline";
                        if (answerStatus !== 'none') {
                            if (isCorrect) variant = "default";
                            else if (isSelected && !isCorrect) variant = "destructive";
                        }
                        return (
                            <Button key={opt.id} variant={variant} disabled={answerStatus !== 'none'} onClick={() => handleMcSelect(opt.id)} className={cn("justify-start h-auto py-4 px-6 text-left text-base border-2", variant === "default" && "bg-green-600 hover:bg-green-600 text-white", variant === "destructive" && "bg-red-600 hover:bg-red-600 text-white")}>
                                <span className="h-8 w-8 rounded-full border-2 mr-4 flex items-center justify-center font-bold text-xs">{String.fromCharCode(65 + i)}</span>
                                <span className="flex-1">{opt.text}</span>
                                {answerStatus !== 'none' && isCorrect && <Check className="ml-2 h-5 w-5" />}
                                {answerStatus !== 'none' && isSelected && !isCorrect && <X className="ml-2 h-5 w-5" />}
                            </Button>
                        );
                    })}
                </div>
            </div>
        )}

        {currentSlide?.type === 'short-answer' && (
            <div className="w-full max-w-xl space-y-8">
                <h2 className="text-2xl md:text-3xl font-bold">{currentSlide.content.question}</h2>
                <div className="relative">
                    <Input placeholder="Deine Antwort..." value={userAnswer} onChange={e => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className={cn("text-xl py-8 px-6", answerStatus === 'correct' && "border-green-500", answerStatus === 'incorrect' && "border-red-500")} />
                    {answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
                </div>
                {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Prüfen</Button>}
                {answerStatus !== 'none' && answerStatus !== 'checking' && (
                    <div className={cn("p-4 rounded-lg", answerStatus === 'correct' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                        <p className="font-bold">{answerStatus === 'correct' ? 'Richtig!' : 'Nicht ganz.'}</p>
                        {answerStatus === 'incorrect' && <p>Richtig wäre: {currentSlide.content.answer}</p>}
                    </div>
                )}
            </div>
        )}

        {currentSlide?.type === 'long-answer' && (
            <div className="w-full max-w-2xl space-y-8">
                <h2 className="text-2xl md:text-3xl font-bold">{currentSlide.content.question}</h2>
                <div className="relative">
                    <Textarea placeholder="Schreibe hier deine Antwort..." value={userAnswer} onChange={e => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-lg p-6 min-h-[180px]" />
                    {answerStatus === 'checking' && <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center"><Loader2 className="animate-spin text-primary h-8 w-8 mb-2" /><p>KI bewertet...</p></div>}
                </div>
                {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkLongAnswerAction} disabled={!userAnswer.trim() || userAnswer.length < 5}>Von KI prüfen lassen</Button>}
                {answerStatus !== 'none' && answerStatus !== 'checking' && aiFeedback && (
                    <div className={cn("p-4 rounded-lg space-y-2", answerStatus === 'correct' ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")}>
                        <p className="font-bold">{answerStatus === 'correct' ? 'Super!' : 'Fast geschafft.'}</p>
                        <p className="text-sm">{aiFeedback}</p>
                        {currentSlide.content.enablePoints && <Badge>Punkte: {aiScore}/10</Badge>}
                    </div>
                )}
            </div>
        )}

        {currentSlide?.type === 'vocabulary' && (
            <div className="w-full max-w-2xl space-y-8">
                <h2 className="text-2xl font-bold">Übersetzung</h2>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    {currentSlide.content.pairs.map((pair: any) => (
                        <div key={pair.id} className="space-y-1">
                            <div className="grid grid-cols-2 gap-4 p-3 bg-secondary/30 rounded-lg">
                                <span className="font-semibold">{pair.foreign}</span>
                                <Input placeholder="..." value={vocabAnswers[pair.id] || ''} onChange={e => setVocabAnswers(prev => ({...prev, [pair.id]: e.target.value}))} disabled={answerStatus !== 'none'} />
                            </div>
                            {answerStatus !== 'none' && vocabResults[pair.id] === false && <p className="text-xs text-red-600 px-3">Richtig: {pair.german}</p>}
                        </div>
                    ))}
                </div>
                {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkVocabulary}>Vokabeln prüfen</Button>}
            </div>
        )}

        {currentSlide?.type === 'text' && (
            <div className="w-full max-w-2xl space-y-8">
                <h2 className="text-3xl font-extrabold">{currentSlide.content.title}</h2>
                <Card className="bg-secondary/10"><CardContent className="p-6 text-lg text-muted-foreground whitespace-pre-wrap">{currentSlide.content.text}</CardContent></Card>
            </div>
        )}

        {currentSlide?.type === 'conclusion' && (
            <div className="text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in">
                <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary"><Check className="h-10 w-10" /></div>
                <h1 className="text-4xl font-extrabold">Fertig!</h1>
                {currentSlide.content.showScore && <div className="text-6xl font-black text-primary">{Math.round((correctCount/totalQuestions)*100)}%</div>}
                {currentSlide.content.collectFeedback && (
                    <div className="space-y-4">
                        <Label>Wie war das Quiz?</Label>
                        <div className="flex justify-center gap-6">
                            <button onClick={() => setFeedbackValue('sad')} className={cn("transition-all", feedbackValue === 'sad' ? "text-red-500 scale-125" : "text-muted-foreground")}><Frown className="h-10 w-10" /></button>
                            <button onClick={() => setFeedbackValue('neutral')} className={cn("transition-all", feedbackValue === 'neutral' ? "text-amber-500 scale-125" : "text-muted-foreground")}><Meh className="h-10 w-10" /></button>
                            <button onClick={() => setFeedbackValue('happy')} className={cn("transition-all", feedbackValue === 'happy' ? "text-green-500 scale-125" : "text-muted-foreground")}><Smile className="h-10 w-10" /></button>
                        </div>
                    </div>
                )}
                <Button size="lg" className="w-full" onClick={() => router.push('/')}>Abschließen</Button>
            </div>
        )}
      </main>

      <footer className="border-t p-4 bg-background/80 backdrop-blur-md sticky bottom-0">
        <div className="container mx-auto flex items-center justify-between gap-4">
            <div className="flex-1 max-w-xs space-y-1">
                <p className="text-xs font-bold truncate">{quiz.title}</p>
                <Progress value={((currentIndex+1)/quiz.slides.length)*100} className="h-1.5" />
            </div>
            <div className="text-xs font-mono hidden sm:block">{currentIndex + 1} / {quiz.slides.length}</div>
            <Button onClick={handleNext} disabled={currentIndex === quiz.slides.length - 1 || answerStatus === 'checking' || (currentSlide?.type !== 'welcome' && currentSlide?.type !== 'text' && currentSlide?.type !== 'conclusion' && answerStatus === 'none')}>
                Weiter <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
      </footer>
    </div>
  );
}
