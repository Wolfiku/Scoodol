
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import timetableData from '@/app/data/timetable.json';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { X, Play, Pause, Coffee, BrainCircuit, BookCopy, ChevronsRight } from 'lucide-react';

export type FocusTask = {
  id: number;
  title: string;
};

type Props = {
  tasks: FocusTask[];
  onExit: (completedTaskIds?: number[]) => void;
};

// --- Constants ---
const TOTAL_WORK_SESSION_MINUTES = 45;
const SMART_BREAK_THRESHOLD_MINUTES = 35;
const BREAK_DURATION_MINUTES = 15;
const TASK_TOO_LONG_THRESHOLD_MINUTES = 150;
const TICK_INTERVAL_MS = 1000;

// --- Helper Functions ---
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};


// --- Component ---
export default function FocusMode({ tasks, onExit }: Props) {
  const [currentScreen, setCurrentScreen] = useState<'select' | 'work' | 'break' | 'repetition_select' | 'repetition_work'>('select');
  const [currentTask, setCurrentTask] = useState<FocusTask | null>(null);
  
  const [totalWorkTime, setTotalWorkTime] = useState(0); // in seconds
  const [currentTaskTime, setCurrentTaskTime] = useState(0); // in seconds
  const [breakTimeLeft, setBreakTimeLeft] = useState(BREAK_DURATION_MINUTES * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  const [remainingTasks, setRemainingTasks] = useState<FocusTask[]>(tasks);
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  
  const [showTooLongWarning, setShowTooLongWarning] = useState(false);

  // --- Repetition State ---
  const [repetitionSubject, setRepetitionSubject] = useState<string | null>(null);
  const [repetitionDuration, setRepetitionDuration] = useState(45); // in minutes
  const [repetitionTimeLeft, setRepetitionTimeLeft] = useState(0); // in seconds


  // --- Derived Data ---
  const repetitionSubjects = useMemo(() => {
    if (typeof window === 'undefined') {
        return { main: [], other: [] };
    }
    const savedTimetable = localStorage.getItem("timetable");
    const currentTimetable = savedTimetable ? JSON.parse(savedTimetable) : timetableData;

    const allEntries = Object.values(currentTimetable).flat() as {fach: string, hauptfach?: boolean}[];
    const mainSubjects = new Set(allEntries.filter(e => e.hauptfach).map(e => e.fach));
    const otherSubjects = new Set(allEntries.filter(e => e.fach && e.fach !== 'Pause').map(e => e.fach));
    
    return {
        main: Array.from(mainSubjects).sort(),
        other: Array.from(otherSubjects).filter(s => !mainSubjects.has(s)).sort(),
    }
  }, []);


  // --- Effects ---
  useEffect(() => {
    if (!isTimerRunning) return;

    const timer = setInterval(() => {
      if (currentScreen === 'work') {
        setTotalWorkTime(prev => prev + 1);
        setCurrentTaskTime(prev => prev + 1);
      } else if (currentScreen === 'break') {
        setBreakTimeLeft(prev => prev - 1);
      } else if (currentScreen === 'repetition_work') {
        setTotalWorkTime(prev => prev + 1);
        setRepetitionTimeLeft(prev => prev > 0 ? prev - 1 : 0);
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isTimerRunning, currentScreen]);

  useEffect(() => {
    // Check for "task too long" warning
    if (currentTaskTime >= TASK_TOO_LONG_THRESHOLD_MINUTES * 60) {
      if(!showTooLongWarning) {
        setIsTimerRunning(false);
        setShowTooLongWarning(true);
      }
    }
  }, [currentTaskTime, showTooLongWarning]);

  useEffect(() => {
    // Check if total work time triggers a break (for both work and repetition)
    if (totalWorkTime >= TOTAL_WORK_SESSION_MINUTES * 60) {
      startBreak();
    }
  }, [totalWorkTime]);

  useEffect(() => {
    // Check if break time is over
    if (breakTimeLeft <= 0) {
      endBreak();
    }
  }, [breakTimeLeft]);

  useEffect(() => {
    // Check if repetition time is over
    if (currentScreen === 'repetition_work' && repetitionTimeLeft <= 0) {
      handleFinishRepetition();
    }
  }, [repetitionTimeLeft, currentScreen]);


  // --- Handlers ---
  const handleSelectTask = (task: FocusTask) => {
    setCurrentTask(task);
    setCurrentScreen('work');
    setIsTimerRunning(true);
  };

  const handleFinishTask = () => {
    if (currentTask) {
        setCompletedTasks(prev => [...prev, currentTask.id]);
        setRemainingTasks(prev => prev.filter(t => t.id !== currentTask.id));
    }
    
    setIsTimerRunning(false);
    setCurrentTask(null);
    setCurrentTaskTime(0);

    const newRemainingCount = remainingTasks.length - 1;

    // Smart break logic
    if (totalWorkTime >= SMART_BREAK_THRESHOLD_MINUTES * 60) {
      startBreak();
    } else {
       if (newRemainingCount <= 0) {
           setCurrentScreen('repetition_select');
       } else {
           setCurrentScreen('select');
       }
    }
  };
  
  const startBreak = () => {
    setIsTimerRunning(false);
    setCurrentScreen('break');
    setBreakTimeLeft(BREAK_DURATION_MINUTES * 60);
    // After break starts, reset work timer and restart the main timer for the break
    setTimeout(() => {
        setTotalWorkTime(0);
        setIsTimerRunning(true);
    }, 100);
  };

  const endBreak = () => {
    setIsTimerRunning(false);
    if (remainingTasks.length === 0) {
        setCurrentScreen('repetition_select');
    } else {
        setCurrentScreen('select');
    }
  }

  const handleStartRepetition = () => {
    if (!repetitionSubject) return;
    setRepetitionTimeLeft(repetitionDuration * 60);
    setCurrentScreen('repetition_work');
    setIsTimerRunning(true);
  }

  const handleFinishRepetition = () => {
      setIsTimerRunning(false);
      setRepetitionSubject(null);
      setCurrentScreen('repetition_select');
  }


  // --- UI Rendering ---

  const renderSelectScreen = () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Aufgabe auswählen</CardTitle>
        <CardDescription>Wähle deine nächste Aufgabe aus der Liste.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {remainingTasks.map(task => (
          <Button 
              key={task.id} 
              variant="secondary" 
              size="lg" 
              className="justify-start h-auto py-3 text-left whitespace-normal" 
              onClick={() => handleSelectTask(task)}
          >
            {task.title}
          </Button>
        ))}
      </CardContent>
       <CardFooter className="flex justify-between">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive">Fokus beenden</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Bist du sicher?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Möchtest du den Fokus-Modus wirklich beenden? Erledigte Aufgaben bleiben gespeichert.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onExit(completedTasks)}>Beenden</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
      </CardFooter>
    </Card>
  );

  const renderWorkScreen = () => {
    const progressPercentage = (totalWorkTime / (TOTAL_WORK_SESSION_MINUTES * 60)) * 100;
    
    return (
      <Card className="flex flex-col w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{currentTask?.title}</CardTitle>
          <CardDescription>Konzentriere dich auf diese eine Aufgabe.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
            <div className="text-7xl font-bold font-mono text-primary">
                {formatTime(currentTaskTime)}
            </div>
            <div className="w-full max-w-sm">
                <p className="text-sm text-muted-foreground mb-1 text-left">Fortschritt zur nächsten Pause: {formatTime(totalWorkTime)} / {TOTAL_WORK_SESSION_MINUTES}:00</p>
                <Progress value={progressPercentage} />
            </div>

            <AlertDialog open={showTooLongWarning} onOpenChange={setShowTooLongWarning}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2"><BrainCircuit /> Das dauert aber lange...</AlertDialogTitle>
                    <AlertDialogDescription>
                       Du arbeitest schon über {TASK_TOO_LONG_THRESHOLD_MINUTES} Minuten an dieser Aufgabe. Das ist eine sehr lange Zeit! Vielleicht ist die Aufgabe zu schwer oder der Stoff zu umfangreich.
                       <br/><br/>
                       <strong>Vorschlag:</strong> Mach jetzt eine Pause und sprich eventuell mit deiner Lehrkraft darüber. Manchmal hilft eine neue Perspektive.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogAction onClick={() => {
                        setShowTooLongWarning(false);
                        setIsTimerRunning(true);
                    }}>Weiterarbeiten</AlertDialogAction>
                     <AlertDialogAction onClick={() => handleFinishTask()}>Aufgabe beenden</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </CardContent>
        <CardFooter className="grid grid-cols-2 gap-4">
            <Button variant={isTimerRunning ? "secondary" : "default"} onClick={() => setIsTimerRunning(!isTimerRunning)}>
                {isTimerRunning ? <Pause className="mr-2"/> : <Play className="mr-2"/>}
                {isTimerRunning ? 'Pausieren' : 'Fortsetzen'}
            </Button>
            <Button onClick={handleFinishTask}>Aufgabe fertig</Button>
        </CardFooter>
      </Card>
    );
  };
  
  const renderBreakScreen = () => (
      <Card className="bg-accent/10 border-accent w-full max-w-md">
         <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent-foreground"><Coffee/> Zeit für eine Pause!</CardTitle>
            <CardDescription className="text-accent-foreground/80">Streck dich, trink was oder schau aus dem Fenster. Du hast es dir verdient.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-4 text-center py-12">
             <div className="text-8xl font-bold font-mono text-accent-foreground">
                {formatTime(breakTimeLeft)}
            </div>
            <p className="text-accent-foreground/90">Die nächste Lerneinheit startet automatisch.</p>
        </CardContent>
         <CardFooter>
            <Button variant="ghost" className="text-accent-foreground hover:text-accent-foreground hover:bg-accent/30" onClick={endBreak}>Pause überspringen</Button>
        </CardFooter>
      </Card>
  );

  const renderRepetitionSelectScreen = () => (
    <Card className="w-full max-w-lg">
        <CardHeader>
            <CardTitle>Super! Alle Hausaufgaben erledigt.</CardTitle>
            <CardDescription>Möchtest du die Zeit nutzen, um ein Fach zu wiederholen?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-4">
                <Label>Wähle ein Fach</Label>
                <RadioGroup value={repetitionSubject || ""} onValueChange={setRepetitionSubject} className="flex flex-wrap gap-2">
                    {repetitionSubjects.main.length > 0 && <p className="w-full text-sm font-medium">Hauptfächer</p>}
                    {repetitionSubjects.main.map(subject => (
                        <Label key={subject} htmlFor={`subject-${subject}`} className={`flex items-center gap-2 border rounded-full px-4 py-2 cursor-pointer transition-colors ${repetitionSubject === subject ? 'bg-primary text-primary-foreground border-transparent' : 'hover:bg-accent/50'}`}>
                            <RadioGroupItem value={subject} id={`subject-${subject}`} className="sr-only"/>
                            {subject}
                        </Label>
                    ))}
                     {repetitionSubjects.other.length > 0 && <p className="w-full text-sm font-medium pt-2">Nebenfächer</p>}
                     {repetitionSubjects.other.map(subject => (
                        <Label key={subject} htmlFor={`subject-${subject}`} className={`flex items-center gap-2 border rounded-full px-4 py-2 cursor-pointer transition-colors ${repetitionSubject === subject ? 'bg-primary text-primary-foreground border-transparent' : 'hover:bg-accent/50'}`}>
                            <RadioGroupItem value={subject} id={`subject-${subject}`} className="sr-only"/>
                            {subject}
                        </Label>
                    ))}
                </RadioGroup>
            </div>
            <div className="space-y-3">
                 <Label htmlFor="duration">Dauer: {repetitionDuration} Minuten</Label>
                 <Slider 
                    id="duration"
                    min={15}
                    max={120}
                    step={5}
                    value={[repetitionDuration]}
                    onValueChange={(val) => setRepetitionDuration(val[0])}
                    disabled={!repetitionSubject}
                 />
            </div>

            <Button onClick={handleStartRepetition} disabled={!repetitionSubject} className="w-full">
                <ChevronsRight className="mr-2"/> Wiederholung starten
            </Button>
        </CardContent>
        <CardFooter>
             <Button variant="ghost" onClick={() => onExit(completedTasks)}>Fokus-Modus beenden</Button>
        </CardFooter>
    </Card>
  );

  const renderRepetitionWorkScreen = () => {
    const progressToBreak = (totalWorkTime / (TOTAL_WORK_SESSION_MINUTES * 60)) * 100;

    return (
        <Card className="flex flex-col w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><BookCopy/> Wiederholung: {repetitionSubject}</CardTitle>
          <CardDescription>Nutze die Zeit, um das Thema zu vertiefen.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
            <div className="text-7xl font-bold font-mono text-primary">
                {formatTime(repetitionTimeLeft)}
            </div>
            <div className="w-full max-w-sm">
                <p className="text-sm text-muted-foreground mb-1 text-left">Fortschritt zur nächsten Pause: {formatTime(totalWorkTime)} / {TOTAL_WORK_SESSION_MINUTES}:00</p>
                <Progress value={progressToBreak} />
            </div>
        </CardContent>
        <CardFooter className="grid grid-cols-2 gap-4">
            <Button variant={isTimerRunning ? "secondary" : "default"} onClick={() => setIsTimerRunning(!isTimerRunning)}>
                {isTimerRunning ? <Pause className="mr-2"/> : <Play className="mr-2"/>}
                {isTimerRunning ? 'Pausieren' : 'Fortsetzen'}
            </Button>
            <Button onClick={handleFinishRepetition}>Wiederholung beenden</Button>
        </CardFooter>
      </Card>
    )
  }

  const getScreenToRender = () => {
      // If tasks are left, show select or work screen.
      if (remainingTasks.length > 0) {
          if (currentScreen === 'select') return renderSelectScreen();
          if (currentScreen === 'work') return renderWorkScreen();
      } else { // No tasks left, go to repetition flow.
          if (currentScreen === 'repetition_select') return renderRepetitionSelectScreen();
          if (currentScreen === 'repetition_work') return renderRepetitionWorkScreen();
      }

      // Handle break and initial state
      if(currentScreen === 'break') return renderBreakScreen();

      // Fallback for initial load or edge cases
      if(remainingTasks.length > 0) return renderSelectScreen();
      return renderRepetitionSelectScreen();

  }


  return (
    <div className="h-full flex flex-col items-center justify-center p-4 w-full">
        {getScreenToRender()}
    </div>
  );
}
