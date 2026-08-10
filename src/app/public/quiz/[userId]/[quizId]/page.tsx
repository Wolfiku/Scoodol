
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, ChevronRight, ChevronLeft, Sparkles, Frown, Meh, Smile, CheckCircle2, XCircle } from 'lucide-react';
import { verifyQuizAnswer, checkLongAnswer } from '@/app/actions';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export default function PublicQuizPage() {
    const params = useParams();
    const { userId, quizId } = params;
    const firestore = useFirestore();
    const { toast } = useToast();
    const { aiLanguage } = useTheme();
    const router = useRouter();

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
    const [allAnswers, setAllAnswers] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const quizRef = useMemoFirebase(() => 
        userId && quizId ? doc(firestore, `users/${userId}/quizzes/${quizId}`) : null
    , [firestore, userId, quizId]);

    const { data: quiz, isLoading } = useDoc<any>(quizRef);

    const currentSlide = quiz?.slides?.[currentIndex];
    const totalQuestions = useMemo(() => 
        quiz?.slides?.filter((s: any) => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length || 0
    , [quiz]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground font-medium">Lade Quiz...</p>
                </div>
            </div>
        );
    }

    if (!quiz || (!quiz.isPublished && quiz.ownerId !== userId)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background p-4">
                <Card className="max-w-md w-full text-center p-8">
                    <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                    <CardTitle className="text-2xl font-bold">Quiz nicht verfügbar</CardTitle>
                    <CardDescription className="mt-2">Dieses Quiz existiert nicht oder ist nicht mehr öffentlich zugänglich.</CardDescription>
                    <Button onClick={() => router.push('/')} className="mt-6 w-full">Zur Startseite</Button>
                </Card>
            </div>
        );
    }

    const handleNext = async () => {
        if (currentIndex < quiz.slides.length - 1) {
            setCurrentIndex(prev => prev + 1);
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
            setCurrentIndex(prev => prev - 1);
            setAnswerStatus('none');
            setUserAnswer('');
            setSelectedMcOption(null);
        }
    };

    const submitResponse = async () => {
        if (isSubmitting) return;
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
        } catch (e) {
            console.error("Error submitting response:", e);
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleMcSelect = (optionId: string) => {
        if (answerStatus !== 'none') return;
        setSelectedMcOption(optionId);
        const option = currentSlide.content.options.find((o: any) => o.id === optionId);
        const isCorrect = !!option?.isCorrect;
        if (isCorrect) setCorrectCount(prev => prev + 1);
        setAllAnswers(prev => ({ ...prev, [currentSlide.id]: optionId }));
        setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    };

    const checkShortAnswer = async () => {
        if (!userAnswer.trim() || answerStatus === 'checking') return;
        setAnswerStatus('checking');
        const { answer, checkMode, question } = currentSlide.content;
        
        let isCorrect = userAnswer.trim().toLowerCase() === (answer || "").trim().toLowerCase();

        if (!isCorrect && checkMode === 'ai') {
            const result = await verifyQuizAnswer(question, answer, userAnswer, aiLanguage);
            isCorrect = result.isCorrect;
        }

        if (isCorrect) setCorrectCount(prev => prev + 1);
        setAllAnswers(prev => ({ ...prev, [currentSlide.id]: userAnswer }));
        setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    }

    const checkLongAnswerAction = async () => {
        if (!userAnswer.trim() || answerStatus === 'checking') return;
        setAnswerStatus('checking');
        const { question, referenceAnswer, criteria } = currentSlide.content;
        const result = await checkLongAnswer(question, referenceAnswer, criteria, userAnswer, aiLanguage);
        setAiScore(result.score);
        setAiFeedback(result.feedback);
        if (result.isCorrect) setCorrectCount(prev => prev + 1);
        setAllAnswers(prev => ({ ...prev, [currentSlide.id]: { text: userAnswer, score: result.score } }));
        setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
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
        setAllAnswers(prev => ({ ...prev, [currentSlide.id]: vocabAnswers }));
        setAnswerStatus(allCorrect ? 'correct' : 'incorrect');
    }

    const isConclusion = currentSlide?.type === 'conclusion';

    return (
        <div className="min-h-screen bg-secondary/10 flex flex-col">
            <header className="bg-background border-b p-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex flex-col">
                    <h1 className="text-lg font-bold">{quiz.title}</h1>
                    <p className="text-xs text-muted-foreground">von {quiz.creator}</p>
                </div>
                <div className="text-xs font-mono bg-secondary px-2 py-1 rounded">
                    {currentIndex + 1} / {quiz.slides.length}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center">
                <div className="max-w-3xl w-full">
                    {currentSlide?.type === 'welcome' && (
                        <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
                            <h2 className="text-4xl md:text-6xl font-black tracking-tight">{quiz.title}</h2>
                            <p className="text-xl text-muted-foreground">{currentSlide.content.subtitle || 'Viel Erfolg beim Quiz!'}</p>
                            {currentSlide.content.askName && (
                                <div className="max-w-sm mx-auto space-y-2 text-left">
                                    <Label className="font-bold">Dein Name</Label>
                                    <Input placeholder="Wie heißt du?" value={userName} onChange={e => setUserName(e.target.value)} className="h-12 text-lg" />
                                </div>
                            )}
                            <Button size="lg" className="h-14 px-12 text-xl font-bold rounded-full" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>Quiz starten</Button>
                        </div>
                    )}

                    {currentSlide?.type === 'multiple-choice' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <h2 className="text-2xl md:text-3xl font-bold text-center">{currentSlide.content.question}</h2>
                            <div className="grid gap-4">
                                {currentSlide.content.options.map((opt: any) => {
                                    const isSelected = selectedMcOption === opt.id;
                                    const isCorrect = opt.isCorrect;
                                    let variant: "outline" | "default" = "outline";
                                    let className = "h-auto py-5 px-6 text-lg justify-start text-left border-2 transition-all";
                                    
                                    if (answerStatus !== 'none') {
                                        if (isCorrect) className += " bg-green-600 border-green-700 text-white hover:bg-green-600";
                                        else if (isSelected) className += " bg-red-600 border-red-700 text-white hover:bg-red-600";
                                    }

                                    return (
                                        <Button key={opt.id} variant={variant} className={className} disabled={answerStatus !== 'none'} onClick={() => handleMcSelect(opt.id)}>
                                            {answerStatus !== 'none' && isCorrect && <CheckCircle2 className="w-5 h-5 mr-3 shrink-0" />}
                                            {answerStatus !== 'none' && isSelected && !isCorrect && <XCircle className="w-5 h-5 mr-3 shrink-0" />}
                                            {opt.text}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {currentSlide?.type === 'short-answer' && (
                        <div className="space-y-8 text-center animate-in slide-in-from-right-4 duration-300">
                            <h2 className="text-2xl md:text-3xl font-bold">{currentSlide.content.question}</h2>
                            <div className="relative max-w-xl mx-auto">
                                <Input placeholder="Antwort..." value={userAnswer} onChange={e => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-2xl py-8 px-6 text-center border-2 h-20" autoFocus />
                                {answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
                            </div>
                            {answerStatus === 'none' && <Button size="lg" className="h-14 px-10 text-lg font-bold" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Prüfen</Button>}
                            {answerStatus === 'correct' && <div className="text-green-600 flex flex-col items-center gap-2 animate-bounce"><CheckCircle2 className="w-12 h-12" /><span className="text-2xl font-black">Richtig!</span></div>}
                            {answerStatus === 'incorrect' && <div className="text-destructive flex flex-col items-center gap-2"><XCircle className="w-12 h-12" /><span className="text-2xl font-black">Nicht ganz...</span><p className="text-muted-foreground">Lösung: <span className="font-bold text-foreground">{currentSlide.content.answer}</span></p></div>}
                        </div>
                    )}

                    {currentSlide?.type === 'long-answer' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <h2 className="text-2xl font-bold">{currentSlide.content.question}</h2>
                            <div className="relative">
                                <Textarea placeholder="Deine Antwort ausführlich beschreiben..." value={userAnswer} onChange={e => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-lg p-6 min-h-[200px] border-2" />
                                {answerStatus === 'checking' && (
                                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-md z-10 space-y-4">
                                        <Loader2 className="animate-spin h-10 w-10 text-primary" />
                                        <p className="font-bold text-primary animate-pulse">KI bewertet deine Antwort...</p>
                                    </div>
                                )}
                            </div>
                            {answerStatus === 'none' && <Button size="lg" className="w-full h-14 text-xl font-bold" onClick={checkLongAnswerAction} disabled={!userAnswer.trim()}><Sparkles className="mr-2" /> KI-Prüfung starten</Button>}
                            {aiFeedback && (
                                <Card className="border-primary/20 bg-primary/5 animate-in slide-in-from-top-2">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-primary"><Sparkles className="w-4 h-4" /> KI-Feedback ({aiScore}/10)</CardTitle></CardHeader>
                                    <CardContent><p className="text-lg leading-relaxed">{aiFeedback}</p></CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {currentSlide?.type === 'vocabulary' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300 max-w-2xl mx-auto">
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-black">Vokabel-Check</h2>
                                <p className="text-muted-foreground">Übersetze die folgenden Begriffe.</p>
                            </div>
                            <div className="grid gap-4 bg-card p-6 rounded-2xl border-2 shadow-sm">
                                {Array.isArray(currentSlide.content.pairs) && currentSlide.content.pairs.map((pair: any) => (
                                    <div key={pair.id || Math.random()} className="grid grid-cols-[1fr_1fr] gap-4 items-center border-b last:border-0 pb-4 last:pb-0">
                                        <div className="text-right font-bold text-lg">{pair.foreign}</div>
                                        <Input 
                                            placeholder="Übersetzung..." 
                                            value={vocabAnswers[pair.id] || ''} 
                                            onChange={e => setVocabAnswers(prev => ({...prev, [pair.id]: e.target.value}))} 
                                            className={cn("text-center h-12 text-lg border-2", vocabResults[pair.id] === true && "border-green-500 bg-green-50 focus-visible:ring-green-500", vocabResults[pair.id] === false && "border-destructive bg-destructive/5 focus-visible:ring-destructive")} 
                                            disabled={answerStatus !== 'none'} 
                                        />
                                    </div>
                                ))}
                            </div>
                            {answerStatus === 'none' && <Button className="w-full h-14 text-xl font-bold rounded-xl" onClick={checkVocab}>Prüfen</Button>}
                            {answerStatus !== 'none' && answerStatus !== 'checking' && (
                                <div className={cn("text-center font-black text-2xl py-4 animate-in zoom-in", answerStatus === 'correct' ? "text-green-600" : "text-destructive")}>
                                    {answerStatus === 'correct' ? 'Alle richtig!' : 'Nicht alle korrekt.'}
                                </div>
                            )}
                        </div>
                    )}

                    {currentSlide?.type === 'text' && (
                        <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-500">
                            <h2 className="text-4xl font-black border-b-4 border-primary pb-4 w-fit">{currentSlide.content.title}</h2>
                            <div className="text-xl leading-relaxed whitespace-pre-wrap text-muted-foreground bg-card p-8 rounded-3xl border shadow-sm">{currentSlide.content.text}</div>
                        </div>
                    )}

                    {currentSlide?.type === 'conclusion' && (
                        <div className="text-center space-y-12 max-w-md mx-auto animate-in zoom-in duration-500">
                            <div className="space-y-4">
                                <h1 className="text-6xl font-black tracking-tighter">Fertig!</h1>
                                <p className="text-xl text-muted-foreground font-medium">Du hast alle Fragen beantwortet. Gut gemacht!</p>
                            </div>
                            
                            {currentSlide.content.showScore && (
                                <div className="p-10 bg-primary/10 rounded-[3rem] border-4 border-primary/20 space-y-2 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><Smile className="w-24 h-24" /></div>
                                    <p className="text-primary font-black uppercase tracking-widest text-sm">Dein Ergebnis</p>
                                    <p className="text-8xl font-black text-primary tracking-tighter">
                                        {totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%
                                    </p>
                                    <p className="text-muted-foreground font-bold">{correctCount} von {totalQuestions} richtig</p>
                                </div>
                            )}

                            {currentSlide.content.collectFeedback && !feedbackValue && (
                                <div className="space-y-6">
                                    <p className="font-black text-2xl">Wie war das Quiz?</p>
                                    <div className="flex justify-center gap-6">
                                        <button onClick={() => setFeedbackValue('sad')} className="p-4 rounded-3xl bg-card border-2 hover:bg-destructive/10 hover:border-destructive transition-all text-muted-foreground hover:text-destructive"><Frown className="w-12 h-12" /></button>
                                        <button onClick={() => setFeedbackValue('neutral')} className="p-4 rounded-3xl bg-card border-2 hover:bg-amber-100 hover:border-amber-500 transition-all text-muted-foreground hover:text-amber-600"><Meh className="w-12 h-12" /></button>
                                        <button onClick={() => setFeedbackValue('happy')} className="p-4 rounded-3xl bg-card border-2 hover:bg-green-100 hover:border-green-500 transition-all text-muted-foreground hover:text-green-600"><Smile className="w-12 h-12" /></button>
                                    </div>
                                </div>
                            )}

                            {feedbackValue && (
                                <div className="flex items-center justify-center gap-3 text-green-600 font-bold bg-green-50 py-4 rounded-full border border-green-200 animate-in fade-in">
                                    <CheckCircle2 className="w-6 h-6" /> Danke für dein Feedback!
                                </div>
                            )}

                            <Button size="lg" className="w-full h-16 text-2xl font-black rounded-3xl shadow-xl" disabled={isSubmitting} onClick={async () => { await submitResponse(); router.push('/'); }}>
                                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Beenden & Speichern'}
                            </Button>
                        </div>
                    )}
                </div>
            </main>

            <footer className="p-4 bg-background border-t">
                <div className="max-w-3xl mx-auto flex justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={handleBack} disabled={currentIndex === 0 || isConclusion}>
                        <ChevronLeft className="mr-2 h-4 w-4" /> Zurück
                    </Button>
                    <div className="flex-1 px-8">
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentIndex + 1) / quiz.slides.length) * 100}%` }} />
                        </div>
                    </div>
                    <Button size="sm" onClick={handleNext} disabled={currentIndex === quiz.slides.length - 1 || (currentSlide?.type !== 'welcome' && currentSlide?.type !== 'text' && currentSlide?.type !== 'conclusion' && answerStatus === 'none')}>
                        Weiter <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </footer>
        </div>
    );
}
