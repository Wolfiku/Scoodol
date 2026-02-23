
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Check, User, Shield, Sparkles, ChevronRight, X, AlertCircle, Frown, Meh, Smile, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  slides: Slide[];
  ownerId: string;
  isPublished?: boolean;
};

export default function PublicQuizPage() {
  const router = useRouter();
  const params = useParams();
  const { userId, quizId } = params;

  const { toast } = useToast();
  const firestore = useFirestore();
  const { aiLanguage } = useTheme();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userName, setUserName] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [vocabAnswers, setVocabAnswers] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [answerStatus, setAnswerStatus] = useState<'none' | 'correct' | 'incorrect' | 'checking'>('none');
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [selectedMcOption, setSelectedMcOption] = useState<string | null>(null);
  const [feedbackValue, setFeedbackValue] = useState<'sad' | 'neutral' | 'happy' | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quizDocRef = useMemoFirebase(() => 
    typeof quizId === 'string' ? doc(firestore, `users/${userId}/quizzes`, quizId) : null
  , [firestore, userId, quizId]);

  const { data: quiz, isLoading: isLoadingQuiz } = useDoc<Quiz>(quizDocRef);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const finishedKey = `quiz-done-${quizId}`;
        if (localStorage.getItem(finishedKey)) {
            setIsFinished(true);
        }
    }
  }, [quizId]);

  const currentSlide = quiz?.slides[currentIndex];
  const totalQuestions = useMemo(() => quiz?.slides.filter(s => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length || 0, [quiz]);

  const handleNext = async () => {
    if (currentIndex > 0 && answerStatus === 'correct') {
        setCorrectCount(prev => prev + 1);
    }

    if (currentSlide?.type === 'conclusion') {
        await submitResults();
        return;
    }

    if (currentIndex < (quiz?.slides.length || 0) - 1) {
        setCurrentIndex(currentIndex + 1);
        setAnswerStatus('none');
        setUserAnswer('');
        setSelectedMcOption(null);
        setAiFeedback(null);
        setAiScore(null);
    }
  };

  const submitResults = async () => {
    if (!firestore || isSubmitting) return;
    setIsSubmitting(true);
    try {
        const responseData = {
            userName: userName || 'Anonym',
            answers,
            percentage: Math.round((correctCount / totalQuestions) * 100),
            rating: feedbackValue,
            completedAt: serverTimestamp(),
        };
        const responsesCol = collection(firestore, `users/${userId}/quizzes/${quizId}/responses`);
        await addDoc(responsesCol, responseData);
        localStorage.setItem(`quiz-done-${quizId}`, 'true');
        setIsFinished(true);
        toast({ title: "Ergebnisse gespeichert!" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Fehler beim Speichern." });
    } finally {
        setIsSubmitting(false);
    }
  }

  const checkShortAnswer = async () => {
    if (!userAnswer.trim()) return;
    setAnswerStatus('checking');
    const { answer, checkMode, question } = currentSlide?.content;
    let isCorrect = false;
    if (checkMode === 'strict') isCorrect = userAnswer.trim() === answer.trim();
    else if (checkMode === 'helpfull') isCorrect = userAnswer.trim().toLowerCase() === answer.trim().toLowerCase();
    else {
        const result = await verifyQuizAnswer(question, answer, userAnswer, aiLanguage);
        isCorrect = result.isCorrect;
    }
    setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    setAnswers(prev => ({ ...prev, [currentSlide!.id]: isCorrect }));
  }

  const checkLongAnswerAction = async () => {
    if (!userAnswer.trim()) return;
    setAnswerStatus('checking');
    const { question, referenceAnswer, criteria } = currentSlide?.content;
    const result = await checkLongAnswer(question, referenceAnswer, criteria, userAnswer, aiLanguage);
    setAiScore(result.score);
    setAiFeedback(result.feedback);
    setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
    setAnswers(prev => ({ ...prev, [currentSlide!.id]: { text: userAnswer, score: result.score, isCorrect: result.isCorrect } }));
  }

  const handleMcSelect = (optionId: string) => {
    if (answerStatus !== 'none') return;
    setSelectedMcOption(optionId);
    const option = currentSlide?.content.options.find((o: any) => o.id === optionId);
    const isCorrect = option.isCorrect;
    setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    setAnswers(prev => ({ ...prev, [currentSlide!.id]: optionId }));
  }

  if (isLoadingQuiz) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin" /></div>;
  if (!quiz || !quiz.isPublished) return <div className="flex items-center justify-center h-screen">Dieses Quiz ist nicht verfügbar oder offline.</div>;

  if (isFinished) {
      return (
          <div className="flex flex-col items-center justify-center h-screen p-6 text-center space-y-6">
              <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center text-green-600"><Check className="h-10 w-10"/></div>
              <h1 className="text-3xl font-bold">Geschafft!</h1>
              <p className="text-muted-foreground">Du hast das Quiz erfolgreich beendet. Deine Ergebnisse wurden an {quiz.creator} gesendet.</p>
              <Button variant="outline" onClick={() => router.push('/')}>Zurück zur Startseite</Button>
          </div>
      )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <main className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center">
        {currentSlide?.type === 'welcome' ? (
            <div className="text-center space-y-8 max-w-md w-full">
                <h1 className="text-4xl font-extrabold">{quiz.title}</h1>
                <p className="text-muted-foreground">von {quiz.creator}</p>
                <div className="flex flex-wrap justify-center gap-3">
                    <Badge variant="outline" className="bg-background">{currentSlide.content.askName ? <User className="w-3.5 h-3.5 mr-2" /> : <Shield className="w-3.5 h-3.5 mr-2" />}{currentSlide.content.askName ? 'Name erforderlich' : 'Anonymes Quiz'}</Badge>
                    {quiz.slides.some(s => s.type === 'long-answer') && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20"><Sparkles className="w-3.5 h-3.5 mr-2" /> KI-gestützt</Badge>}
                </div>
                {currentSlide.content.askName && (
                    <div className="space-y-2 text-left">
                        <Label>Dein Name</Label>
                        <Input placeholder="Wie heißt du?" value={userName} onChange={e => setUserName(e.target.value)} />
                    </div>
                )}
                <Button className="w-full" size="lg" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>Starten</Button>
            </div>
        ) : currentSlide?.type === 'multiple-choice' ? (
            <div className="w-full max-w-2xl space-y-8">
                <h2 className="text-2xl font-bold">{currentSlide.content.question}</h2>
                <div className="grid gap-3">
                    {currentSlide.content.options.map((opt: any) => {
                        const isSelected = selectedMcOption === opt.id;
                        const isCorrect = opt.isCorrect;
                        let btnClass = "justify-start h-auto py-4 px-6 text-left border-2";
                        if (answerStatus !== 'none') {
                            if (isCorrect) btnClass += " bg-green-600 border-green-700 text-white";
                            else if (isSelected && !isCorrect) btnClass += " bg-red-600 border-red-700 text-white";
                        }
                        return (
                            <Button key={opt.id} variant="outline" disabled={answerStatus !== 'none'} onClick={() => handleMcSelect(opt.id)} className={btnClass}>{opt.text}</Button>
                        );
                    })}
                </div>
            </div>
        ) : currentSlide?.type === 'short-answer' ? (
            <div className="w-full max-w-xl space-y-8 text-center">
                <h2 className="text-2xl font-bold">{currentSlide.content.question}</h2>
                <div className="relative">
                    <Input placeholder="..." value={userAnswer} onChange={e => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-xl py-8 text-center" />
                    {answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin" />}
                </div>
                {answerStatus === 'none' && <Button size="lg" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Prüfen</Button>}
                {answerStatus === 'correct' && <p className="text-green-600 font-bold">Richtig!</p>}
                {answerStatus === 'incorrect' && <p className="text-red-600 font-bold">Falsch. Lösung: {currentSlide.content.answer}</p>}
            </div>
        ) : currentSlide?.type === 'long-answer' ? (
            <div className="w-full max-w-2xl space-y-8">
                <h2 className="text-2xl font-bold">{currentSlide.content.question}</h2>
                <div className="relative">
                    <Textarea placeholder="Schreibe..." value={userAnswer} onChange={e => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-lg p-6 min-h-[180px]" />
                    {answerStatus === 'checking' && <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center rounded-md"><Loader2 className="animate-spin h-8 w-8" /><p>KI prüft...</p></div>}
                </div>
                {answerStatus === 'none' && <Button size="lg" onClick={checkLongAnswerAction} disabled={!userAnswer.trim()}>Prüfung starten</Button>}
                {aiFeedback && <div className="p-4 rounded-lg bg-secondary/50 mt-4"><p className="text-sm font-bold">Feedback:</p><p className="text-sm">{aiFeedback}</p></div>}
            </div>
        ) : currentSlide?.type === 'conclusion' ? (
            <div className="text-center space-y-8">
                <h1 className="text-4xl font-extrabold">Quiz beendet!</h1>
                {currentSlide.content.collectFeedback && (
                    <div className="space-y-4">
                        <Label className="text-lg">Wie hat es dir gefallen?</Label>
                        <div className="flex justify-center gap-8">
                            <button onClick={() => setFeedbackValue('sad')} className={cn("transition-transform hover:scale-110", feedbackValue === 'sad' ? "text-red-500 scale-125" : "text-muted-foreground")}><Frown className="h-12 w-12"/></button>
                            <button onClick={() => setFeedbackValue('neutral')} className={cn("transition-transform hover:scale-110", feedbackValue === 'neutral' ? "text-amber-500 scale-125" : "text-muted-foreground")}><Meh className="h-12 w-12"/></button>
                            <button onClick={() => setFeedbackValue('happy')} className={cn("transition-transform hover:scale-110", feedbackValue === 'happy' ? "text-green-500 scale-125" : "text-muted-foreground")}><Smile className="h-12 w-12"/></button>
                        </div>
                    </div>
                )}
                <Button size="lg" className="w-full max-w-sm" onClick={handleNext} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : 'Speichern & Beenden'}</Button>
            </div>
        ) : null}
      </main>

      <footer className="p-2 px-4 border-t bg-secondary/10">
        <div className="flex justify-end mb-1">
            <span className="text-[10px] font-mono font-bold text-muted-foreground">{currentIndex + 1} / {quiz.slides.length}</span>
        </div>
        <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentIndex + 1) / quiz.slides.length) * 100}%` }} />
        </div>
        <div className="flex justify-end mt-2">
            <Button size="sm" onClick={handleNext} disabled={currentIndex === quiz.slides.length - 1 || answerStatus === 'checking'}>
                {currentIndex === quiz.slides.length - 1 ? 'Fertig' : 'Weiter'} <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
      </footer>
    </div>
  );
}
