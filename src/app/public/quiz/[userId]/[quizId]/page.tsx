'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, User, Shield, Star, ChevronRight, Frown, Meh, Smile, CheckCircle2 } from 'lucide-react';
import { verifyQuizAnswer, checkLongAnswer } from '@/app/actions';
import { cn } from '@/lib/utils';

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
  const router = useRouter();
  const firestore = useFirestore();
  const userId = params.userId as string;
  const quizId = params.quizId as string;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userName, setUserName] = useState('');
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [answerStatus, setAnswerStatus] = useState<'none' | 'correct' | 'incorrect' | 'checking'>('none');
  const [userInputValue, setUserInputValue] = useState('');
  const [vocabAnswers, setVocabAnswers] = useState<Record<string, string>>({});
  const [vocabResults, setVocabResults] = useState<Record<string, boolean>>({});
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [selectedMcOption, setSelectedMcOption] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAlreadyParticipated, setHasAlreadyParticipated] = useState(false);

  const quizDocRef = useMemoFirebase(() => 
    userId && quizId ? doc(firestore, `users/${userId}/quizzes`, quizId) : null
  , [firestore, userId, quizId]);

  const { data: quiz, isLoading: isLoadingQuiz } = useDoc<Quiz>(quizDocRef);

  useEffect(() => {
    if (typeof window !== 'undefined' && quizId) {
      const participations = JSON.parse(localStorage.getItem('quiz_participations') || '{}');
      if (participations[quizId]) {
        setHasAlreadyParticipated(true);
      }
    }
  }, [quizId]);

  const currentSlide = quiz?.slides[currentIndex];
  const isLastSlide = currentIndex === (quiz?.slides.length || 0) - 1;

  const handleNext = () => {
    if (currentIndex < (quiz?.slides.length || 0) - 1) {
      setCurrentIndex(prev => prev + 1);
      setAnswerStatus('none');
      setUserInputValue('');
      setAiFeedback(null);
      setAiScore(null);
      setSelectedMcOption(null);
      setVocabAnswers({});
      setVocabResults({});
    }
  };

  const handleMcSelect = (optionId: string) => {
    if (answerStatus !== 'none') return;
    setSelectedMcOption(optionId);
    const options = currentSlide?.content.options || [];
    const option = options.find((o: any) => o.id === optionId);
    const isCorrect = option?.isCorrect;
    
    setUserAnswers(prev => ({ ...prev, [currentSlide!.id]: optionId }));
    setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
  };

  const handleShortAnswer = async () => {
    if (!userInputValue.trim()) return;
    setAnswerStatus('checking');
    const { answer, checkMode, question } = currentSlide?.content;
    let isCorrect = false;
    
    if (checkMode === 'strict') isCorrect = userInputValue.trim() === answer.trim();
    else if (checkMode === 'helpfull') isCorrect = userInputValue.trim().toLowerCase() === answer.trim().toLowerCase();
    else {
      const result = await verifyQuizAnswer(question, answer, userInputValue, 'German');
      isCorrect = result.isCorrect;
    }

    setUserAnswers(prev => ({ ...prev, [currentSlide!.id]: { text: userInputValue, isCorrect } }));
    setAnswerStatus(isCorrect ? 'correct' : 'incorrect');
  };

  const handleLongAnswer = async () => {
    if (!userInputValue.trim()) return;
    setAnswerStatus('checking');
    const { question, referenceAnswer, criteria } = currentSlide?.content;
    const result = await checkLongAnswer(question, referenceAnswer, criteria, userInputValue, 'German');
    
    setAiScore(result.score);
    setAiFeedback(result.feedback);
    setUserAnswers(prev => ({ ...prev, [currentSlide!.id]: { text: userInputValue, score: result.score, feedback: result.feedback, isCorrect: result.isCorrect } }));
    setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
  };

  const handleVocabCheck = () => {
    const pairs = currentSlide?.content.pairs || [];
    const results: Record<string, boolean> = {};
    let allCorrect = true;
    pairs.forEach((p: any) => {
        const isCorrect = (vocabAnswers[p.id] || '').trim().toLowerCase() === p.german.trim().toLowerCase();
        results[p.id] = isCorrect;
        if (!isCorrect) allCorrect = false;
    });
    setVocabResults(results);
    setUserAnswers(prev => ({ ...prev, [currentSlide!.id]: { answers: vocabAnswers, results, isCorrect: allCorrect } }));
    setAnswerStatus(allCorrect ? 'correct' : 'incorrect');
  };

  const handleFinish = async (rating?: string) => {
    if (isSubmitting || !userId || !quizId) return;
    setIsSubmitting(true);

    const questions = quiz?.slides.filter(s => !['welcome', 'text', 'conclusion'].includes(s.type)) || [];
    let correctCount = 0;
    questions.forEach(q => {
        const ans = userAnswers[q.id];
        if (q.type === 'multiple-choice') {
            const opt = q.content.options.find((o: any) => o.id === ans);
            if (opt?.isCorrect) correctCount++;
        } else if (ans?.isCorrect) {
            correctCount++;
        }
    });

    const percentage = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;

    try {
      await addDoc(collection(firestore, `users/${userId}/quizzes/${quizId}/responses`), {
        userName: userName || 'Anonym',
        answers: userAnswers,
        percentage,
        rating,
        completedAt: serverTimestamp(),
      });

      const participations = JSON.parse(localStorage.getItem('quiz_participations') || '{}');
      participations[quizId] = true;
      localStorage.setItem('quiz_participations', JSON.stringify(participations));
      
      router.push('/');
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
    }
  };

  if (isLoadingQuiz) {
    return <div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary w-12 h-12" /><p className="mt-4 text-muted-foreground">Quiz wird geladen...</p></div>;
  }

  if (!quiz || (!quiz.isPublished && currentIndex === 0)) {
    return <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center"><Card className="max-w-md p-8"><CardContent className="pt-6"><h1 className="text-2xl font-bold mb-2">Quiz nicht verfügbar</h1><p className="text-muted-foreground">Dieses Quiz wurde entweder noch nicht veröffentlicht oder existiert nicht.</p><Button onClick={() => router.push('/')} className="mt-6">Zurück zur Startseite</Button></CardContent></Card></div>;
  }

  if (hasAlreadyParticipated) {
    return <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center"><Card className="max-w-md p-8"><CardContent className="pt-6"><CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" /><h1 className="text-2xl font-bold mb-2">Bereits teilgenommen</h1><p className="text-muted-foreground">Du hast dieses Quiz bereits abgeschlossen. Vielen Dank!</p><Button onClick={() => router.push('/')} className="mt-6">Zurück zur Startseite</Button></CardContent></Card></div>;
  }

  const renderSlide = () => {
    switch (currentSlide?.type) {
      case 'welcome':
        return (
          <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <h1 className="text-5xl font-black tracking-tight">{quiz.title}</h1>
            <p className="text-xl text-muted-foreground">Erstellt von {quiz.creator}</p>
            <div className="flex flex-wrap justify-center gap-3">
                <Badge variant="outline" className="bg-secondary/50 py-1.5 px-4 text-sm font-medium">
                    {currentSlide.content.askName ? <User className="w-4 h-4 mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                    {currentSlide.content.askName ? 'Name erforderlich' : 'Anonymes Quiz'}
                </Badge>
                {quiz.slides.some(s => ['long-answer'].includes(s.type)) && (
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 py-1.5 px-4 text-sm font-medium">
                        <Sparkles className="w-4 h-4 mr-2" /> KI-gestützt
                    </Badge>
                )}
            </div>
            {currentSlide.content.askName && (
                <div className="space-y-3 max-w-sm mx-auto">
                    <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Dein Name</Label>
                    <Input placeholder="Wie heißt du?" value={userName} onChange={e => setUserName(e.target.value)} className="text-center text-lg h-14" />
                </div>
            )}
            <Button className="w-full max-w-xs h-14 text-lg font-bold" size="lg" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>
              Quiz starten
            </Button>
          </div>
        );

      case 'multiple-choice':
        return (
          <div className="w-full max-w-2xl space-y-8">
            <h2 className="text-3xl font-bold">{currentSlide.content.question}</h2>
            <div className="grid gap-4">
              {currentSlide.content.options.map((opt: any) => {
                const isSelected = selectedMcOption === opt.id;
                const isCorrect = opt.isCorrect;
                return (
                  <Button
                    key={opt.id}
                    variant="outline"
                    disabled={answerStatus !== 'none'}
                    onClick={() => handleMcSelect(opt.id)}
                    className={cn(
                      "justify-start h-auto py-5 px-6 text-left border-2 text-lg transition-all duration-300",
                      answerStatus !== 'none' && isCorrect && "bg-green-600 border-green-700 text-white opacity-100",
                      answerStatus !== 'none' && isSelected && !isCorrect && "bg-red-600 border-red-700 text-white opacity-100",
                      answerStatus !== 'none' && !isCorrect && !isSelected && "opacity-50"
                    )}
                  >
                    {opt.text}
                  </Button>
                );
              })}
            </div>
          </div>
        );

      case 'short-answer':
        return (
          <div className="w-full max-w-xl space-y-8 text-center">
            <h2 className="text-3xl font-bold">{currentSlide.content.question}</h2>
            <div className="relative">
              <Input 
                placeholder="Deine Antwort..." 
                value={userInputValue} 
                onChange={e => setUserInputValue(e.target.value)} 
                disabled={answerStatus !== 'none' && answerStatus !== 'checking'} 
                className="text-2xl py-10 px-6 text-center border-2 focus:ring-0"
              />
              {answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
            </div>
            {answerStatus === 'none' && <Button size="lg" className="h-14 px-12 text-lg font-bold" onClick={handleShortAnswer} disabled={!userInputValue.trim()}>Antwort prüfen</Button>}
            {answerStatus === 'correct' && <div className="text-green-600 font-bold text-xl animate-in zoom-in">Richtig! <CheckCircle2 className="inline ml-2" /></div>}
            {answerStatus === 'incorrect' && <div className="text-red-600 font-bold text-xl animate-in zoom-in">Falsch. Die Lösung ist: {currentSlide.content.answer}</div>}
          </div>
        );

      case 'long-answer':
        return (
          <div className="w-full max-w-2xl space-y-8">
            <h2 className="text-3xl font-bold flex items-center gap-3">
                <Sparkles className="text-primary" /> {currentSlide.content.question}
            </h2>
            <div className="relative">
              <Textarea 
                placeholder="Schreibe hier deine ausführliche Antwort..." 
                value={userInputValue} 
                onChange={e => setUserInputValue(e.target.value)} 
                disabled={answerStatus !== 'none' && answerStatus !== 'checking'} 
                className="text-lg p-6 min-h-[250px] border-2"
              />
              {answerStatus === 'checking' && (
                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center rounded-md z-10 backdrop-blur-sm">
                    <Loader2 className="animate-spin h-12 w-12 text-primary" />
                    <p className="mt-4 font-bold text-primary">KI analysiert deine Antwort...</p>
                </div>
              )}
            </div>
            {answerStatus === 'none' && <Button size="lg" className="w-full h-14 text-lg font-bold" onClick={handleLongAnswer} disabled={!userInputValue.trim()}>KI-Prüfung starten</Button>}
            {aiFeedback && (
                <div className="p-6 rounded-xl bg-secondary/50 border-2 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <p className="font-bold flex items-center gap-2 text-primary uppercase tracking-widest text-xs">
                            <Sparkles className="w-4 h-4" /> KI-Auswertung
                        </p>
                        <Badge className="text-lg font-bold px-3 py-1">{aiScore} / 10</Badge>
                    </div>
                    <p className="text-lg leading-relaxed">{aiFeedback}</p>
                </div>
            )}
          </div>
        );

      case 'vocabulary':
        return (
          <div className="w-full max-w-2xl space-y-8">
            <h2 className="text-3xl font-bold text-center">Vokabel-Test</h2>
            <div className="bg-secondary/30 p-8 rounded-2xl border-2 space-y-6">
                {currentSlide.content.pairs.map((pair: any) => (
                    <div key={pair.id} className="grid grid-cols-[1fr_auto_1.5fr] gap-6 items-center">
                        <div className="text-right text-xl font-medium">{pair.foreign}</div>
                        <ChevronRight className="text-muted-foreground w-5 h-5" />
                        <Input 
                            placeholder="Übersetzung..." 
                            value={vocabAnswers[pair.id] || ''} 
                            onChange={e => setVocabAnswers(prev => ({...prev, [pair.id]: e.target.value}))}
                            disabled={answerStatus !== 'none'}
                            className={cn(
                                "text-lg h-12 border-2",
                                vocabResults[pair.id] === true && "border-green-500 bg-green-50",
                                vocabResults[pair.id] === false && "border-red-500 bg-red-50"
                            )}
                        />
                    </div>
                ))}
            </div>
            {answerStatus === 'none' && <Button className="w-full h-14 text-lg font-bold" onClick={handleVocabCheck}>Abschicken & Prüfen</Button>}
          </div>
        );

      case 'text':
        return (
          <div className="w-full max-w-3xl space-y-8 animate-in fade-in duration-700">
            <h2 className="text-4xl font-black border-b-4 border-primary pb-6 w-fit">{currentSlide.content.title}</h2>
            <div className="text-xl leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {currentSlide.content.text}
            </div>
          </div>
        );

      case 'conclusion':
        return (
          <div className="text-center space-y-12 max-w-lg animate-in zoom-in duration-500">
            <div className="space-y-4">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-12 h-12 text-primary" />
                </div>
                <h1 className="text-5xl font-black tracking-tighter">Geschafft!</h1>
                <p className="text-xl text-muted-foreground">Du hast alle Fragen des Quizzes beantwortet.</p>
            </div>

            {currentSlide.content.collectFeedback && (
                <div className="space-y-6 bg-secondary/30 p-8 rounded-3xl border-2">
                    <p className="font-bold text-lg">Wie hat dir das Quiz gefallen?</p>
                    <div className="flex justify-around">
                        <Button variant="ghost" size="icon" className={cn("w-16 h-16 rounded-2xl hover:bg-red-100", isSubmitting && "opacity-50")} onClick={() => handleFinish('sad')} disabled={isSubmitting}>
                            <Frown className="w-10 h-10 text-red-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className={cn("w-16 h-16 rounded-2xl hover:bg-amber-100", isSubmitting && "opacity-50")} onClick={() => handleFinish('neutral')} disabled={isSubmitting}>
                            <Meh className="w-10 h-10 text-amber-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className={cn("w-16 h-16 rounded-2xl hover:bg-green-100", isSubmitting && "opacity-50")} onClick={() => handleFinish('happy')} disabled={isSubmitting}>
                            <Smile className="w-10 h-10 text-green-500" />
                        </Button>
                    </div>
                </div>
            )}

            {!currentSlide.content.collectFeedback && (
                <Button className="w-full h-16 text-xl font-bold" size="lg" onClick={() => handleFinish()} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : 'Ergebnisse speichern & Beenden'}
                </Button>
            )}
          </div>
        );

      default:
        return <div>Folientyp wird geladen...</div>;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto">
        {renderSlide()}
      </main>

      {currentIndex > 0 && quiz && (
        <footer className="p-4 border-t bg-secondary/10 flex flex-col gap-2">
          <div className="flex justify-end px-2">
            <span className="text-[10px] font-mono font-black text-muted-foreground uppercase tracking-widest">
                Folie {currentIndex + 1} / {quiz.slides.length}
            </span>
          </div>
          <Progress value={((currentIndex + 1) / quiz.slides.length) * 100} className="h-1.5" />
          <div className="flex justify-end mt-2">
            {!isLastSlide && (
              <Button onClick={handleNext} disabled={answerStatus === 'checking' || (answerStatus === 'none' && !['welcome', 'text'].includes(currentSlide?.type || ''))}>
                Weiter <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
