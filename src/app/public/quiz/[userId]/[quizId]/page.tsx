
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Check, User, Info, Sparkles, ChevronRight, X, AlertCircle, FileText, Frown, Meh, Smile, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  ownerId: string;
  isPublished?: boolean;
};

export default function PublicQuizPage() {
  const router = useRouter();
  const params = useParams();
  const { userId, quizId } = params;
  const { toast } = useToast();
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
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  
  // Track all individual responses for saving
  const [recordedResponses, setRecordedResponses] = useState<any[]>([]);

  const quizDocRef = useMemoFirebase(() => 
    typeof userId === 'string' && typeof quizId === 'string'
      ? doc(firestore, `users/${userId}/quizzes`, quizId)
      : null
  , [firestore, userId, quizId]);

  const { data: quiz, isLoading: isLoadingQuiz } = useDoc<Quiz>(quizDocRef);

  const currentSlide = quiz?.slides[currentIndex];
  const totalQuestions = useMemo(() => quiz?.slides.filter(s => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length || 0, [quiz]);
  const usesAI = useMemo(() => quiz?.slides.some(s => s.type === 'long-answer' || (s.type === 'short-answer' && s.content.checkMode === 'ai')), [quiz]);

  const handleNext = () => {
    // Record current response if it's a question
    if (currentSlide && !['welcome', 'text', 'conclusion'].includes(currentSlide.type)) {
        const responseEntry = {
            slideId: currentSlide.id,
            type: currentSlide.type,
            question: currentSlide.content.question || 'N/A',
            userAnswer: currentSlide.type === 'multiple-choice' 
                ? currentSlide.content.options.find((o: any) => o.id === selectedMcOption)?.text 
                : currentSlide.type === 'vocabulary' 
                    ? vocabAnswers 
                    : userAnswer,
            isCorrect: answerStatus === 'correct',
            aiScore: aiScore,
            aiFeedback: aiFeedback
        };
        setRecordedResponses(prev => [...prev, responseEntry]);
    }

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

  const saveResponse = async (finalFeedback: string | null) => {
    if (!firestore || !quiz || hasSaved) return;
    setIsSaving(true);

    try {
        const responsesColRef = collection(firestore, `users/${userId}/quizzes/${quizId}/responses`);
        const finalPercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

        await addDoc(responsesColRef, {
            participantName: userName || 'Anonym',
            answers: recordedResponses,
            score: finalPercentage,
            correctCount,
            totalQuestions,
            rating: finalFeedback,
            completedAt: serverTimestamp(),
        });

        setHasSaved(true);
    } catch (error) {
        console.error("Error saving quiz response:", error);
        toast({ variant: 'destructive', title: 'Fehler beim Speichern', description: 'Deine Ergebnisse konnten leider nicht gespeichert werden.' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleFeedback = (val: 'sad' | 'neutral' | 'happy') => {
      setFeedbackValue(val);
      saveResponse(val);
  };

  const normalizeText = (text: string) => {
    return text.trim().toLowerCase().replace(/ss/g, 'ß').replace(/\s+/g, ' ');
  };

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
  };

  const checkLongAnswerAction = async () => {
    if (!userAnswer.trim() || !currentSlide) return;
    setAnswerStatus('checking');

    const { question, referenceAnswer, criteria } = currentSlide.content;
    const result = await checkLongAnswer(question, referenceAnswer, criteria, userAnswer, aiLanguage);
    
    setAiScore(result.score);
    setAiFeedback(result.feedback);
    setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
  };

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
  };

  const handleMcSelect = (optionId: string) => {
    if (answerStatus !== 'none' || !currentSlide) return;
    setSelectedMcOption(optionId);
    
    const option = currentSlide.content.options.find((o: any) => o.id === optionId);
    setAnswerStatus(option.isCorrect ? 'correct' : 'incorrect');
  };

  if (isLoadingQuiz) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  if (!quiz || !quiz.isPublished) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Quiz nicht verfügbar</h1>
        <p className="text-muted-foreground">Dieses Quiz existiert nicht oder wurde vom Ersteller offline genommen.</p>
        <Button variant="outline" className="mt-6" onClick={() => router.push('/')}>Zur Startseite</Button>
      </div>
    );
  }

  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return (
    <div className="flex flex-col h-screen bg-background">
      <main className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center">
        {currentSlide?.type === 'welcome' ? (
          <div className="text-center space-y-8 max-w-md w-full">
            <div className="space-y-2">
              <h1 className="text-4xl font-extrabold tracking-tight">{quiz.title}</h1>
              <p className="text-muted-foreground">von {quiz.creator}</p>
            </div>
            
            {currentSlide.content.subtitle && (
              <Card className="bg-secondary/30 border-none">
                <CardContent className="p-4">
                  <p className="text-sm italic text-muted-foreground leading-relaxed">
                    "{currentSlide.content.subtitle}"
                  </p>
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
        ) : currentSlide?.type === 'multiple-choice' ? (
          <div className="w-full max-w-2xl space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">{currentSlide.content.question}</h2>
            <div className="grid gap-3">
              {(currentSlide.content.options || []).map((opt: any, i: number) => {
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
          <div className="w-full max-w-xl space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">{currentSlide.content.question}</h2>
            <div className="space-y-4">
              <Input 
                type={currentSlide.content.answerType === 'year' ? 'number' : 'text'}
                placeholder="Deine Antwort..." 
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                disabled={answerStatus !== 'none' && answerStatus !== 'checking'}
                className={cn("text-xl py-8 px-6", answerStatus === 'correct' && "border-green-500 bg-green-50", answerStatus === 'incorrect' && "border-red-500 bg-red-50")}
                onKeyDown={(e) => e.key === 'Enter' && answerStatus === 'none' && checkShortAnswer()}
              />
              {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Antwort prüfen</Button>}
              {answerStatus === 'incorrect' && (
                <div className="p-4 bg-red-100 text-red-800 rounded-lg"><p className="text-sm">Richtig wäre: <span className="font-mono">{currentSlide.content.answer}</span></p></div>
              )}
            </div>
          </div>
        ) : currentSlide?.type === 'long-answer' ? (
          <div className="w-full max-w-2xl space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">{currentSlide.content.question}</h2>
            <div className="space-y-4">
              <Textarea 
                placeholder="Deine ausführliche Antwort..." 
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                disabled={answerStatus !== 'none' && answerStatus !== 'checking'}
                className={cn("text-lg p-6 min-h-[180px]", answerStatus === 'correct' && "border-green-500 bg-green-50", answerStatus === 'incorrect' && "border-amber-500 bg-amber-50")}
              />
              {answerStatus === 'none' && <Button className="w-full" size="lg" onClick={checkLongAnswerAction} disabled={!userAnswer.trim() || userAnswer.length < 5}><Sparkles className="mr-2 h-4 w-4"/> Von KI prüfen lassen</Button>}
              {answerStatus === 'checking' && <div className="flex items-center gap-2 text-primary font-medium"><Loader2 className="animate-spin h-4 w-4"/> KI bewertet...</div>}
              {aiFeedback && <div className="p-4 bg-secondary/50 rounded-lg text-sm">{aiFeedback}</div>}
            </div>
          </div>
        ) : currentSlide?.type === 'conclusion' ? (
          <div className="text-center space-y-8 max-w-xl w-full">
            <div className="space-y-4">
              <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary"><Check className="h-10 w-10" /></div>
              <h1 className="text-4xl font-extrabold tracking-tight">Fertig!</h1>
              {userName && <p className="text-xl text-muted-foreground">Gut gemacht, {userName}!</p>}
            </div>
            <div className="grid gap-6">
              {currentSlide.content.showScore && (
                <Card className="bg-secondary/20 border-none"><CardContent className="p-6">
                  <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">Dein Ergebnis</p>
                  <span className="text-6xl font-black text-primary">{percentage}%</span>
                </CardContent></Card>
              )}
              {currentSlide.content.collectFeedback && (
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-bold">Wie hat dir das Quiz gefallen?</Label>
                  <div className="flex justify-center gap-8">
                    {[
                      { val: 'sad', icon: Frown, color: 'text-red-500' },
                      { val: 'neutral', icon: Meh, color: 'text-amber-500' },
                      { val: 'happy', icon: Smile, color: 'text-green-500' }
                    ].map(f => (
                      <button 
                        key={f.val}
                        onClick={() => handleFeedback(f.val as any)}
                        disabled={isSaving || hasSaved}
                        className={cn("transition-all transform hover:scale-110", feedbackValue === f.val ? `${f.color} scale-125` : "text-muted-foreground")}
                      ><f.icon className="h-12 w-12" /></button>
                    ))}
                  </div>
                  {hasSaved && <p className="text-sm font-bold text-primary">Ergebnisse wurden gespeichert!</p>}
                </div>
              )}
            </div>
            {!currentSlide.content.collectFeedback && !hasSaved && (
                <Button className="w-full" onClick={() => saveResponse(null)} disabled={isSaving}>Quiz beenden & Speichern</Button>
            )}
          </div>
        ) : (
            <div className="w-full max-w-2xl space-y-8">
                {currentSlide?.content.title && <h2 className="text-3xl font-bold">{currentSlide.content.title}</h2>}
                <p className="text-lg text-muted-foreground whitespace-pre-wrap">{currentSlide?.content.text}</p>
            </div>
        )}
      </main>

      <footer className="p-4 border-t bg-secondary/10 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <span className="text-xs font-mono font-bold">{currentIndex + 1} / {quiz.slides.length}</span>
            <div className="h-1 w-24 bg-secondary rounded-full overflow-hidden hidden sm:block">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentIndex + 1) / quiz.slides.length) * 100}%` }} />
            </div>
        </div>
        <div className="flex items-center gap-2">
          {currentIndex < quiz.slides.length - 1 && (
            <Button onClick={handleNext} disabled={currentSlide?.type !== 'welcome' && currentSlide?.type !== 'text' && (answerStatus === 'none' || answerStatus === 'checking')}>
              Weiter <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
