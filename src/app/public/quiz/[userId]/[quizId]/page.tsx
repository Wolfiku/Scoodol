
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ChevronRight, ChevronLeft, CheckCircle2, Star, Sparkles, Smile, Meh, Frown, Shield, User, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const { aiLanguage } = useTheme();

    const userId = params?.userId as string;
    const quizId = params?.quizId as string;

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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    const quizDocRef = useMemoFirebase(() => 
        userId && quizId ? doc(firestore, `users/${userId}/quizzes`, quizId) : null
    , [firestore, userId, quizId]);

    const { data: quiz, isLoading: isLoadingQuiz } = useDoc<Quiz>(quizDocRef);

    const slides = useMemo(() => quiz?.slides || [], [quiz]);
    const currentSlide = slides[currentIndex];
    const totalQuestions = useMemo(() => slides.filter(s => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length, [slides]);

    if (isLoadingQuiz) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
    }

    if (!quiz || !quiz.isPublished) {
        return (
            <div className="container mx-auto p-4 max-w-lg flex flex-col justify-center min-h-screen text-center">
                <Card>
                    <CardHeader><CardTitle>Quiz nicht verfügbar</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Dieses Quiz existiert nicht oder wurde vom Ersteller offline genommen.</p>
                        <Button variant="outline" className="mt-4" onClick={() => router.push('/')}>Zurück zur Startseite</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const handleNext = async () => {
        if (currentIndex < slides.length - 1) {
            // If we are on the conclusion slide and it's the last one, we might want to submit
            if (currentSlide.type === 'conclusion' && !isFinished) {
                await submitResponse();
            }
            setCurrentIndex(currentIndex + 1);
            setAnswerStatus('none');
            setUserAnswer('');
            setSelectedMcOption(null);
            setAiFeedback(null);
            setAiScore(null);
            setVocabAnswers({});
            setVocabResults({});
        } else {
            // Already on last slide (conclusion)
            if (!isFinished) await submitResponse();
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

    const submitResponse = async () => {
        if (isSubmitting || isFinished) return;
        setIsSubmitting(true);
        try {
            const responsesRef = collection(firestore, `users/${userId}/quizzes/${quizId}/responses`);
            await addDoc(responsesRef, {
                userName: userName || 'Anonym',
                percentage: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
                rating: feedbackValue,
                completedAt: serverTimestamp(),
            });
            setIsFinished(true);
        } catch (e) {
            console.error("Error submitting response:", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const checkShortAnswer = async () => {
        if (!userAnswer.trim()) return;
        setAnswerStatus('checking');
        const { answer, checkMode, question } = currentSlide.content;
        
        if (userAnswer.trim().toLowerCase() === (answer || "").trim().toLowerCase()) {
            setCorrectCount(prev => prev + 1);
            setAnswerStatus('correct');
            return;
        }

        if (checkMode === 'ai') {
            const result = await verifyQuizAnswer(question, answer, userAnswer, aiLanguage);
            if (result.isCorrect) setCorrectCount(prev => prev + 1);
            setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
        } else {
            setAnswerStatus('incorrect');
        }
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
        if (option?.isCorrect) setCorrectCount(prev => prev + 1);
        setAnswerStatus(option?.isCorrect ? 'correct' : 'incorrect');
    }

    const checkVocab = () => {
        const pairs = currentSlide.content.pairs || [];
        const results: Record<string, boolean> = {};
        let allCorrect = true;
        pairs.forEach((p: any) => {
            const isCorrect = (vocabAnswers[p.id] || '').trim().toLowerCase() === (p.german || "").trim().toLowerCase();
            results[p.id] = isCorrect;
            if (!isCorrect) allCorrect = false;
        });
        setVocabResults(results);
        if (allCorrect) setCorrectCount(prev => prev + 1);
        setAnswerStatus(allCorrect ? 'correct' : 'incorrect');
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background">
            <header className="p-4 border-b bg-secondary/10 flex justify-between items-center shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-sm font-bold truncate max-w-[200px] md:max-w-md">{quiz.title}</h1>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">von {quiz.creator}</span>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">{currentIndex + 1} / {slides.length}</Badge>
            </header>

            <main className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center">
                {currentSlide?.type === 'welcome' && (
                    <div className="text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-500">
                        <div className="p-4 bg-primary/10 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                            <Star className="w-10 h-10 text-primary fill-primary" />
                        </div>
                        <h2 className="text-4xl font-extrabold tracking-tight">{quiz.title}</h2>
                        {currentSlide.content.subtitle && <p className="text-muted-foreground text-lg">{currentSlide.content.subtitle}</p>}
                        {currentSlide.content.askName && (
                            <div className="space-y-2 text-left bg-secondary/30 p-6 rounded-2xl">
                                <Label className="text-xs uppercase font-black tracking-widest text-muted-foreground">Dein Name für die Rangliste</Label>
                                <Input placeholder="Wie heißt du?" value={userName} onChange={(e) => setUserName(e.target.value)} className="text-lg py-6" />
                            </div>
                        )}
                        <Button className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>Quiz starten</Button>
                    </div>
                )}

                {currentSlide?.type === 'multiple-choice' && (
                    <div className="w-full max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-3xl font-black leading-tight text-center">{currentSlide.content.question}</h2>
                        <div className="grid gap-4">
                            {(currentSlide.content.options || []).map((opt: any) => { 
                                const isSelected = selectedMcOption === opt.id; 
                                const isCorrect = opt.isCorrect; 
                                let btnClass = "justify-start h-auto py-6 px-8 text-lg font-bold border-2 rounded-2xl transition-all"; 
                                if (answerStatus !== 'none') { 
                                    if (isCorrect) btnClass += " bg-green-600 border-green-700 text-white shadow-green-200 shadow-lg scale-105 z-10"; 
                                    else if (isSelected && !isCorrect) btnClass += " bg-red-600 border-red-700 text-white opacity-90"; 
                                    else btnClass += " opacity-40 grayscale";
                                } else {
                                    btnClass += " hover:border-primary/50 hover:bg-primary/5 active:scale-95";
                                }
                                return (<Button key={opt.id} variant="outline" disabled={answerStatus !== 'none'} onClick={() => handleMcSelect(opt.id)} className={btnClass}>{opt.text}</Button>); 
                            })}
                        </div>
                    </div>
                )}

                {currentSlide?.type === 'short-answer' && (
                    <div className="w-full max-w-xl space-y-8 text-center animate-in fade-in slide-in-from-bottom-4">
                        <h2 className="text-3xl font-black">{currentSlide.content.question}</h2>
                        <div className="relative">
                            <Input placeholder="Antwort eingeben..." value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-2xl py-10 px-8 text-center rounded-3xl border-4 focus-visible:ring-primary shadow-inner" onKeyDown={(e) => e.key === 'Enter' && answerStatus === 'none' && checkShortAnswer()} />
                            {answerStatus === 'checking' && <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 animate-spin w-6 h-6 text-primary" />}
                        </div>
                        {answerStatus === 'none' && <Button size="lg" className="w-full h-14 rounded-2xl text-lg font-bold" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Antwort prüfen</Button>}
                        {answerStatus === 'correct' && <div className="p-4 bg-green-100 text-green-700 rounded-2xl font-black text-xl animate-in zoom-in duration-300">RICHTIG! 🎉</div>}
                        {answerStatus === 'incorrect' && <div className="p-4 bg-red-100 text-red-700 rounded-2xl font-black text-xl animate-in zoom-in duration-300">LEIDER FALSCH. <br/><span className="text-sm font-bold opacity-70">Lösung: {currentSlide.content.answer}</span></div>}
                    </div>
                )}

                {currentSlide?.type === 'vocabulary' && (
                    <div className="w-full max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        <h2 className="text-3xl font-black text-center mb-8">Vokabel-Test</h2>
                        <div className="grid gap-4 bg-secondary/20 p-8 rounded-3xl border">
                            {(currentSlide.content.pairs || []).map((pair: any) => (
                                <div key={pair.id || Math.random()} className="grid grid-cols-[1fr_1fr] gap-6 items-center">
                                    <div className="text-right font-black text-lg">{pair.foreign}</div>
                                    <Input 
                                        placeholder="Übersetzung..." 
                                        value={vocabAnswers[pair.id] || ''} 
                                        onChange={(e) => setVocabAnswers(prev => ({...prev, [pair.id]: e.target.value}))} 
                                        className={cn("text-center h-12 font-bold rounded-xl border-2", vocabResults[pair.id] === true && "border-green-500 bg-green-50 text-green-700", vocabResults[pair.id] === false && "border-red-500 bg-red-50 text-red-700")} 
                                        disabled={answerStatus !== 'none'} 
                                    />
                                </div>
                            ))}
                        </div>
                        {answerStatus === 'none' && (<Button className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg" onClick={checkVocab}>Vokabeln prüfen</Button>)}
                        {answerStatus !== 'none' && (
                            <div className={cn("p-4 rounded-2xl font-black text-center text-xl animate-in zoom-in", answerStatus === 'correct' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                                {answerStatus === 'correct' ? "ALLE RICHTIG! ✨" : "EINIGE WAREN FALSCH."}
                            </div>
                        )}
                    </div>
                )}

                {currentSlide?.type === 'long-answer' && (
                    <div className="w-full max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        <h2 className="text-3xl font-black">{currentSlide.content.question}</h2>
                        <div className="relative">
                            <Textarea placeholder="Schreibe hier deine ausführliche Antwort..." value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-lg p-8 min-h-[250px] rounded-3xl border-4 focus-visible:ring-primary shadow-inner" />
                            {answerStatus === 'checking' && <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center rounded-3xl z-10 space-y-4"><Loader2 className="animate-spin h-12 w-12 text-primary" /><p className="font-black text-primary animate-pulse">KI ANALYSIERT DEINE ANTWORT...</p></div>}
                        </div>
                        {answerStatus === 'none' && <Button size="lg" className="w-full h-16 text-xl font-black rounded-2xl shadow-xl bg-primary hover:scale-[1.02] transition-transform" onClick={checkLongAnswerAction} disabled={!userAnswer.trim()}><Sparkles className="mr-3 h-6 w-6" /> KI-BEWERTUNG STARTEN</Button>}
                        {aiFeedback && (
                            <div className="p-6 rounded-3xl bg-secondary/50 border-2 mt-4 animate-in slide-in-from-top-4 duration-500">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-sm font-black flex items-center gap-2 uppercase tracking-tighter"><Sparkles className="w-4 h-4 text-primary" /> Dein KI-Feedback</p>
                                    <Badge className="h-8 px-4 text-lg font-black">{aiScore} / 10</Badge>
                                </div>
                                <p className="text-base leading-relaxed">{aiFeedback}</p>
                            </div>
                        )}
                    </div>
                )}

                {currentSlide?.type === 'text' && (
                    <div className="w-full max-w-2xl space-y-8 animate-in fade-in duration-500">
                        <div className="space-y-4 border-l-8 border-primary pl-8 py-2">
                             <h2 className="text-4xl font-black tracking-tight">{currentSlide.content.title}</h2>
                             <div className="text-xl leading-relaxed whitespace-pre-wrap text-muted-foreground">{currentSlide.content.text}</div>
                        </div>
                    </div>
                )}

                {currentSlide?.type === 'conclusion' && (
                    <div className="text-center space-y-10 w-full max-w-md animate-in fade-in zoom-in duration-700">
                        <div className="space-y-4">
                            <h1 className="text-6xl font-black tracking-tighter text-primary">GESCHAFFT!</h1>
                            <p className="text-xl text-muted-foreground font-medium">Vielen Dank für deine Teilnahme am Quiz "{quiz.title}".</p>
                        </div>
                        {currentSlide.content.showScore && (
                            <div className="p-10 bg-primary rounded-[3rem] shadow-2xl shadow-primary/20 text-white space-y-2 transform -rotate-2 hover:rotate-0 transition-transform">
                                <p className="text-[10px] uppercase tracking-widest font-black opacity-80">Dein Ergebnis</p>
                                <p className="text-8xl font-black">{totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%</p>
                                <p className="text-lg font-bold opacity-90">{correctCount} von {totalQuestions} richtig</p>
                            </div>
                        )}
                        {currentSlide.content.collectFeedback && !isFinished && (
                            <div className="space-y-6 pt-4">
                                <p className="font-black text-xl uppercase tracking-tighter">Wie fandest du das Quiz?</p>
                                <div className="flex justify-center gap-6">
                                    <button onClick={() => setFeedbackValue('sad')} className={cn("p-4 rounded-3xl transition-all hover:scale-110", feedbackValue === 'sad' ? "bg-red-500 text-white shadow-lg" : "bg-secondary text-muted-foreground")}><Frown className="w-12 h-12" /></button>
                                    <button onClick={() => setFeedbackValue('neutral')} className={cn("p-4 rounded-3xl transition-all hover:scale-110", feedbackValue === 'neutral' ? "bg-amber-500 text-white shadow-lg" : "bg-secondary text-muted-foreground")}><Meh className="w-12 h-12" /></button>
                                    <button onClick={() => setFeedbackValue('happy')} className={cn("p-4 rounded-3xl transition-all hover:scale-110", feedbackValue === 'happy' ? "bg-green-500 text-white shadow-lg" : "bg-secondary text-muted-foreground")}><Smile className="w-12 h-12" /></button>
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col gap-4 pt-6">
                            <Button className="w-full h-16 text-xl font-black rounded-3xl shadow-xl" onClick={() => router.push('/')} disabled={isSubmitting}>Quiz beenden</Button>
                        </div>
                    </div>
                )}
            </main>

            <footer className="p-4 bg-background border-t shrink-0">
                <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={handleBack} disabled={currentIndex === 0 || isFinished} className="font-bold"><ChevronLeft className="mr-2 h-4 w-4" /> Zurück</Button>
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden max-w-xs md:max-w-md">
                        <div className="h-full bg-primary transition-all duration-700 ease-in-out" style={{ width: `${((currentIndex + 1) / slides.length) * 100}%` }} />
                    </div>
                    <Button size="sm" onClick={handleNext} disabled={currentIndex === slides.length - 1 || (currentSlide?.type !== 'welcome' && currentSlide?.type !== 'text' && currentSlide?.type !== 'conclusion' && answerStatus === 'none') || isSubmitting} className="font-bold">
                        {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : currentIndex === slides.length - 1 ? 'Fertig' : 'Weiter'} <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </footer>
        </div>
    );
}
