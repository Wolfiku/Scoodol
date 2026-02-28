'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ChevronRight, ChevronLeft, Sparkles, CheckCircle2, XCircle, User, Shield, Frown, Meh, Smile } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { verifyQuizAnswer, checkLongAnswer } from '@/app/actions';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

/**
 * Öffentliche Ansicht eines Quizzes.
 * Ermöglicht die Teilnahme am Quiz ohne Login. Ergebnisse werden dem Ersteller übermittelt.
 */
export default function PublicQuizPage() {
  const params = useParams();
  const { userId, quizId } = params;
  const firestore = useFirestore();
  const { toast } = useToast();
  const { aiLanguage } = useTheme();
  const router = useRouter();

  const quizRef = useMemoFirebase(() => 
    userId && quizId ? doc(firestore, `users/${userId}/quizzes`, quizId as string) : null
  , [firestore, userId, quizId]);

  const { data: quiz, isLoading } = useDoc(quizRef);

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

  const slides = quiz?.slides || [];
  const currentSlide = slides[currentIndex];

  useEffect(() => {
    if (quiz) {
        setTotalQuestions(slides.filter((s: any) => s.type !== 'welcome' && s.type !== 'text' && s.type !== 'conclusion').length);
    }
  }, [quiz]);

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

  const checkShortAnswer = async () => {
    if (!userAnswer.trim()) return;
    setAnswerStatus('checking');
    const { answer, checkMode, question } = currentSlide.content;
    
    if (userAnswer.trim().toLowerCase() === answer.trim().toLowerCase()) {
      setCorrectCount(prev => prev + 1);
      setAnswerStatus('correct');
      setAllAnswers(prev => ({ ...prev, [currentSlide.id]: true }));
      return;
    }

    if (checkMode === 'ai') {
      const result = await verifyQuizAnswer(question, answer, userAnswer, aiLanguage);
      if (result.isCorrect) setCorrectCount(prev => prev + 1);
      setAnswerStatus(result.isCorrect ? 'correct' : 'incorrect');
      setAllAnswers(prev => ({ ...prev, [currentSlide.id]: result.isCorrect }));
    } else {
      setAnswerStatus('incorrect');
      setAllAnswers(prev => ({ ...prev, [currentSlide.id]: false }));
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
    setAllAnswers(prev => ({ ...prev, [currentSlide.id]: { score: result.score, text: userAnswer } }));
  }

  const handleMcSelect = (optionId: string) => {
    if (answerStatus !== 'none') return;
    setSelectedMcOption(optionId);
    const option = currentSlide.content.options.find((o: any) => o.id === optionId);
    if (option.isCorrect) setCorrectCount(prev => prev + 1);
    setAnswerStatus(option.isCorrect ? 'correct' : 'incorrect');
    setAllAnswers(prev => ({ ...prev, [currentSlide.id]: optionId }));
  }

  const finishQuiz = async (rating: 'sad' | 'neutral' | 'happy') => {
      setFeedbackValue(rating);
      if (!userId || !quizId) return;
      const responsesRef = collection(firestore, `users/${userId}/quizzes/${quizId}/responses`);
      await addDoc(responsesRef, {
          userName: userName || 'Anonym',
          answers: allAnswers,
          percentage: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
          rating,
          completedAt: serverTimestamp()
      });
      toast({ title: "Abgeschlossen!", description: "Danke für deine Teilnahme." });
  }

  if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin" /></div>;
  if (!quiz || !quiz.isPublished) return <div className="p-8 text-center bg-secondary/10 min-h-screen flex items-center justify-center flex-col gap-4">
    <p className="text-xl font-bold">Dieses Quiz ist nicht verfügbar.</p>
    <Button variant="outline" onClick={() => router.push('/')}>Zur App</Button>
  </div>;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="p-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10 flex justify-between items-center">
        <div className="flex flex-col">
            <h1 className="text-sm font-bold truncate max-w-[200px]">{quiz.title}</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Quiz von {quiz.authorName || quiz.creator}</p>
        </div>
        <span className="text-xs font-mono font-bold bg-secondary px-2 py-1 rounded">{currentIndex + 1} / {slides.length}</span>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center">
        {currentSlide?.type === 'welcome' ? (
            <div className="text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-300">
                <h1 className="text-4xl font-extrabold tracking-tight">{quiz.title}</h1>
                <p className="text-muted-foreground text-lg">{currentSlide.content.subtitle}</p>
                {currentSlide.content.askName && (<div className="space-y-2 text-left"><Label className="font-bold">Dein Name</Label><Input placeholder="Wie heißt du?" value={userName} onChange={(e) => setUserName(e.target.value)} className="h-12 text-lg" /></div>)}
                <Button className="w-full h-14 text-lg font-bold" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>Quiz starten</Button>
            </div>
        ) : currentSlide?.type === 'multiple-choice' ? (
            <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-bold">{currentSlide.content.question}</h2>
                <div className="grid gap-3">{(currentSlide.content.options || []).map((opt: any) => { 
                    const isSelected = selectedMcOption === opt.id; 
                    const isCorrect = opt.isCorrect; 
                    let btnClass = "justify-start h-auto py-4 px-6 text-left border-2 transition-all"; 
                    if (answerStatus !== 'none') { 
                        if (isCorrect) btnClass += " bg-green-600 border-green-700 text-white"; 
                        else if (isSelected && !isCorrect) btnClass += " bg-red-600 border-red-700 text-white"; 
                    } 
                    return (<Button key={opt.id} variant="outline" disabled={answerStatus !== 'none'} onClick={() => handleMcSelect(opt.id)} className={btnClass}>{opt.text}</Button>); 
                })}</div>
            </div>
        ) : currentSlide?.type === 'short-answer' ? (
            <div className="w-full max-w-xl space-y-8 text-center animate-in slide-in-from-right-4 duration-300"><h2 className="text-2xl font-bold">{currentSlide.content.question}</h2><div className="relative"><Input placeholder="Antwort..." value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-xl py-8 px-6 text-center shadow-sm" />{answerStatus === 'checking' && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary" />}</div>{answerStatus === 'none' && <Button size="lg" className="w-full h-14" onClick={checkShortAnswer} disabled={!userAnswer.trim()}>Prüfen</Button>}{answerStatus === 'correct' && <div className="p-4 bg-green-100 text-green-700 rounded-xl font-bold animate-in zoom-in-95">Richtig!</div>}{answerStatus === 'incorrect' && <div className="p-4 bg-red-100 text-red-700 rounded-xl font-bold animate-in zoom-in-95">Falsch. Lösung: {currentSlide.content.answer}</div>}</div>
        ) : currentSlide?.type === 'long-answer' ? (
            <div className="w-full max-w-2xl space-y-8 animate-in slide-in-from-right-4 duration-300"><h2 className="text-2xl font-bold">{currentSlide.content.question}</h2><div className="relative"><Textarea placeholder="Schreibe hier..." value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={answerStatus !== 'none' && answerStatus !== 'checking'} className="text-lg p-6 min-h-[180px] shadow-sm" />{answerStatus === 'checking' && <div className="absolute inset-0 bg-background/50 flex flex-col items-center justify-center rounded-md z-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /><p className="mt-2 font-bold">KI prüft...</p></div>}</div>{answerStatus === 'none' && <Button size="lg" className="w-full h-14 text-lg font-bold" onClick={checkLongAnswerAction} disabled={!userAnswer.trim()}>KI-Prüfung</Button>}{aiFeedback && <div className="p-6 rounded-2xl bg-secondary/50 mt-4 border border-primary/20 animate-in slide-in-from-top-2 duration-300"><p className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4" /> KI-Feedback ({aiScore}/10)</p><p className="text-base leading-relaxed">{aiFeedback}</p></div>}</div>
        ) : currentSlide?.type === 'text' ? (
            <div className="w-full max-w-2xl space-y-6 animate-in slide-in-from-right-4 duration-300"><h2 className="text-3xl font-black border-b pb-4 tracking-tight">{currentSlide.content.title}</h2><div className="text-lg leading-relaxed whitespace-pre-wrap text-muted-foreground">{currentSlide.content.text}</div></div>
        ) : currentSlide?.type === 'conclusion' ? (
            <div className="text-center space-y-10 w-full max-w-md animate-in zoom-in-95 duration-500"><div className="space-y-4"><h1 className="text-5xl font-black tracking-tighter">Fertig!</h1><p className="text-xl text-muted-foreground font-medium">Vielen Dank für deine Teilnahme.</p></div>{currentSlide.content.showScore && (<div className="p-8 bg-primary/5 rounded-3xl border-2 border-primary/10 space-y-2"><p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Dein Ergebnis</p><p className="text-7xl font-black text-primary">{totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%</p><p className="text-sm text-muted-foreground font-bold">{correctCount} von {totalQuestions} richtig</p></div>)}{currentSlide.content.collectFeedback && !feedbackValue && (<div className="space-y-6"><p className="font-bold text-lg">Wie fandest du das Quiz?</p><div className="flex justify-center gap-8"><button onClick={() => finishQuiz('sad')} className="text-muted-foreground hover:text-red-500 transition-all hover:scale-110"><Frown className="w-16 h-16" /></button><button onClick={() => finishQuiz('neutral')} className="text-muted-foreground hover:text-amber-500 transition-all hover:scale-110"><Meh className="w-16 h-16" /></button><button onClick={() => finishQuiz('happy')} className="text-muted-foreground hover:text-green-500 transition-all hover:scale-110"><Smile className="w-16 h-16" /></button></div></div>)}{feedbackValue && <div className="p-4 bg-green-50 text-green-700 rounded-xl font-bold animate-in zoom-in">Feedback gesendet! ❤️</div>}<Button className="w-full h-14 text-lg font-bold" onClick={() => router.push('/')}>Zurück zur App</Button></div>
        ) : (<div className="text-center">Inhalt wird geladen...</div>)}
      </main>

      <footer className="p-4 border-t bg-background/80 backdrop-blur">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
            <Button variant="ghost" size="sm" onClick={handleBack} disabled={currentIndex === 0} className="font-bold"><ChevronLeft className="mr-2 h-4 w-4" /> Zurück</Button>
            <div className="h-1.5 w-32 bg-secondary rounded-full overflow-hidden flex-1 mx-8 max-w-[200px]"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentIndex + 1) / slides.length) * 100}%` }} /></div>
            <Button size="sm" onClick={handleNext} disabled={currentIndex === slides.length - 1 || (currentSlide?.type !== 'welcome' && currentSlide?.type !== 'text' && currentSlide?.type !== 'conclusion' && answerStatus === 'none')} className="font-bold">Weiter <ChevronRight className="ml-2 h-4 w-4" /></Button>
        </div>
      </footer>
    </div>
  );
}
