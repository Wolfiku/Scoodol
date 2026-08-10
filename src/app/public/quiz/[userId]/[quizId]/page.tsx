
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, ChevronRight, ChevronLeft, BrainCircuit, Star, Smile, Meh, Frown, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { verifyQuizAnswer, checkLongAnswer } from '@/app/actions';

const { firestore } = initializeFirebase();

export default function PublicQuizPage() {
  const params = useParams();
  const { userId, quizId } = params;
  
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    async function fetchQuiz() {
      if (!userId || !quizId) return;
      const docRef = doc(firestore, `users/${userId}/quizzes`, quizId as string);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().isPublished) {
        setQuiz(snap.data());
      }
      setLoading(false);
    }
    fetchQuiz();
  }, [userId, quizId]);

  const currentSlide = quiz?.slides?.[currentIndex];
  const totalQuestions = useMemo(() => quiz?.slides?.filter((s: any) => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length || 0, [quiz]);

  const handleNext = async () => {
    if (currentIndex < quiz.slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswerStatus('none');
      setUserAnswer('');
      setSelectedMcOption(null);
      setAiFeedback(null);
      setAiScore(null);
    } else {
        await finishQuiz();
    }
  };

  const finishQuiz = async () => {
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const responseData = {
        userName: userName || 'Anonym',
        answers: allAnswers,
        percentage,
        rating: feedbackValue,
        completedAt: serverTimestamp(),
    };
    
    await addDoc(collection(firestore, `users/${userId}/quizzes/${quizId}/responses`), responseData);
    setIsFinished(true);
  }

  const checkShortAnswer = async () => {
    if (!userAnswer.trim()) return;
    setAnswerStatus('checking');
    const { answer, checkMode, question } = currentSlide.content;
    
    let isCorrect = userAnswer.trim().toLowerCase() === answer.trim().toLowerCase();
    
    if (!isCorrect && checkMode === 'ai') {
        const result = await verifyQuizAnswer(question, answer, userAnswer, 'German');
        isCorrect = result.isCorrect;
    }

    if (isCorrect) setCorrectCount(prev => prev + 1);
    setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
    setAllAnswers(prev => ({ ...prev, [currentSlide.id]: isCorrect }));
  }

  const checkLongAnswerAction = async () => {
    if (!userAnswer.trim()) return;
    setAnswerStatus('checking');
    const { question, referenceAnswer, criteria } = currentSlide.content;
    const result = await checkLongAnswer(question, referenceAnswer, criteria, userAnswer, 'German');
    setAiScore(result.score);
    setAiFeedback(result.feedback);
    if (result.isCorrect) setCorrectCount(prev => prev + 1);
    setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
    setAllAnswers(prev => ({ ...prev, [currentSlide.id]: { isCorrect: result.isCorrect, score: result.score, text: userAnswer } }));
  }

  const handleMcSelect = (optionId: string) => {
    if (answerStatus !== 'none') return;
    setSelectedMcOption(optionId);
    const option = currentSlide.content.options.find((o: any) => o.id === optionId);
    if (option.isCorrect) setCorrectCount(prev => prev + 1);
    setAnswerStatus(option.isCorrect ? 'correct' : 'incorrect');
    setAllAnswers(prev => ({ ...prev, [currentSlide.id]: optionId }));
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  if (!quiz) return <div className="flex items-center justify-center min-h-screen"><Card><CardHeader><CardTitle>Quiz nicht gefunden</CardTitle></CardHeader></Card></div>;

  if (isFinished) {
      return (
          <div className="min-h-screen bg-secondary/10 flex items-center justify-center p-4">
              <Card className="max-w-md w-full text-center p-8 space-y-6 animate-in zoom-in duration-500">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                  <h1 className="text-3xl font-black">Geschafft!</h1>
                  <p className="text-muted-foreground">Vielen Dank für deine Teilnahme. Deine Ergebnisse wurden an den Ersteller übermittelt.</p>
                  <Button className="w-full" variant="outline" onClick={() => window.location.reload()}>Nochmal versuchen</Button>
              </Card>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
       <header className="p-4 border-b flex justify-between items-center bg-card shadow-sm">
           <div className="flex items-center gap-2"><BrainCircuit className="text-primary"/><span className="font-bold truncate max-w-[200px]">{quiz.title}</span></div>
           <Badge variant="secondary">{currentIndex + 1} / {quiz.slides.length}</Badge>
       </header>

       <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full">
            {currentSlide.type === 'welcome' && (
                <div className="text-center space-y-8 animate-in fade-in duration-500">
                    <h1 className="text-5xl font-black">{quiz.title}</h1>
                    <p className="text-xl text-muted-foreground">von {quiz.creator}</p>
                    {currentSlide.content.subtitle && <p className="text-lg italic">"{currentSlide.content.subtitle}"</p>}
                    {currentSlide.content.askName && (
                        <div className="space-y-2 text-left max-w-sm mx-auto">
                            <Label>Dein Name</Label>
                            <Input placeholder="Eingeben..." value={userName} onChange={e => setUserName(e.target.value)} />
                        </div>
                    )}
                    <Button size="lg" className="w-full max-w-xs h-16 text-xl font-bold" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>Starten</Button>
                </div>
            )}

            {currentSlide.type === 'multiple-choice' && (
                <div className="w-full space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <h2 className="text-3xl font-bold">{currentSlide.content.question}</h2>
                    <div className="grid gap-3">
                        {currentSlide.content.options.map((opt: any) => (
                            <Button 
                                key={opt.id} 
                                variant="outline" 
                                className={cn(
                                    "h-auto py-5 px-6 text-left justify-start text-lg border-2 transition-all",
                                    answerStatus !== 'none' && opt.isCorrect && "bg-green-500 border-green-600 text-white",
                                    answerStatus !== 'none' && selectedMcOption === opt.id && !opt.isCorrect && "bg-red-500 border-red-600 text-white"
                                )}
                                onClick={() => handleMcSelect(opt.id)}
                                disabled={answerStatus !== 'none'}
                            >
                                {opt.text}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {currentSlide.type === 'short-answer' && (
                 <div className="w-full max-w-2xl space-y-8 text-center animate-in slide-in-from-right-4 duration-300">
                    <h2 className="text-3xl font-bold">{currentSlide.content.question}</h2>
                    <div className="relative">
                        <Input 
                            className="text-2xl h-16 text-center" 
                            placeholder="Antwort eingeben..." 
                            value={userAnswer} 
                            onChange={e => setUserAnswer(e.target.value)}
                            disabled={answerStatus !== 'none' && answerStatus !== 'checking'}
                        />
                        {answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
                    </div>
                    {answerStatus === 'none' && <Button size="lg" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Prüfen</Button>}
                    {answerStatus === 'correct' && <Badge className="bg-green-500 text-lg py-2 px-4">Richtig!</Badge>}
                    {answerStatus === 'incorrect' && <div className="space-y-2"><Badge variant="destructive" className="text-lg py-2 px-4">Falsch</Badge><p className="text-muted-foreground">Lösung: {currentSlide.content.answer}</p></div>}
                 </div>
            )}

            {currentSlide.type === 'long-answer' && (
                <div className="w-full max-w-3xl space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <h2 className="text-3xl font-bold">{currentSlide.content.question}</h2>
                    <Textarea 
                        className="text-lg p-6 min-h-[200px]" 
                        placeholder="Deine Antwort..." 
                        value={userAnswer} 
                        onChange={e => setUserAnswer(e.target.value)}
                        disabled={answerStatus !== 'none' && answerStatus !== 'checking'}
                    />
                    {answerStatus === 'none' && <Button size="lg" className="w-full" onClick={checkLongAnswerAction} disabled={!userAnswer.trim()}>KI-Bewertung starten</Button>}
                    {answerStatus === 'checking' && <div className="flex items-center gap-2 text-primary font-bold"><Loader2 className="animate-spin" /> KI wertet aus...</div>}
                    {aiFeedback && (
                        <Card className="bg-primary/5 border-primary/20"><CardContent className="p-4 space-y-2"><div className="flex justify-between items-center"><span className="font-bold flex items-center gap-2"><Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Feedback</span><Badge>Punkte: {aiScore}/10</Badge></div><p className="text-sm">{aiFeedback}</p></CardContent></Card>
                    )}
                </div>
            )}

            {currentSlide.type === 'text' && (
                <div className="w-full max-w-3xl space-y-6 animate-in fade-in duration-500">
                    <h2 className="text-4xl font-black">{currentSlide.content.title}</h2>
                    <div className="text-xl leading-relaxed text-muted-foreground whitespace-pre-wrap">{currentSlide.content.text}</div>
                    <Button size="lg" onClick={handleNext}>Weiter</Button>
                </div>
            )}

            {currentSlide.type === 'conclusion' && (
                <div className="text-center space-y-10 max-w-md w-full animate-in zoom-in duration-500">
                    <h1 className="text-5xl font-black">Fertig!</h1>
                    {currentSlide.content.showScore && (
                        <div className="p-10 bg-primary/10 rounded-3xl border-4 border-primary/20">
                            <p className="text-sm font-black uppercase tracking-widest text-primary mb-2">Dein Ergebnis</p>
                            <p className="text-8xl font-black text-primary">{totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%</p>
                        </div>
                    )}
                    {currentSlide.content.collectFeedback && (
                        <div className="space-y-4">
                            <p className="font-bold text-lg">Wie hat dir das Quiz gefallen?</p>
                            <div className="flex justify-center gap-6">
                                <button onClick={() => setFeedbackValue('sad')} className={cn("p-2 transition-transform hover:scale-110", feedbackValue === 'sad' ? "text-red-500" : "text-muted-foreground")}><Frown className="w-16 h-16" /></button>
                                <button onClick={() => setFeedbackValue('neutral')} className={cn("p-2 transition-transform hover:scale-110", feedbackValue === 'neutral' ? "text-amber-500" : "text-muted-foreground")}><Meh className="w-16 h-16" /></button>
                                <button onClick={() => setFeedbackValue('happy')} className={cn("p-2 transition-transform hover:scale-110", feedbackValue === 'happy' ? "text-green-500" : "text-muted-foreground")}><Smile className="w-16 h-16" /></button>
                            </div>
                        </div>
                    )}
                    <Button size="lg" className="w-full h-16 text-xl font-bold" onClick={handleNext}>Quiz beenden & Speichern</Button>
                </div>
            )}
       </main>

       <footer className="p-4 border-t bg-card flex items-center justify-between">
            <div className="flex-1 max-w-xs h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentIndex + 1) / quiz.slides.length) * 100}%` }} />
            </div>
            {currentSlide.type !== 'welcome' && currentSlide.type !== 'conclusion' && answerStatus !== 'none' && (
                <Button onClick={handleNext} className="ml-4">Weiter <ChevronRight className="ml-2 h-4 w-4" /></Button>
            )}
       </footer>
    </div>
  );
}
