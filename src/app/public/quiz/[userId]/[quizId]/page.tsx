
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check, X, Sparkles, User, Shield, ChevronRight, AlertCircle, Frown, Meh, Smile, FileText, BarChart3 } from 'lucide-react';
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
  ownerId: string;
};

export default function PublicQuizPage() {
    const params = useParams();
    const router = useRouter();
    const { userId, quizId } = params;
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
    
    const [allAnswers, setAllAnswers] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [hasCompleted, setHasCompleted] = useState(false);

    const quizDocRef = useMemoFirebase(() => 
        (userId && quizId) ? doc(firestore, `users/${userId}/quizzes`, quizId as string) : null
    , [firestore, userId, quizId]);

    const { data: quiz, isLoading: isLoadingQuiz } = useDoc<Quiz>(quizDocRef);

    const slides = quiz?.slides || [];
    const currentSlide = slides[currentIndex];
    const totalQuestions = useMemo(() => slides.filter(s => !['welcome', 'text', 'conclusion'].includes(s.type)).length, [slides]);
    const correctCount = useMemo(() => allAnswers.filter(a => a.isCorrect).length, [allAnswers]);
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const normalizeText = (text: string) => text.trim().toLowerCase().replace(/ss/g, 'ß').replace(/\s+/g, ' ');

    const handleSaveResponse = async (rating: 'sad' | 'neutral' | 'happy' | null) => {
        if (!firestore || !userId || !quizId || isSaving) return;
        setIsSaving(true);

        try {
            const responsesRef = collection(firestore, `users/${userId}/quizzes/${quizId}/responses`);
            await addDoc(responsesRef, {
                participantName: userName || 'Anonym',
                answers: allAnswers,
                overallScore: percentage,
                rating: rating,
                completedAt: serverTimestamp()
            });
            setHasCompleted(true);
        } catch (e) {
            console.error("Fehler beim Speichern:", e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleNext = () => {
        // Record answer before moving
        if (currentSlide && !['welcome', 'text', 'conclusion'].includes(currentSlide.type)) {
            const currentAnswerRecord = {
                slideId: currentSlide.id,
                type: currentSlide.type,
                answer: currentSlide.type === 'multiple-choice' ? selectedMcOption : (currentSlide.type === 'vocabulary' ? vocabAnswers : userAnswer),
                isCorrect: answerStatus === 'correct',
                score: aiScore,
                feedback: aiFeedback
            };
            setAllAnswers(prev => [...prev, currentAnswerRecord]);
        }

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

    const handleFinish = (rating: 'sad' | 'neutral' | 'happy') => {
        setFeedbackValue(rating);
        handleSaveResponse(rating);
    };

    const checkShortAnswer = async () => {
        if (!userAnswer.trim()) return;
        setAnswerStatus('checking');
        const { answer, answerType, checkMode, question } = currentSlide.content;
        let isCorrect = false;

        if (answerType === 'year') {
            isCorrect = userAnswer.trim() === answer.trim();
        } else {
            const normalizedUser = normalizeText(userAnswer);
            const normalizedCorrect = normalizeText(answer);
            if (checkMode === 'strict') isCorrect = userAnswer.trim() === answer.trim();
            else if (checkMode === 'helpfull') isCorrect = normalizedUser === normalizedCorrect;
            else if (checkMode === 'ai') {
                if (normalizedUser === normalizedCorrect) isCorrect = true;
                else {
                    const result = await verifyQuizAnswer(question, answer, userAnswer, aiLanguage);
                    isCorrect = result.isCorrect;
                }
            }
        }
        setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    };

    const checkLongAnswerAction = async () => {
        if (!userAnswer.trim()) return;
        setAnswerStatus('checking');
        const { question, referenceAnswer, criteria } = currentSlide.content;
        const result = await checkLongAnswer(question, referenceAnswer, criteria, userAnswer, aiLanguage);
        setAiScore(result.score);
        setAiFeedback(result.feedback);
        setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
    };

    const checkVocabulary = () => {
        const { pairs, checkMode } = currentSlide.content;
        const results: Record<string, boolean> = {};
        let allCorrect = true;
        pairs.forEach((pair: any) => {
            const userVal = vocabAnswers[pair.id] || '';
            const correctVal = pair.german;
            const isCorrect = checkMode === 'strict' ? userVal.trim() === correctVal.trim() : normalizeText(userVal) === normalizeText(correctVal);
            results[pair.id] = isCorrect;
            if (!isCorrect) allCorrect = false;
        });
        setVocabResults(results);
        setAnswerStatus(allCorrect ? 'correct' : 'incorrect');
    };

    const handleMcSelect = (optionId: string) => {
        if (answerStatus !== 'none') return;
        setSelectedMcOption(optionId);
        const option = currentSlide.content.options.find((o: any) => o.id === optionId);
        setAnswerStatus(option.isCorrect ? 'correct' : 'incorrect');
    };

    if (isLoadingQuiz) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary" /></div>;
    if (!quiz) return <div className="flex items-center justify-center h-screen">Quiz nicht gefunden.</div>;

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 pb-32">
                {currentSlide?.type === 'welcome' && (
                    <div className="text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in">
                        <div className="space-y-2">
                            <h1 className="text-4xl font-extrabold tracking-tight">{quiz.title}</h1>
                            <p className="text-muted-foreground">von {quiz.creator}</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-3">
                            <Badge variant="outline" className="bg-background border-primary/20 text-primary py-1.5 px-3">
                                {currentSlide.content.askName ? <User className="w-3.5 h-3.5 mr-2" /> : <Shield className="w-3.5 h-3.5 mr-2" />}
                                {currentSlide.content.askName ? 'Name erforderlich' : 'Anonym'}
                            </Badge>
                            {slides.some(s => s.type === 'long-answer') && (
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 py-1.5 px-3">
                                    <Sparkles className="w-3.5 h-3.5 mr-2" /> KI-gestützt
                                </Badge>
                            )}
                        </div>
                        {currentSlide.content.askName && (
                            <div className="space-y-2 text-left">
                                <Label>Wie heißt du?</Label>
                                <Input placeholder="Dein Name..." value={userName} onChange={e => setUserName(e.target.value)} className="text-lg py-6" />
                            </div>
                        )}
                        <Button className="w-full text-lg py-6 h-auto font-bold shadow-lg" size="lg" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>
                            Quiz starten
                        </Button>
                    </div>
                )}

                {currentSlide?.type === 'multiple-choice' && (
                    <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right">
                        <h2 className="text-2xl md:text-3xl font-bold leading-tight">{currentSlide.content.question}</h2>
                        <div className="grid gap-3">
                            {currentSlide.content.options.map((opt: any, i: number) => (
                                <Button 
                                    key={opt.id} 
                                    variant={answerStatus === 'none' ? 'outline' : (opt.isCorrect ? 'default' : (selectedMcOption === opt.id ? 'destructive' : 'outline'))}
                                    disabled={answerStatus !== 'none'}
                                    onClick={() => handleMcSelect(opt.id)}
                                    className={cn("justify-start h-auto py-4 px-6 text-left border-2", answerStatus === 'none' && "hover:border-primary")}
                                >
                                    <span className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mr-4 shrink-0 font-bold text-xs">{String.fromCharCode(65 + i)}</span>
                                    <span className="flex-1">{opt.text}</span>
                                    {answerStatus !== 'none' && opt.isCorrect && <Check className="ml-2 h-5 w-5" />}
                                    {answerStatus !== 'none' && selectedMcOption === opt.id && !opt.isCorrect && <X className="ml-2 h-5 w-5" />}
                                </Button>
                            ))}
                        </div>
                        {answerStatus !== 'none' && (
                            <Button className="w-full mt-4" size="lg" onClick={handleNext}>Weiter</Button>
                        )}
                    </div>
                )}

                {currentSlide?.type === 'short-answer' && (
                    <div className="w-full max-w-xl space-y-8 animate-in slide-in-from-right">
                        <h2 className="text-2xl md:text-3xl font-bold leading-tight">{currentSlide.content.question}</h2>
                        <div className="space-y-4">
                            <Input placeholder="Deine Antwort..." value={userAnswer} onChange={e => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none'} className={cn("text-xl py-8", answerStatus === 'correct' && "border-green-500 bg-green-50", answerStatus === 'incorrect' && "border-red-500 bg-red-50")} />
                            {answerStatus === 'none' ? (
                                <Button className="w-full" size="lg" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Prüfen</Button>
                            ) : (
                                <div className="space-y-4">
                                    <div className={cn("p-4 rounded-lg", answerStatus === 'correct' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                        <p className="font-bold">{answerStatus === 'correct' ? 'Richtig!' : 'Leider falsch.'}</p>
                                        {answerStatus === 'incorrect' && <p>Richtig wäre: {currentSlide.content.answer}</p>}
                                    </div>
                                    <Button className="w-full" size="lg" onClick={handleNext}>Weiter</Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {currentSlide?.type === 'long-answer' && (
                    <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right">
                        <h2 className="text-2xl md:text-3xl font-bold leading-tight">{currentSlide.content.question}</h2>
                        <div className="space-y-4">
                            <Textarea placeholder="Schreibe deine Antwort..." value={userAnswer} onChange={e => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none'} className="text-lg p-6 min-h-[180px]" />
                            {answerStatus === 'none' ? (
                                <Button className="w-full" size="lg" onClick={checkLongAnswerAction} disabled={!userAnswer.trim() || answerStatus === 'checking'}>
                                    {answerStatus === 'checking' ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-4 w-4" />} KI-Prüfung starten
                                </Button>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-4 bg-primary/10 rounded-lg space-y-2">
                                        <p className="font-bold">Feedback der KI:</p>
                                        <p className="text-sm">{aiFeedback}</p>
                                        {currentSlide.content.enablePoints && <Badge>Score: {aiScore}/10</Badge>}
                                    </div>
                                    <Button className="w-full" size="lg" onClick={handleNext}>Weiter</Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {currentSlide?.type === 'vocabulary' && (
                    <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right">
                        <h2 className="text-2xl font-bold">Vokabel-Test</h2>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {currentSlide.content.pairs.map((pair: any) => (
                                <div key={pair.id} className="grid grid-cols-2 items-center gap-4 p-3 bg-secondary/30 rounded-lg">
                                    <span className="font-semibold">{pair.foreign}</span>
                                    <Input placeholder="..." value={vocabAnswers[pair.id] || ''} onChange={e => setVocabAnswers(prev => ({...prev, [pair.id]: e.target.value}))} disabled={answerStatus !== 'none'} />
                                </div>
                            ))}
                        </div>
                        {answerStatus === 'none' ? (
                            <Button className="w-full" size="lg" onClick={checkVocabulary}>Vokabeln prüfen</Button>
                        ) : (
                            <Button className="w-full" size="lg" onClick={handleNext}>Weiter</Button>
                        )}
                    </div>
                )}

                {currentSlide?.type === 'text' && (
                    <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right">
                        <h2 className="text-3xl font-bold">{currentSlide.content.title}</h2>
                        <Card className="bg-secondary/10 border-none"><CardContent className="p-6 text-lg leading-relaxed">{currentSlide.content.text}</CardContent></Card>
                        <Button className="w-full" size="lg" onClick={handleNext}>Verstanden</Button>
                    </div>
                )}

                {currentSlide?.type === 'conclusion' && (
                    <div className="text-center space-y-10 max-w-xl w-full animate-in fade-in zoom-in">
                        {!hasCompleted ? (
                            <>
                                <div className="space-y-4">
                                    <h1 className="text-4xl font-bold">Geschafft!</h1>
                                    <p className="text-xl text-muted-foreground">Wie hat dir das Quiz gefallen?</p>
                                </div>
                                <div className="flex justify-center gap-8">
                                    <button onClick={() => handleFinish('sad')} className="text-muted-foreground hover:text-red-500 transition-colors"><Frown className="h-16 w-16" /></button>
                                    <button onClick={() => handleFinish('neutral')} className="text-muted-foreground hover:text-amber-500 transition-colors"><Meh className="h-16 w-16" /></button>
                                    <button onClick={() => handleFinish('happy')} className="text-muted-foreground hover:text-green-500 transition-colors"><Smile className="h-16 w-16" /></button>
                                </div>
                                <Button variant="ghost" onClick={() => handleSaveResponse(null)} disabled={isSaving}>Überspringen & Speichern</Button>
                            </>
                        ) : (
                            <div className="space-y-6">
                                <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600"><Check className="h-10 w-10" /></div>
                                <h2 className="text-3xl font-bold">Ergebnisse gespeichert!</h2>
                                {currentSlide.content.showScore && (
                                    <div className="p-6 bg-primary/10 rounded-2xl">
                                        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Dein Score</p>
                                        <p className="text-6xl font-black text-primary">{percentage}%</p>
                                    </div>
                                )}
                                <p className="text-muted-foreground">Du kannst dieses Fenster nun schließen.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>

            <footer className="fixed bottom-0 left-0 right-0 p-4 border-t bg-background/80 backdrop-blur-md flex items-center gap-4">
                <div className="flex flex-col gap-1 flex-1">
                    <span className="text-xs font-bold truncate max-w-[200px]">{quiz.title}</span>
                    <Progress value={((currentIndex + 1) / slides.length) * 100} className="h-1.5" />
                </div>
                <div className="text-[10px] text-muted-foreground text-right">
                    <span>von {quiz.creator}</span><br/>
                    <span>{currentIndex + 1} / {slides.length}</span>
                </div>
            </footer>
        </div>
    );
}
