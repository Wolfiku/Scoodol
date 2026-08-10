
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ChevronRight, ChevronLeft, Smile, Meh, Frown, Sparkles, CheckCircle2, Shield, User } from 'lucide-react';
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
  isPublished?: boolean;
};

export default function PublicQuizPage() {
    const params = useParams();
    const { userId, quizId } = params;
    const firestore = useFirestore();
    const { aiLanguage } = useTheme();
    
    const quizRef = useMemoFirebase(() => 
        (userId && quizId) ? doc(firestore, `users/${userId}/quizzes`, quizId as string) : null
    , [firestore, userId, quizId]);

    const { data: quiz, isLoading } = useDoc<Quiz>(quizRef);

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
    
    // Store all answers to submit at the end
    const [allAnswers, setAllAnswers] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFinished, setIsSubfinished] = useState(false);

    const slides = useMemo(() => quiz?.slides || [], [quiz]);
    const currentSlide = slides[currentIndex];
    const totalQuestions = useMemo(() => slides.filter(s => !['welcome', 'text', 'conclusion'].includes(s.type)).length, [slides]);

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
        }
    };

    const submitResponse = async () => {
        if (!userId || !quizId || !firestore) return;
        setIsSubmitting(true);
        try {
            const responsesRef = collection(firestore, `users/${userId}/quizzes/${quizId}/responses`);
            await addDoc(responsesRef, {
                userName: userName || 'Anonym',
                answers: allAnswers,
                percentage: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
                rating: feedbackValue,
                completedAt: serverTimestamp()
            });
            setIsSubfinished(true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const checkShortAnswer = async () => {
        if (!userAnswer.trim()) return;
        setAnswerStatus('checking');
        const { answer, checkMode, question } = currentSlide.content;
        
        let correct = false;
        if (userAnswer.trim().toLowerCase() === answer.trim().toLowerCase()) {
            correct = true;
        } else if (checkMode === 'ai') {
            const result = await verifyQuizAnswer(question, answer, userAnswer, aiLanguage);
            correct = result.isCorrect;
        }

        if (correct) setCorrectCount(prev => prev + 1);
        setAllAnswers(prev => ({ ...prev, [currentSlide.id]: correct }));
        setAnswerStatus(correct ? 'correct' : 'incorrect');
    }

    const checkLongAnswerAction = async () => {
        if (!userAnswer.trim()) return;
        setAnswerStatus('checking');
        const { question, referenceAnswer, criteria } = currentSlide.content;
        const result = await checkLongAnswer(question, referenceAnswer, criteria, userAnswer, aiLanguage);
        
        setAiScore(result.score);
        setAiFeedback(result.feedback);
        if (result.isCorrect) setCorrectCount(prev => prev + 1);
        
        setAllAnswers(prev => ({ 
            ...prev, 
            [currentSlide.id]: { text: userAnswer, score: result.score, isCorrect: result.isCorrect } 
        }));
        setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
    }

    const handleMcSelect = (optionId: string) => {
        if (answerStatus !== 'none') return;
        setSelectedMcOption(optionId);
        const option = currentSlide.content.options.find((o: any) => o.id === optionId);
        
        if (option.isCorrect) setCorrectCount(prev => prev + 1);
        setAllAnswers(prev => ({ ...prev, [currentSlide.id]: optionId }));
        setAnswerStatus(option.isCorrect ? 'correct' : 'incorrect');
    }

    if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
    if (!quiz || !quiz.isPublished) return <div className="flex items-center justify-center h-screen text-muted-foreground">Dieses Quiz ist nicht verfügbar oder existiert nicht.</div>;

    return (
        <div className="flex flex-col h-screen bg-background overflow-hidden">
            <header className="p-4 border-b bg-secondary/10 flex justify-between items-center">
                <span className="font-bold text-sm truncate max-w-[200px]">{quiz.title}</span>
                <span className="text-xs font-mono">{currentIndex + 1} / {slides.length}</span>
            </header>

            <main className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center">
                {!currentSlide ? (
                    <div className="text-center">Fehler beim Laden der Folie.</div>
                ) : currentSlide.type === 'welcome' ? (
                    <div className="text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-500">
                        <h1 className="text-4xl font-extrabold">{quiz.title}</h1>
                        <p className="text-muted-foreground">von {quiz.creator}</p>
                        {currentSlide.content.askName && (
                            <div className="space-y-2 text-left">
                                <Label>Dein Name</Label>
                                <Input placeholder="..." value={userName} onChange={(e) => setUserName(e.target.value)} />
                            </div>
                        )}
                        <Button className="w-full" size="lg" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>Quiz starten</Button>
                    </div>
                ) : currentSlide.type === 'multiple-choice' ? (
                    <div className="w-full max-w-2xl space-y-8">
                        <h2 className="text-2xl font-bold">{currentSlide.content.question}</h2>
                        <div className="grid gap-3">
                            {(currentSlide.content.options || []).map((opt: any) => { 
                                const isSelected = selectedMcOption === opt.id; 
                                const isCorrect = opt.isCorrect; 
                                let btnClass = "justify-start h-auto py-4 px-6 text-left border-2"; 
                                if (answerStatus !== 'none') { 
                                    if (isCorrect) btnClass += " bg-green-600 border-green-700 text-white"; 
                                    else if (isSelected && !isCorrect) btnClass += " bg-red-600 border-red-700 text-white"; 
                                } 
                                return (<Button key={opt.id} variant="outline" disabled={answerStatus !== 'none'} onClick={() => handleMcSelect(opt.id)} className={btnClass}>{opt.text}</Button>); 
                            })}
                        </div>
                    </div>
                ) : currentSlide.type === 'short-answer' ? (
                    <div className="w-full max-w-xl space-y-8 text-center">
                        <h2 className="text-2xl font-bold">{currentSlide.content.question}</h2>
                        <div className="relative">
                            <Input placeholder="Antwort..." value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-xl py-8 px-6 text-center" />
                            {answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin" />}
                        </div>
                        {answerStatus === 'none' && <Button size="lg" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Prüfen</Button>}
                        {answerStatus === 'correct' && <p className="text-green-600 font-bold">Richtig!</p>}
                        {answerStatus === 'incorrect' && <p className="text-red-600 font-bold">Leider falsch.</p>}
                    </div>
                ) : currentSlide.type === 'long-answer' ? (
                    <div className="w-full max-w-2xl space-y-8">
                        <h2 className="text-2xl font-bold">{currentSlide.content.question}</h2>
                        <div className="relative">
                            <Textarea placeholder="Schreibe hier..." value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-lg p-6 min-h-[180px]" />
                            {answerStatus === 'checking' && <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center rounded-md z-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /><p className="font-bold mt-2">KI prüft...</p></div>}
                        </div>
                        {answerStatus === 'none' && <Button size="lg" className="w-full" onClick={checkLongAnswerAction} disabled={!userAnswer.trim()}>Prüfen lassen</Button>}
                        {aiFeedback && <div className="p-4 rounded-lg bg-secondary/50 mt-4 animate-in slide-in-from-top-2 duration-300"><p className="text-sm font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> KI-Feedback ({aiScore}/10):</p><p className="text-sm mt-1">{aiFeedback}</p></div>}
                    </div>
                ) : currentSlide.type === 'text' ? (
                    <div className="w-full max-w-2xl space-y-6">
                        <h2 className="text-3xl font-bold border-b pb-4">{currentSlide.content.title}</h2>
                        <div className="text-lg leading-relaxed whitespace-pre-wrap text-muted-foreground">{currentSlide.content.text}</div>
                    </div>
                ) : currentSlide.type === 'conclusion' ? (
                    <div className="text-center space-y-10 w-full max-w-md">
                        {!isFinished ? (
                            <>
                                <h1 className="text-5xl font-black">Fertig!</h1>
                                <p className="text-muted-foreground">Klicke auf den Button, um deine Ergebnisse abzuspeichern.</p>
                                {currentSlide.content.collectFeedback && (
                                    <div className="space-y-6">
                                        <p className="font-bold">Wie fandest du das Quiz?</p>
                                        <div className="flex justify-center gap-6">
                                            <button onClick={() => setFeedbackValue('sad')} className={cn("p-2 rounded-full transition-colors", feedbackValue === 'sad' ? "bg-red-100 text-red-600" : "text-muted-foreground hover:text-red-400")}><Frown className="w-12 h-12" /></button>
                                            <button onClick={() => setFeedbackValue('neutral')} className={cn("p-2 rounded-full transition-colors", feedbackValue === 'neutral' ? "bg-amber-100 text-amber-600" : "text-muted-foreground hover:text-amber-400")}><Meh className="w-12 h-12" /></button>
                                            <button onClick={() => setFeedbackValue('happy')} className={cn("p-2 rounded-full transition-colors", feedbackValue === 'happy' ? "bg-green-100 text-green-600" : "text-muted-foreground hover:text-green-400")}><Smile className="w-12 h-12" /></button>
                                        </div>
                                    </div>
                                )}
                                <Button className="w-full h-14 text-lg font-bold" onClick={submitResponse} disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : 'Ergebnisse senden'}
                                </Button>
                            </>
                        ) : (
                            <div className="space-y-8 animate-in zoom-in duration-500">
                                <CheckCircle2 className="w-20 h-12 text-green-500 mx-auto" />
                                <h1 className="text-4xl font-black">Gesendet!</h1>
                                {currentSlide.content.showScore && (
                                    <div className="p-8 bg-primary/5 rounded-2xl border-2 border-primary/10">
                                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mb-2">Dein Ergebnis</p>
                                        <p className="text-7xl font-black text-primary">{totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%</p>
                                        <p className="text-sm text-muted-foreground mt-2">{correctCount} von {totalQuestions} Fragen richtig</p>
                                    </div>
                                )}
                                <p className="text-muted-foreground">Vielen Dank für deine Teilnahme. Du kannst dieses Fenster nun schließen.</p>
                            </div>
                        )}
                    </div>
                ) : null}
            </main>

            <footer className="p-4 border-t bg-secondary/5">
                <div className="max-w-3xl mx-auto flex justify-between items-center">
                    <Button variant="ghost" onClick={handleBack} disabled={currentIndex === 0 || isFinished}><ChevronLeft className="mr-2 h-4 w-4" /> Zurück</Button>
                    <div className="flex-1 px-8"><div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentIndex + 1) / slides.length) * 100}%` }} /></div></div>
                    <Button onClick={handleNext} disabled={currentIndex === slides.length - 1 || (currentSlide?.type !== 'welcome' && currentSlide?.type !== 'text' && currentSlide?.type !== 'conclusion' && answerStatus === 'none') || isFinished}>Weiter <ChevronRight className="ml-2 h-4 w-4" /></Button>
                </div>
            </footer>
        </div>
    );
}
