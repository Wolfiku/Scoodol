'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles, ChevronRight, CheckCircle2, Star, Frown, Meh, Smile, User, Shield } from 'lucide-react';
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
  isPublished?: boolean;
};

export default function PublicQuizPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const quizId = params?.quizId as string;

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
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const hasSaved = useRef(false);

  const quizDocRef = useMemoFirebase(() => 
    userId && quizId ? doc(firestore, `users/${userId}/quizzes`, quizId) : null
  , [firestore, userId, quizId]);

  const { data: quiz, isLoading: isLoadingQuiz } = useDoc<Quiz>(quizDocRef);

  const currentSlide = quiz?.slides[currentIndex];
  const totalQuestions = useMemo(() => quiz?.slides.filter(s => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length || 0, [quiz]);

  const handleNext = async () => {
    if (!quiz) return;
    
    if (currentIndex < quiz.slides.length - 1) {
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

  const checkShortAnswer = async () => {
    if (!userAnswer.trim() || !currentSlide) return;
    setAnswerStatus('checking');
    const { answer, checkMode, question } = currentSlide.content;
    let isCorrect = false;
    
    // First check without AI (case-insensitive)
    if (userAnswer.trim().toLowerCase() === answer.trim().toLowerCase()) {
        isCorrect = true;
    } else if (checkMode === 'ai') {
        const result = await verifyQuizAnswer(question, answer, userAnswer, aiLanguage);
        isCorrect = result.isCorrect;
    }
    
    if (isCorrect) setCorrectCount(prev => prev + 1);
    setAnswers(prev => ({ ...prev, [currentSlide.id]: isCorrect }));
    setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
  }

  const checkLongAnswerAction = async () => {
    if (!userAnswer.trim() || !currentSlide) return;
    setAnswerStatus('checking');
    const { question, referenceAnswer, criteria } = currentSlide.content;
    const result = await checkLongAnswer(question, referenceAnswer, criteria, userAnswer, aiLanguage);
    setAiScore(result.score);
    setAiFeedback(result.feedback);
    if (result.isCorrect) setCorrectCount(prev => prev + 1);
    setAnswers(prev => ({ ...prev, [currentSlide.id]: { text: userAnswer, score: result.score, isCorrect: result.isCorrect } }));
    setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
  }

  const handleMcSelect = (optionId: string) => {
    if (answerStatus !== 'none' || !currentSlide) return;
    setSelectedMcOption(optionId);
    const option = currentSlide.content.options.find((o: any) => o.id === optionId);
    const isCorrect = !!option?.isCorrect;
    if (isCorrect) setCorrectCount(prev => prev + 1);
    setAnswers(prev => ({ ...prev, [currentSlide.id]: optionId }));
    setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
  }

  const checkVocab = () => {
    if (!currentSlide) return;
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
    setAnswers(prev => ({ ...prev, [currentSlide.id]: allCorrect }));
    setAnswerStatus(allCorrect ? 'correct' : 'incorrect');
  }

  const saveResponse = async (rating?: 'sad' | 'neutral' | 'happy') => {
    if (hasSaved.current || !userId || !quizId) return;
    hasSaved.current = true;
    
    try {
        const responsesCol = collection(firestore, `users/${userId}/quizzes/${quizId}/responses`);
        await addDoc(responsesCol, {
            userName: userName || 'Anonym',
            answers: answers,
            percentage: Math.round((correctCount / (totalQuestions || 1)) * 100),
            rating: rating || null,
            completedAt: serverTimestamp(),
        });
    } catch (e) {
        console.error("Error saving response", e);
    }
  }

  if (isLoadingQuiz) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  if (!quiz || !quiz.isPublished) return <div className="flex items-center justify-center h-screen">Dieses Quiz ist nicht verfügbar oder wurde offline genommen.</div>;

  return (
    <div className="flex flex-col h-screen bg-background">
        <main className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center">
            {currentSlide?.type === 'welcome' ? (
                <div className="text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-300">
                    <h1 className="text-4xl font-extrabold">{quiz.title}</h1>
                    <p className="text-muted-foreground">von {quiz.creator}</p>
                    <div className="flex justify-center gap-2">
                        <Badge variant="outline">
                            {currentSlide.content.askName ? <User className="w-3 h-3 mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
                            {currentSlide.content.askName ? 'Name erforderlich' : 'Anonym'}
                        </Badge>
                    </div>
                    {currentSlide.content.askName && (
                        <div className="space-y-2 text-left">
                            <Label>Dein Name</Label>
                            <Input placeholder="Wie heißt du?" value={userName} onChange={(e) => setUserName(e.target.value)} className="text-lg py-6" />
                        </div>
                    )}
                    <Button className="w-full h-12 text-lg font-bold" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>Quiz starten</Button>
                </div>
            ) : currentSlide?.type === 'multiple-choice' ? (
                <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right duration-300">
                    <h2 className="text-2xl font-bold">{currentSlide.content.question}</h2>
                    <div className="grid gap-3">
                        {(currentSlide.content.options || []).map((opt: any) => {
                            const isSelected = selectedMcOption === opt.id;
                            const isCorrect = opt.isCorrect;
                            let btnClass = "justify-start h-auto py-4 px-6 text-left border-2 text-lg transition-all";
                            if (answerStatus !== 'none') {
                                if (isCorrect) btnClass += " bg-green-600 border-green-700 text-white hover:bg-green-600";
                                else if (isSelected && !isCorrect) btnClass += " bg-red-600 border-red-700 text-white hover:bg-red-600";
                            }
                            return (
                                <Button key={opt.id} variant="outline" disabled={answerStatus !== 'none'} onClick={() => handleMcSelect(opt.id)} className={btnClass}>
                                    {opt.text}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            ) : currentSlide?.type === 'short-answer' ? (
                <div className="w-full max-w-xl space-y-8 text-center animate-in slide-in-from-right duration-300">
                    <h2 className="text-2xl font-bold">{currentSlide.content.question}</h2>
                    <div className="relative">
                        <Input placeholder="Antwort..." value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-xl py-8 px-6 text-center" />
                        {answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin" />}
                    </div>
                    {answerStatus === 'none' && <Button size="lg" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Prüfen</Button>}
                    {answerStatus === 'correct' && <p className="text-green-600 font-bold animate-in zoom-in">Richtig!</p>}
                    {answerStatus === 'incorrect' && <p className="text-red-600 font-bold animate-in zoom-in">Falsch. Lösung: {currentSlide.content.answer}</p>}
                </div>
            ) : currentSlide?.type === 'long-answer' ? (
                <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right duration-300">
                    <h2 className="text-2xl font-bold">{currentSlide.content.question}</h2>
                    <div className="relative">
                        <Textarea placeholder="Schreibe hier deine Antwort..." value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-lg p-6 min-h-[180px]" />
                        {answerStatus === 'checking' && <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center rounded-md z-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /><p className="font-bold">KI prüft...</p></div>}
                    </div>
                    {answerStatus === 'none' && <Button size="lg" onClick={checkLongAnswerAction} disabled={!userAnswer.trim()}>KI-Prüfung starten</Button>}
                    {aiFeedback && (
                        <div className="p-4 rounded-lg bg-secondary/50 mt-4 animate-in slide-in-from-top-2 duration-300">
                            <p className="text-sm font-bold flex items-center gap-2 mb-1"><Sparkles className="w-4 h-4 text-primary" /> KI-Feedback ({aiScore}/10):</p>
                            <p className="text-sm">{aiFeedback}</p>
                        </div>
                    )}
                </div>
            ) : currentSlide?.type === 'vocabulary' ? (
                <div className="w-full max-w-2xl space-y-6 animate-in slide-in-from-right duration-300">
                    <h2 className="text-2xl font-bold mb-4 text-center">Vokabel-Check</h2>
                    <div className="grid gap-4">
                        {currentSlide.content.pairs.map((pair: any) => (
                        <div key={pair.id} className="grid grid-cols-[1fr_1fr] gap-4 items-center">
                            <div className="text-right font-medium text-lg">{pair.foreign}</div>
                            <Input 
                            placeholder="Übersetzung..." 
                            value={vocabAnswers[pair.id] || ''} 
                            onChange={(e) => setVocabAnswers(prev => ({...prev, [pair.id]: e.target.value}))}
                            className={cn(
                                "text-center py-6",
                                vocabResults[pair.id] === true && "border-green-500 bg-green-50",
                                vocabResults[pair.id] === false && "border-red-500 bg-red-50"
                            )}
                            disabled={answerStatus !== 'none'}
                            />
                        </div>
                        ))}
                    </div>
                    {answerStatus === 'none' && (
                        <Button className="w-full h-12 text-lg mt-4" onClick={checkVocab}>Ergebnisse prüfen</Button>
                    )}
                </div>
            ) : currentSlide?.type === 'text' ? (
                <div className="w-full max-w-2xl space-y-6 animate-in slide-in-from-right duration-300">
                    <h2 className="text-3xl font-bold border-b pb-4">{currentSlide.content.title}</h2>
                    <div className="text-lg leading-relaxed whitespace-pre-wrap text-muted-foreground">
                        {currentSlide.content.text}
                    </div>
                </div>
            ) : currentSlide?.type === 'conclusion' ? (
                <div className="text-center space-y-10 w-full max-w-md animate-in zoom-in duration-500">
                    <div className="space-y-4">
                        <h1 className="text-5xl font-extrabold tracking-tight">Vielen Dank!</h1>
                        <p className="text-xl text-muted-foreground font-medium">
                            Du bist mit dem Quiz fertig! Du kannst diese Seite nun schließen.
                        </p>
                    </div>

                    {currentSlide.content.showScore && (
                        <div className="p-8 bg-primary/5 rounded-2xl border-2 border-primary/10 space-y-2">
                            <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Dein Ergebnis</p>
                            <p className="text-7xl font-black text-primary">{totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%</p>
                            <p className="text-sm text-muted-foreground">{correctCount} von {totalQuestions} richtig</p>
                        </div>
                    )}

                    {currentSlide.content.collectFeedback && (
                        <div className="space-y-6">
                            <p className="font-bold text-lg">Wie fandest du das Quiz?</p>
                            <div className="flex justify-center gap-8">
                                <button 
                                    onClick={() => { setFeedbackValue('sad'); saveResponse('sad'); }}
                                    className={cn(
                                        "p-2 rounded-full transition-colors",
                                        feedbackValue === 'sad' ? "bg-red-100 text-red-600" : "text-muted-foreground hover:text-red-400"
                                    )}
                                >
                                    <Frown className="w-16 h-16" />
                                </button>
                                <button 
                                    onClick={() => { setFeedbackValue('neutral'); saveResponse('neutral'); }}
                                    className={cn(
                                        "p-2 rounded-full transition-colors",
                                        feedbackValue === 'neutral' ? "bg-amber-100 text-amber-600" : "text-muted-foreground hover:text-amber-400"
                                    )}
                                >
                                    <Meh className="w-16 h-16" />
                                </button>
                                <button 
                                    onClick={() => { setFeedbackValue('happy'); saveResponse('happy'); }}
                                    className={cn(
                                        "p-2 rounded-full transition-colors",
                                        feedbackValue === 'happy' ? "bg-green-100 text-green-600" : "text-muted-foreground hover:text-green-400"
                                    )}
                                >
                                    <Smile className="w-16 h-16" />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <Button className="w-full h-14 text-lg font-bold" onClick={() => saveResponse(feedbackValue || undefined)}>
                            Quiz beenden
                        </Button>
                        {currentSlide.content.collectFeedback && !feedbackValue && (
                            <Button variant="ghost" onClick={() => saveResponse()}>
                                Ohne Bewertung beenden
                            </Button>
                        )}
                    </div>
                </div>
            ) : null}
        </main>

        <footer className="p-2 px-4 border-t bg-secondary/10 relative">
            <div className="flex justify-end mb-1">
                <span className="text-[10px] font-mono font-bold text-muted-foreground">{currentIndex + 1} / {quiz.slides.length}</span>
            </div>
            <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentIndex + 1) / quiz.slides.length) * 100}%` }} />
            </div>
            <div className="flex justify-end mt-2">
                <Button size="sm" onClick={handleNext} disabled={currentIndex === quiz.slides.length - 1 || answerStatus === 'checking'}>
                    Weiter <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </footer>
    </div>
  );
}