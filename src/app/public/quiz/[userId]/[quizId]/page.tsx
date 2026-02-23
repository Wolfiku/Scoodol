
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Check, User, Sparkles, ChevronRight, X, AlertCircle, FileText, Frown, Meh, Smile, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  isPublished?: boolean;
};

export default function PublicQuizPage() {
  const params = useParams();
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

  const quizDocRef = useMemoFirebase(() => 
    userId && quizId ? doc(firestore, `users/${userId}/quizzes/${quizId}`) : null
  , [firestore, userId, quizId]);

  const { data: quiz, isLoading: isLoadingQuiz } = useDoc<Quiz>(quizDocRef);

  useEffect(() => {
    if (quiz) {
      const count = quiz.slides.filter(s => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length;
      setTotalQuestions(count);
    }
  }, [quiz]);

  if (isLoadingQuiz) {
    return <div className="flex items-center justify-center h-screen bg-background"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  if (!quiz || !quiz.isPublished) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Quiz nicht verfügbar</h1>
        <p className="text-muted-foreground">Dieses Quiz existiert nicht oder wurde offline genommen.</p>
      </div>
    );
  }

  const currentSlide = quiz.slides[currentIndex];

  const handleNext = () => {
    if (currentIndex > 0 && answerStatus === 'correct') {
      setCorrectCount(prev => prev + 1);
    }

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

  const normalizeText = (text: string) => text.trim().toLowerCase().replace(/ss/g, 'ß').replace(/\s+/g, ' ');

  const checkShortAnswer = async () => {
    if (!userAnswer.trim()) return;
    setAnswerStatus('checking');
    const { answer, answerType, checkMode, question } = currentSlide.content;
    let isCorrect = false;
    if (answerType === 'year') {
      isCorrect = userAnswer.trim() === answer.trim();
    } else {
      if (checkMode === 'strict') isCorrect = userAnswer.trim() === answer.trim();
      else if (checkMode === 'helpfull') isCorrect = normalizeText(userAnswer) === normalizeText(answer);
      else if (checkMode === 'ai') {
        if (normalizeText(userAnswer) === normalizeText(answer)) isCorrect = true;
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
      let isCorrect = checkMode === 'strict' ? userVal.trim() === pair.german.trim() : normalizeText(userVal) === normalizeText(pair.german);
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

  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return (
    <div className="flex flex-col h-screen bg-background">
      <main className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center">
        {currentSlide.type === 'welcome' && (
          <div className="text-center space-y-8 max-w-md w-full">
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
        )}

        {currentSlide.type === 'multiple-choice' && (
          <div className="w-full max-w-2xl space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold">{currentSlide.content.question}</h2>
            <div className="grid gap-3">
              {currentSlide.content.options.map((opt: any, i: number) => {
                const isSelected = selectedMcOption === opt.id;
                let variant: "outline" | "default" | "destructive" = "outline";
                if (answerStatus !== 'none') {
                  if (opt.isCorrect) variant = "default";
                  else if (isSelected) variant = "destructive";
                }
                return (
                  <Button key={opt.id} variant={variant} disabled={answerStatus !== 'none'} onClick={() => handleMcSelect(opt.id)} className={cn("justify-start h-auto py-4 px-6 text-left border-2", variant === 'default' && "bg-green-600 border-green-700", variant === 'destructive' && "bg-red-600 border-red-700")}>
                    <span className="h-8 w-8 rounded-full border-2 flex items-center justify-center mr-4 shrink-0 text-xs font-bold">{String.fromCharCode(65 + i)}</span>
                    <span className="flex-1">{opt.text}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {currentSlide.type === 'short-answer' && (
          <div className="w-full max-w-xl space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold">{currentSlide.content.question}</h2>
            <div className="space-y-4">
              <Input placeholder="Deine Antwort..." value={userAnswer} onChange={e => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-xl py-8 px-6" />
              {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Antwort prüfen</Button>}
              {answerStatus === 'correct' && <div className="text-green-600 font-bold text-center">Richtig!</div>}
              {answerStatus === 'incorrect' && <div className="bg-red-100 text-red-800 p-4 rounded-lg">Falsch. Richtig wäre: {currentSlide.content.answer}</div>}
            </div>
          </div>
        )}

        {currentSlide.type === 'long-answer' && (
          <div className="w-full max-w-2xl space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold">{currentSlide.content.question}</h2>
            <div className="space-y-4">
              <Textarea placeholder="Schreibe hier..." value={userAnswer} onChange={e => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-lg p-6 min-h-[180px]" />
              {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkLongAnswerAction} disabled={!userAnswer.trim()}>{answerStatus === 'checking' ? <Loader2 className="animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Von KI prüfen lassen</Button>}
              {aiFeedback && <div className={cn("p-4 rounded-lg", answerStatus === 'correct' ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")}><p className="font-bold">{answerStatus === 'correct' ? 'Gut gemacht!' : 'Fast geschafft'}</p><p className="text-sm">{aiFeedback}</p></div>}
            </div>
          </div>
        )}

        {currentSlide.type === 'vocabulary' && (
          <div className="w-full max-w-2xl space-y-8">
            <h2 className="text-2xl font-bold">Übersetze</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {currentSlide.content.pairs.map((pair: any) => (
                <div key={pair.id} className="grid grid-cols-2 gap-4 p-3 bg-secondary/30 rounded-lg">
                  <span className="font-semibold text-lg">{pair.foreign}</span>
                  <Input placeholder="..." value={vocabAnswers[pair.id] || ''} onChange={e => setVocabAnswers(prev => ({...prev, [pair.id]: e.target.value}))} disabled={answerStatus !== 'none'} />
                </div>
              ))}
            </div>
            {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkVocabulary}>Prüfen</Button>}
          </div>
        )}

        {currentSlide.type === 'text' && (
          <div className="w-full max-w-2xl space-y-8">
            <h2 className="text-3xl font-extrabold text-center">{currentSlide.content.title}</h2>
            <Card className="bg-secondary/10 border-none"><CardContent className="p-6 md:p-10"><p className="text-lg text-muted-foreground whitespace-pre-wrap">{currentSlide.content.text}</p></CardContent></Card>
          </div>
        )}

        {currentSlide.type === 'conclusion' && (
          <div className="text-center space-y-10 max-w-xl w-full">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary"><Check className="h-10 w-10" /></div>
            <h1 className="text-4xl font-extrabold">Danke fürs Teilnehmen!</h1>
            {currentSlide.content.showScore && <Card className="bg-secondary/20 border-none"><CardContent className="p-6"><p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Dein Ergebnis</p><span className="text-6xl font-black text-primary">{percentage}%</span></CardContent></Card>}
            {currentSlide.content.collectFeedback && (
              <div className="flex justify-center gap-8 pt-4">
                <button onClick={() => setFeedbackValue('sad')} className={cn(feedbackValue === 'sad' ? "text-red-500 scale-125" : "text-muted-foreground")}><Frown className="h-12 w-12" /></button>
                <button onClick={() => setFeedbackValue('neutral')} className={cn(feedbackValue === 'neutral' ? "text-amber-500 scale-125" : "text-muted-foreground")}><Meh className="h-12 w-12" /></button>
                <button onClick={() => setFeedbackValue('happy')} className={cn(feedbackValue === 'happy' ? "text-green-500 scale-125" : "text-muted-foreground")}><Smile className="h-12 w-12" /></button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="p-6 border-t bg-background sticky bottom-0 z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-lg font-bold">{quiz.title}</span>
            <span className="text-xs text-muted-foreground">von {quiz.creator}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono">{currentIndex + 1} / {quiz.slides.length}</span>
            <Button onClick={handleNext} disabled={currentIndex === quiz.slides.length - 1 || (currentSlide.type !== 'welcome' && currentSlide.type !== 'text' && currentSlide.type !== 'conclusion' && answerStatus === 'none')}>
              {currentIndex === quiz.slides.length - 1 ? 'Fertig' : 'Weiter'} <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentIndex + 1) / quiz.slides.length) * 100}%` }} />
        </div>
      </footer>
    </div>
  );
}
