
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { initializeFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check, X, ChevronRight, Sparkles, Shield, User, Star, AlertCircle, Frown, Meh, Smile, BarChart3, CheckCircle2, Link as LinkIcon } from 'lucide-react';
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
  const { aiLanguage } = useTheme();

  const { firestore } = useMemo(() => initializeFirebase(), []);

  const quizDocRef = useMemoFirebase(() => 
    firestore && typeof userId === 'string' && typeof quizId === 'string'
      ? doc(firestore, `users/${userId}/quizzes`, quizId)
      : null
  , [firestore, userId, quizId]);

  const { data: quiz, isLoading: isLoadingQuiz } = useDoc<Quiz>(quizDocRef);

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
  const [allAnswers, setAllAnswers] = useState<Record<string, any>>({});
  const [isSaved, setIsSaved] = useState(false);
  const [hasParticipated, setHasParticipated] = useState(false);

  useEffect(() => {
      if (typeof window !== 'undefined' && quizId) {
          const participated = localStorage.getItem(`quiz_${quizId}_participated`);
          if (participated === 'true') {
              setHasParticipated(true);
          }
      }
  }, [quizId]);

  useEffect(() => {
    if (quiz) {
      const count = quiz.slides.filter(s => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length;
      setTotalQuestions(count);
    }
  }, [quiz]);

  const currentSlide = quiz?.slides[currentIndex];
  const usesAI = useMemo(() => quiz?.slides.some(s => s.type === 'long-answer' || (s.type === 'short-answer' && s.content.checkMode === 'ai')), [quiz]);

  const handleNext = async () => {
    // Collect data for current slide
    const newAnswers = { ...allAnswers };
    if (currentSlide?.type === 'multiple-choice') newAnswers[currentSlide.id] = selectedMcOption;
    else if (currentSlide?.type === 'short-answer') newAnswers[currentSlide.id] = { text: userAnswer, isCorrect: answerStatus === 'correct' };
    else if (currentSlide?.type === 'long-answer') newAnswers[currentSlide.id] = { text: userAnswer, score: aiScore, feedback: aiFeedback, isCorrect: answerStatus === 'correct' };
    else if (currentSlide?.type === 'vocabulary') newAnswers[currentSlide.id] = { isCorrect: answerStatus === 'correct' };
    
    setAllAnswers(newAnswers);

    if (currentIndex > 0 && answerStatus === 'correct') {
      setCorrectCount(prev => prev + 1);
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
        // Last slide - Conclusion
        saveResults(newAnswers);
    }
  };

  const saveResults = async (finalAnswers: Record<string, any>) => {
      if (!firestore || !userId || !quizId || isSaved) return;
      
      try {
          const responsesCol = collection(firestore, `users/${userId}/quizzes/${quizId}/responses`);
          const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
          
          await addDoc(responsesCol, {
              userName: userName || 'Anonym',
              answers: finalAnswers,
              percentage,
              rating: feedbackValue,
              completedAt: serverTimestamp()
          });
          
          setIsSaved(true);
          localStorage.setItem(`quiz_${quizId}_participated`, 'true');
      } catch (e) {
          console.error("Error saving results:", e);
      }
  }

  const normalizeText = (text: string) => {
    return text.trim().toLowerCase().replace(/ss/g, 'ß').replace(/\s+/g, ' ');
  }

  const checkShortAnswer = async () => {
    if (!userAnswer.trim()) return;
    setAnswerStatus('checking');

    const { answer, answerType, checkMode, question } = currentSlide?.content;
    const normalizedCorrect = normalizeText(answer);
    const normalizedUser = normalizeText(userAnswer);

    let isCorrect = false;

    if (answerType === 'year') {
      isCorrect = userAnswer.trim() === answer.trim();
    } else {
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

  if (isLoadingQuiz) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-12 h-12" /></div>;
  }

  if (!quiz || !quiz.isPublished) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center space-y-4">
        <AlertCircle className="h-16 w-16 text-muted-foreground opacity-20" />
        <h1 className="text-2xl font-bold">Dieses Quiz ist nicht verfügbar</h1>
        <p className="text-muted-foreground">Der Link ist ungültig oder das Quiz wurde offline genommen.</p>
      </div>
    );
  }

  if (hasParticipated) {
      return (
          <div className="flex flex-col items-center justify-center h-screen p-4 text-center space-y-6">
              <CheckCircle2 className="h-20 w-20 text-green-500 animate-in zoom-in duration-500" />
              <div className="space-y-2">
                  <h1 className="text-3xl font-extrabold tracking-tight">Vielen Dank!</h1>
                  <p className="text-muted-foreground">Du hast an diesem Quiz bereits teilgenommen.</p>
              </div>
              <Button onClick={() => window.close()} variant="outline">Fenster schließen</Button>
          </div>
      )
  }

  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <main className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center">
        {currentSlide?.type === 'welcome' ? (
          <div className="text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-300">
            <div className="space-y-2">
              <h1 className="text-4xl font-extrabold tracking-tight">{quiz.title}</h1>
              <p className="text-muted-foreground">von {quiz.creator}</p>
            </div>
            
            {currentSlide.content.subtitle && (
              <Card className="bg-secondary/30 border-none">
                <CardContent className="p-4">
                  <p className="text-sm italic text-muted-foreground leading-relaxed">"{currentSlide.content.subtitle}"</p>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              <Badge variant="outline" className="bg-background border-primary/20 text-primary py-1.5 px-3">
                {currentSlide.content.askName ? <User className="w-3.5 h-3.5 mr-2" /> : <Shield className="w-3.5 h-3.5 mr-2" />}
                {currentSlide.content.askName ? 'Name erforderlich' : 'Anonymes Quiz'}
              </Badge>
              {usesAI && (
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 py-1.5 px-3">
                  <Sparkles className="w-3.5 h-3.5 mr-2" /> KI-gestützt
                </Badge>
              )}
            </div>

            {currentSlide.content.askName && (
              <div className="space-y-2 text-left">
                <Label>Wie heißt du?</Label>
                <Input placeholder="Dein Name..." value={userName} onChange={(e) => setUserName(e.target.value)} className="text-lg py-6" />
              </div>
            )}

            <Button className="w-full text-lg py-6 h-auto font-bold shadow-lg" size="lg" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>
              Quiz starten
            </Button>
          </div>
        ) : currentSlide?.type === 'multiple-choice' ? (
          <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right duration-300">
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">{currentSlide.content.question}</h2>
            <div className="grid gap-3">
              {currentSlide.content.options.map((opt: any, i: number) => {
                const isSelected = selectedMcOption === opt.id;
                const isCorrect = opt.isCorrect;
                let btnVariant: "outline" | "default" | "destructive" = "outline";
                if (answerStatus !== 'none') {
                  if (isCorrect) btnVariant = "default";
                  else if (isSelected && !isCorrect) btnVariant = "destructive";
                }
                return (
                  <Button 
                    key={opt.id} 
                    variant={btnVariant}
                    disabled={answerStatus !== 'none'}
                    onClick={() => handleMcSelect(opt.id)}
                    className={cn(
                      "justify-start h-auto py-4 px-6 text-left text-base border-2 transition-all",
                      btnVariant === "outline" && "hover:border-primary hover:bg-primary/5",
                      btnVariant === "default" && "bg-green-600 hover:bg-green-600 text-white border-green-700",
                      btnVariant === "destructive" && "bg-red-600 hover:bg-red-600 text-white border-red-700"
                    )}
                  >
                    <span className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mr-4 shrink-0 font-bold text-xs">{String.fromCharCode(65 + i)}</span>
                    <span className="flex-1">{opt.text}</span>
                    {answerStatus !== 'none' && isCorrect && <Check className="ml-2 h-5 w-5" />}
                    {answerStatus !== 'none' && isSelected && !isCorrect && <X className="ml-2 h-5 w-5" />}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : currentSlide?.type === 'short-answer' ? (
          <div className="w-full max-w-xl space-y-8 animate-in slide-in-from-right duration-300">
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">{currentSlide.content.question}</h2>
            <div className="space-y-4">
              <div className="relative">
                <Input 
                  type={currentSlide.content.answerType === 'year' ? 'number' : 'text'}
                  placeholder="Antwort tippen..." 
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  disabled={answerStatus !== 'none' && answerStatus !== 'checking'}
                  className={cn("text-xl py-8 px-6", answerStatus === 'correct' && "border-green-500 bg-green-50", answerStatus === 'incorrect' && "border-red-500 bg-red-50")}
                  onKeyDown={(e) => e.key === 'Enter' && answerStatus === 'none' && checkShortAnswer()}
                />
                {answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
              </div>
              {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Prüfen</Button>}
              {answerStatus === 'incorrect' && <p className="text-sm text-red-600 font-bold">Richtig wäre: {currentSlide.content.answer}</p>}
            </div>
          </div>
        ) : currentSlide?.type === 'long-answer' ? (
          <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right duration-300">
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">{currentSlide.content.question}</h2>
            <div className="space-y-4 min-h-[300px]">
              <div className="relative">
                <Textarea 
                  placeholder="Deine ausführliche Antwort..." 
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  disabled={answerStatus !== 'none' && answerStatus !== 'checking'}
                  className={cn("text-lg p-6 min-h-[180px] transition-all", answerStatus === 'correct' && "border-green-500 bg-green-50", answerStatus === 'incorrect' && "border-amber-500 bg-amber-50")}
                />
                {answerStatus === 'checking' && (
                  <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center rounded-md">
                    <Loader2 className="animate-spin text-primary h-8 w-8 mb-2" />
                    <p className="text-sm font-medium">KI wertet aus...</p>
                  </div>
                )}
              </div>
              {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkLongAnswerAction} disabled={!userAnswer.trim() || userAnswer.length < 5}><Sparkles className="w-4 h-4 mr-2" /> Von KI prüfen lassen</Button>}
              {answerStatus !== 'none' && answerStatus !== 'checking' && aiFeedback && (
                <div className={cn("p-4 rounded-lg flex items-start gap-3 animate-in fade-in", answerStatus === 'correct' ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")}>
                  {answerStatus === 'correct' ? <Check className="h-6 w-6 mt-1 shrink-0" /> : <AlertCircle className="h-6 w-6 mt-1 shrink-0" />}
                  <div className="space-y-1">
                    <p className="font-bold">{answerStatus === 'correct' ? 'Gut gemacht!' : 'Fast geschafft.'}</p>
                    <p className="text-sm leading-relaxed">{aiFeedback}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : currentSlide?.type === 'vocabulary' ? (
          <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right duration-300">
            <h2 className="text-2xl font-bold">Vokabel-Test</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {currentSlide.content.pairs.map((pair: any) => (
                <div key={pair.id} className="space-y-1">
                  <div className="grid grid-cols-[1fr_1fr] items-center gap-4 p-3 bg-secondary/30 rounded-lg">
                    <span className="font-semibold text-lg">{pair.foreign}</span>
                    <Input placeholder="..." value={vocabAnswers[pair.id] || ''} onChange={(e) => setVocabAnswers(prev => ({ ...prev, [pair.id]: e.target.value }))} disabled={answerStatus !== 'none'} className={cn(answerStatus !== 'none' && vocabResults[pair.id] === true && "border-green-500 bg-green-50", answerStatus !== 'none' && vocabResults[pair.id] === false && "border-red-500 bg-red-50")} />
                  </div>
                  {answerStatus !== 'none' && vocabResults[pair.id] === false && <p className="text-xs text-red-600 px-3">Richtig: {pair.german}</p>}
                </div>
              ))}
            </div>
            {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkVocabulary}>Prüfen</Button>}
          </div>
        ) : currentSlide?.type === 'text' ? (
          <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right duration-300">
            <h2 className="text-3xl font-extrabold tracking-tight">{currentSlide.content.title}</h2>
            <Card className="bg-secondary/10 border-none">
              <CardContent className="p-6 md:p-10">
                <p className="text-lg md:text-xl text-muted-foreground whitespace-pre-wrap">{currentSlide.content.text}</p>
              </CardContent>
            </Card>
          </div>
        ) : currentSlide?.type === 'conclusion' ? (
          <div className="text-center space-y-10 max-w-xl w-full animate-in fade-in zoom-in duration-500">
            <div className="space-y-4">
              <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary animate-bounce"><Check className="h-10 w-10" /></div>
              <h1 className="text-4xl font-extrabold tracking-tight">Fertig!</h1>
              <p className="text-xl text-muted-foreground">{isSaved ? 'Deine Ergebnisse wurden gespeichert.' : 'Speichere jetzt deine Ergebnisse.'}</p>
            </div>
            <div className="grid gap-6">
              {currentSlide.content.showScore && <div className="text-6xl font-black text-primary">{percentage}%</div>}
              {currentSlide.content.collectFeedback && !isSaved && (
                <div className="flex justify-center gap-8 py-4">
                  <button onClick={() => setFeedbackValue('sad')} className={cn("transition-all transform hover:scale-110", feedbackValue === 'sad' ? "text-red-500 scale-125" : "text-muted-foreground")}><Frown className="h-12 w-12" /></button>
                  <button onClick={() => setFeedbackValue('neutral')} className={cn("transition-all transform hover:scale-110", feedbackValue === 'neutral' ? "text-amber-500 scale-125" : "text-muted-foreground")}><Meh className="h-12 w-12" /></button>
                  <button onClick={() => setFeedbackValue('happy')} className={cn("transition-all transform hover:scale-110", feedbackValue === 'happy' ? "text-green-500 scale-125" : "text-muted-foreground")}><Smile className="h-12 w-12" /></button>
                </div>
              )}
            </div>
            {!isSaved ? (
                <Button className="w-full max-w-[250px]" size="lg" onClick={handleNext} disabled={currentSlide.content.collectFeedback && !feedbackValue}>Ergebnis speichern</Button>
            ) : (
                <Button variant="outline" size="lg" onClick={() => window.close()}>Quiz schließen</Button>
            )}
          </div>
        ) : null}
      </main>

      <footer className="p-4 border-t bg-background flex flex-col gap-2">
        <div className="flex justify-end mb-1">
            <div className="text-[10px] font-mono font-bold text-muted-foreground">
                {currentIndex + 1} / {quiz.slides.length}
            </div>
        </div>
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentIndex + 1) / quiz.slides.length) * 100}%` }} />
        </div>
        <div className="flex justify-end mt-2">
          {currentIndex < quiz.slides.length - 1 && (
            <Button size="sm" onClick={handleNext} disabled={currentSlide?.type !== 'welcome' && currentSlide?.type !== 'text' && (answerStatus === 'none' || answerStatus === 'checking')}>
              Weiter <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
