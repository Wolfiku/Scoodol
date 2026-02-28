
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, ChevronRight, ChevronLeft, CheckCircle2, XCircle, Star, Smile, Meh, Frown } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Slide = {
  id: string;
  type: string;
  content: any;
};

type Quiz = {
  title: string;
  creator: string;
  authorName?: string;
  slides: Slide[];
  updatedAt: any;
};

export default function PublicQuizPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const quizId = params?.quizId as string;
  const firestore = useFirestore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userName, setUserName] = useState('');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [userRating, setUserRating] = useState<'sad' | 'neutral' | 'happy' | null>(null);

  const quizRef = useMemoFirebase(() => 
    userId && quizId ? doc(firestore, `users/${userId}/quizzes`, quizId) : null
  , [firestore, userId, quizId]);

  const { data: quiz, isLoading } = useDoc<Quiz>(quizRef);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <h1 className="text-xl font-bold">Quiz nicht gefunden</h1>
        <p className="text-muted-foreground">Dieses Quiz existiert nicht oder ist nicht mehr öffentlich.</p>
      </div>
    );
  }

  const slides = quiz.slides || [];
  const currentSlide = slides[currentIndex];
  const formattedDate = quiz.updatedAt 
    ? format(new Date(quiz.updatedAt.seconds * 1000), 'dd.MM.yyyy', { locale: de }) 
    : '';

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const finishQuiz = async () => {
    setIsFinished(true);
    if (firestore && userId && quizId) {
        const responsesRef = collection(firestore, `users/${userId}/quizzes/${quizId}/responses`);
        await addDoc(responsesRef, {
            userName: userName || 'Anonym',
            answers,
            rating: userRating,
            completedAt: serverTimestamp()
        });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur-md z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-2 text-[13px] text-muted-foreground overflow-hidden whitespace-nowrap">
          <span className="font-bold text-foreground truncate">{quiz.title}</span>
          <span className="shrink-0">•</span>
          <span className="truncate">{quiz.authorName || quiz.creator}</span>
          <span className="shrink-0">•</span>
          <span className="shrink-0">{formattedDate}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {!isFinished ? (
          <div className="w-full max-w-2xl space-y-8 animate-in fade-in duration-500">
            {currentSlide.type === 'welcome' && (
              <div className="text-center space-y-6">
                <h1 className="text-4xl font-black">{quiz.title}</h1>
                <p className="text-muted-foreground italic">"{currentSlide.content.subtitle}"</p>
                {currentSlide.content.askName && (
                  <div className="max-w-xs mx-auto space-y-2 text-left">
                    <Label>Dein Name</Label>
                    <Input placeholder="Eingeben..." value={userName} onChange={e => setUserName(e.target.value)} />
                  </div>
                )}
                <Button size="lg" className="w-full max-w-xs" onClick={handleNext} disabled={currentSlide.content.askName && !userName.trim()}>Quiz starten</Button>
              </div>
            )}

            {currentSlide.type === 'text' && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold border-b pb-4">{currentSlide.content.title}</h2>
                <div className="text-lg leading-relaxed whitespace-pre-wrap">{currentSlide.content.text}</div>
                <Button className="w-full" size="lg" onClick={handleNext}>Verstanden</Button>
              </div>
            )}

            {/* Andere Folientypen hier stark verkürzt für MVP */}
            {(currentSlide.type === 'multiple-choice' || currentSlide.type === 'short-answer' || currentSlide.type === 'long-answer' || currentSlide.type === 'vocabulary') && (
                <div className="text-center space-y-6">
                    <Badge variant="outline">Aufgabe {currentIndex}</Badge>
                    <h2 className="text-2xl font-bold">{currentSlide.content.question || 'Vokabel-Test'}</h2>
                    <p className="text-muted-foreground">Antworten werden am Ende gesichert.</p>
                    <Button className="w-full" onClick={handleNext}>Nächste Folie</Button>
                </div>
            )}

            {currentSlide.type === 'conclusion' && (
              <div className="text-center space-y-8">
                <h1 className="text-4xl font-black">Fertig!</h1>
                {currentSlide.content.collectFeedback && (
                  <div className="space-y-4">
                    <p className="font-bold">Wie war's?</p>
                    <div className="flex justify-center gap-6">
                      <button onClick={() => setUserRating('sad')} className={cn("p-2 rounded-full transition-all", userRating === 'sad' && "bg-red-100 text-red-600 scale-110")}><Frown className="w-12 h-12" /></button>
                      <button onClick={() => setUserRating('neutral')} className={cn("p-2 rounded-full transition-all", userRating === 'neutral' && "bg-amber-100 text-amber-600 scale-110")}><Meh className="w-12 h-12" /></button>
                      <button onClick={() => setUserRating('happy')} className={cn("p-2 rounded-full transition-all", userRating === 'happy' && "bg-green-100 text-green-600 scale-110")}><Smile className="w-12 h-12" /></button>
                    </div>
                  </div>
                )}
                <Button size="lg" className="w-full" onClick={handleNext}>Quiz abschließen</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-4 animate-in zoom-in duration-500">
            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
            <h1 className="text-3xl font-black">Vielen Dank!</h1>
            <p className="text-muted-foreground">Deine Antworten wurden an {quiz.creator} übermittelt.</p>
          </div>
        )}
      </main>

      {!isFinished && (
        <footer className="p-4 border-t bg-background">
          <div className="max-w-2xl mx-auto flex justify-between items-center">
            <Button variant="ghost" size="sm" onClick={handleBack} disabled={currentIndex === 0}><ChevronLeft className="mr-2 h-4 w-4" /> Zurück</Button>
            <span className="text-xs font-mono text-muted-foreground">{currentIndex + 1} / {slides.length}</span>
            <Button variant="ghost" size="sm" onClick={handleNext}>{currentIndex === slides.length - 1 ? 'Beenden' : 'Weiter'} <ChevronRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </footer>
      )}
    </div>
  );
}
