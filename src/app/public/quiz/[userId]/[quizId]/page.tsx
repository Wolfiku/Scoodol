
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check, X, AlertCircle, ChevronRight, ChevronLeft, User, Sparkles, BrainCircuit, FileText, BarChart3, Frown, Meh, Smile, MessageSquareText } from 'lucide-react';
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
    const [correctCount, setCorrectCount] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);

    const quizRef = useMemoFirebase(() => 
        (userId && quizId) ? doc(firestore, `users/${userId}/quizzes/${quizId}`) : null
    , [firestore, userId, quizId]);

    const { data: quiz, isLoading } = useDoc<Quiz>(quizRef);

    useEffect(() => {
        if (quiz) {
            const count = quiz.slides.filter(s => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length;
            setTotalQuestions(count);
        }
    }, [quiz]);

    const currentSlide = quiz?.slides[currentIndex];

    const handleNext = () => {
        if (currentIndex > 0 && answerStatus === 'correct') {
            setCorrectCount(prev => prev + 1);
        }

        if (quiz && currentIndex < quiz.slides.length - 1) {
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
            setAnswerStatus('none');
            setUserAnswer('');
            setSelectedMcOption(null);
            setAiFeedback(null);
            setAiScore(null);
            setVocabAnswers({});
            setVocabResults({});
        }
    };

    const normalizeText = (text: string) => {
        return text.trim().toLowerCase().replace(/ss/g, 'ß').replace(/\s+/g, ' ');
    }

    const checkShortAnswer = async () => {
        if (!userAnswer.trim() || !currentSlide) return;
        setAnswerStatus('checking');

        const { answer, answerType, checkMode, question } = currentSlide.content;
        const normalizedCorrect = normalizeText(answer);
        const normalizedUser = normalizeText(userAnswer);

        let isCorrect = false;

        if (answerType === 'year') {
            isCorrect = userAnswer.trim() === answer.trim();
        } else {
            if (checkMode === 'strict') {
                isCorrect = userAnswer.trim() === answer.trim();
            } else if (checkMode === 'helpfull') {
                isCorrect = normalizedUser === normalizedCorrect;
            } else if (checkMode === 'ai') {
                if (normalizedUser === normalizedCorrect) {
                    isCorrect = true;
                } else {
                    const result = await verifyQuizAnswer(question, answer, userAnswer, aiLanguage);
                    isCorrect = result.isCorrect;
                }
            }
        }

        setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    }

    const checkLongAnswerAction = async () => {
        if (!userAnswer.trim() || !currentSlide) return;
        setAnswerStatus('checking');

        const { question, referenceAnswer, criteria } = currentSlide.content;
        const result = await checkLongAnswer(question, referenceAnswer, criteria, userAnswer, aiLanguage);
        
        setAiScore(result.score);
        setAiFeedback(result.feedback);
        setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
    }

    const checkVocabulary = () => {
        if (!currentSlide) return;
        const { pairs, checkMode } = currentSlide.content;
        const results: Record<string, boolean> = {};
        let allCorrect = true;

        pairs.forEach((pair: any) => {
            const userVal = vocabAnswers[pair.id] || '';
            const correctVal = pair.german;
            
            let isCorrect = false;
            if (checkMode === 'strict') {
                isCorrect = userVal.trim() === correctVal.trim();
            } else {
                isCorrect = normalizeText(userVal) === normalizeText(correctVal);
            }
            
            results[pair.id] = isCorrect;
            if (!isCorrect) allCorrect = false;
        });

        setVocabResults(results);
        setAnswerStatus(allCorrect ? 'correct' : 'incorrect');
    }

    const handleMcSelect = (optionId: string) => {
        if (answerStatus !== 'none' || !currentSlide) return;
        setSelectedMcOption(optionId);
        
        const option = currentSlide.content.options.find((o: any) => o.id === optionId);
        setAnswerStatus(option.isCorrect ? 'correct' : 'incorrect');
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Quiz wird geladen...</p>
            </div>
        );
    }

    if (!quiz || !quiz.isPublished) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <Card className="max-w-md w-full">
                    <CardHeader>
                        <CardTitle>Quiz nicht gefunden</CardTitle>
                        <CardDescription>Dieses Quiz existiert nicht oder wurde noch nicht veröffentlicht.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => router.push('/')} className="w-full">Zur Startseite</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    return (
        <div className="flex flex-col h-screen bg-background">
            <header className="p-4 border-b bg-secondary/20 flex justify-between items-center">
                <div className="flex flex-col">
                    <h1 className="text-sm font-bold truncate max-w-[200px]">{quiz.title}</h1>
                    <span className="text-[10px] text-muted-foreground">von {quiz.creator}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs font-mono">{currentIndex + 1} / {quiz.slides.length}</span>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center">
                {!currentSlide ? null : currentSlide.type === 'welcome' ? (
                    <div className="text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-300">
                        <div className="space-y-2">
                            <h1 className="text-4xl font-extrabold tracking-tight">{quiz.title}</h1>
                            <p className="text-muted-foreground">von {quiz.creator}</p>
                        </div>
                        
                        {currentSlide.content.subtitle && (
                            <Card className="bg-secondary/30 border-none">
                                <CardContent className="p-4 text-sm italic text-muted-foreground">
                                    "{currentSlide.content.subtitle}"
                                </CardContent>
                            </Card>
                        )}

                        {currentSlide.content.askName && (
                            <div className="space-y-2 text-left">
                                <Label>Wie heißt du?</Label>
                                <Input 
                                    placeholder="Dein Name..." 
                                    value={userName} 
                                    onChange={(e) => setUserName(e.target.value)}
                                    className="text-lg py-6"
                                />
                            </div>
                        )}

                        <Button 
                            className="w-full text-lg py-6 h-auto font-bold shadow-lg" 
                            size="lg" 
                            onClick={handleNext}
                            disabled={currentSlide.content.askName && !userName.trim()}
                        >
                            Quiz starten
                        </Button>
                    </div>
                ) : currentSlide.type === 'multiple-choice' ? (
                    <div className="w-full max-w-2xl space-y-8">
                        <Badge variant="secondary">Frage {currentIndex}</Badge>
                        <h2 className="text-2xl md:text-3xl font-bold leading-tight">{currentSlide.content.question}</h2>
                        <div className="grid gap-3">
                            {(currentSlide.content.options || []).map((opt: any, i: number) => {
                                const isSelected = selectedMcOption === opt.id;
                                const isCorrect = opt.isCorrect;
                                let variant: "outline" | "default" | "destructive" = "outline";
                                if (answerStatus !== 'none') {
                                    if (isCorrect) variant = "default";
                                    else if (isSelected) variant = "destructive";
                                }
                                return (
                                    <Button 
                                        key={opt.id} 
                                        variant={variant}
                                        disabled={answerStatus !== 'none'}
                                        onClick={() => handleMcSelect(opt.id)}
                                        className={cn(
                                            "justify-start h-auto py-4 px-6 text-left border-2",
                                            variant === "default" && "bg-green-600 hover:bg-green-600 text-white border-green-700",
                                            variant === "destructive" && "bg-red-600 hover:bg-red-600 text-white border-red-700"
                                        )}
                                    >
                                        <span className="h-8 w-8 rounded-full border flex items-center justify-center mr-4 shrink-0">{String.fromCharCode(65 + i)}</span>
                                        <span className="flex-1">{opt.text}</span>
                                        {answerStatus !== 'none' && isCorrect && <Check className="ml-2 h-5 w-5" />}
                                        {answerStatus !== 'none' && isSelected && !isCorrect && <X className="ml-2 h-5 w-5" />}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                ) : currentSlide.type === 'short-answer' ? (
                    <div className="w-full max-w-xl space-y-8">
                        <Badge variant="secondary">Frage {currentIndex}</Badge>
                        <h2 className="text-2xl md:text-3xl font-bold leading-tight">{currentSlide.content.question}</h2>
                        <div className="relative">
                            <Input 
                                placeholder="Antwort tippen..." 
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value)}
                                disabled={answerStatus !== 'none' && answerStatus !== 'checking'}
                                className={cn("text-xl py-8 px-6", answerStatus === 'correct' && "border-green-500 bg-green-50", answerStatus === 'incorrect' && "border-red-500 bg-red-50")}
                                onKeyDown={(e) => e.key === 'Enter' && answerStatus === 'none' && checkShortAnswer()}
                            />
                            {answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
                        </div>
                        {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Antwort prüfen</Button>}
                        {answerStatus === 'correct' && <p className="text-center text-green-600 font-bold">Richtig!</p>}
                        {answerStatus === 'incorrect' && <p className="text-center text-red-600 font-bold">Leider falsch. Richtig wäre: {currentSlide.content.answer}</p>}
                    </div>
                ) : currentSlide.type === 'long-answer' ? (
                    <div className="w-full max-w-2xl space-y-8">
                        <div className="flex justify-between items-start">
                            <Badge variant="secondary">Freitext {currentIndex}</Badge>
                            {currentSlide.content.enablePoints && aiScore !== null && <Badge className="text-lg">{aiScore} / 10 Punkte</Badge>}
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold leading-tight">{currentSlide.content.question}</h2>
                        <div className="relative">
                            <Textarea 
                                placeholder="Deine Antwort..." 
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value)}
                                disabled={answerStatus !== 'none' && answerStatus !== 'checking'}
                                className={cn("text-lg p-6 min-h-[180px]", answerStatus === 'correct' && "border-green-500", answerStatus === 'incorrect' && "border-amber-500")}
                            />
                            {answerStatus === 'checking' && (
                                <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center rounded-md">
                                    <Loader2 className="animate-spin text-primary h-8 w-8 mb-2" />
                                    <p className="text-sm font-medium">KI bewertet deine Antwort...</p>
                                </div>
                            )}
                        </div>
                        {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkLongAnswerAction} disabled={!userAnswer.trim() || userAnswer.length < 5}>Antwort von KI prüfen lassen</Button>}
                        {aiFeedback && <p className="p-4 rounded-lg bg-secondary/50 text-sm">{aiFeedback}</p>}
                    </div>
                ) : currentSlide.type === 'vocabulary' ? (
                    <div className="w-full max-w-2xl space-y-8">
                        <Badge variant="secondary">Vokabel-Test {currentIndex}</Badge>
                        <h2 className="text-2xl font-bold">Übersetze Begriffe</h2>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {(currentSlide.content.pairs || []).map((pair: any) => (
                                <div key={pair.id} className="grid grid-cols-[1fr_1fr] items-center gap-4 p-3 bg-secondary/30 rounded-lg">
                                    <span className="font-semibold">{pair.foreign}</span>
                                    <Input 
                                        placeholder="..." 
                                        value={vocabAnswers[pair.id] || ''}
                                        onChange={(e) => setVocabAnswers(prev => ({ ...prev, [pair.id]: e.target.value }))}
                                        disabled={answerStatus !== 'none'}
                                        className={cn(answerStatus !== 'none' && vocabResults[pair.id] ? "border-green-500" : answerStatus !== 'none' ? "border-red-500" : "")}
                                    />
                                </div>
                            ))}
                        </div>
                        {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkVocabulary}>Vokabeln prüfen</Button>}
                    </div>
                ) : currentSlide.type === 'text' ? (
                    <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right duration-300">
                        <div className="space-y-4 text-center md:text-left">
                            <Badge variant="secondary"><FileText className="w-3 h-3 mr-1" /> Info</Badge>
                            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{currentSlide.content.title || 'Keine Überschrift'}</h2>
                        </div>
                        <Card className="bg-secondary/10 border-none">
                            <CardContent className="p-6 md:p-10">
                                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed whitespace-pre-wrap">{currentSlide.content.text}</p>
                            </CardContent>
                        </Card>
                    </div>
                ) : currentSlide.type === 'conclusion' ? (
                    <div className="text-center space-y-10 max-w-xl w-full animate-in fade-in zoom-in duration-500">
                        <div className="space-y-4">
                            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary"><Check className="h-10 w-10" /></div>
                            <h1 className="text-4xl font-extrabold tracking-tight">Fertig!</h1>
                            {userName && <p className="text-xl text-muted-foreground">Gut gemacht, {userName}!</p>}
                        </div>
                        <div className="grid gap-6">
                            {currentSlide.content.showScore && (
                                <Card className="bg-secondary/20 border-none">
                                    <CardContent className="p-6 space-y-2">
                                        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Dein Ergebnis</p>
                                        <span className="text-6xl font-black text-primary">{percentage}%</span>
                                        <p className="text-sm font-medium">{correctCount} von {totalQuestions} richtig</p>
                                    </CardContent>
                                </Card>
                            )}
                            {currentSlide.content.collectFeedback && (
                                <div className="space-y-4 pt-4 border-t">
                                    <Label className="text-base font-bold">Wie war das Quiz?</Label>
                                    <div className="flex justify-center gap-8">
                                        <button onClick={() => setFeedbackValue('sad')} className={cn("transition-all", feedbackValue === 'sad' ? "text-red-500 scale-125" : "text-muted-foreground")}><Frown className="h-12 w-12" /></button>
                                        <button onClick={() => setFeedbackValue('neutral')} className={cn("transition-all", feedbackValue === 'neutral' ? "text-amber-500 scale-125" : "text-muted-foreground")}><Meh className="h-12 w-12" /></button>
                                        <button onClick={() => setFeedbackValue('happy')} className={cn("transition-all", feedbackValue === 'happy' ? "text-green-500 scale-125" : "text-muted-foreground")}><Smile className="h-12 w-12" /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <Button className="w-full max-w-[250px]" size="lg" variant="outline" onClick={() => router.push('/')}>Quiz beenden</Button>
                    </div>
                ) : null}
            </main>

            <footer className="p-4 border-t bg-secondary/10 flex justify-between items-center">
                <Button variant="ghost" onClick={handleBack} disabled={currentIndex === 0}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Zurück
                </Button>
                <div className="h-2 flex-1 mx-8 bg-secondary rounded-full overflow-hidden max-w-[200px] hidden md:block">
                    <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentIndex + 1) / (quiz?.slides.length || 1)) * 100}%` }} />
                </div>
                <div className="flex items-center gap-2">
                    {currentIndex > 0 && quiz && currentIndex < quiz.slides.length - 1 && answerStatus === 'none' && (
                        <Button variant="ghost" size="sm" onClick={handleNext}>Überspringen</Button>
                    )}
                    <Button 
                        onClick={handleNext} 
                        disabled={
                            !quiz || currentIndex === quiz.slides.length - 1 || 
                            (currentSlide?.type !== 'welcome' && currentSlide?.type !== 'text' && currentSlide?.type !== 'conclusion' && (answerStatus === 'none' || answerStatus === 'checking'))
                        }
                    >
                        {quiz && currentIndex === quiz.slides.length - 1 ? 'Fertig' : 'Weiter'} <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </footer>
        </div>
    );
}
