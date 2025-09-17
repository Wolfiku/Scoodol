"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { X, Play, Pause, Coffee, Repeat, BrainCircuit, BellRing } from 'lucide-react';
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
  const [currentScreen, setCurrentScreen] = useState<'select' | 'work' | 'break'>('select');
  const [currentTask, setCurrentTask] = useState<FocusTask | null>(null);
  
  const [totalWorkTime, setTotalWorkTime] = useState(0); // in seconds
  const [currentTaskTime, setCurrentTaskTime] = useState(0); // in seconds
  const [breakTimeLeft, setBreakTimeLeft] = useState(BREAK_DURATION_MINUTES * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  const [remainingTasks, setRemainingTasks] = useState<FocusTask[]>(tasks);
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);
  
  const [showTooLongWarning, setShowTooLongWarning] = useState(false);


  // --- Effects ---
  useEffect(() => {
    if (!isTimerRunning) return;

    const timer = setInterval(() => {
      if (currentScreen === 'work') {
        setTotalWorkTime(prev => prev + 1);
        setCurrentTaskTime(prev => prev + 1);
      } else if (currentScreen === 'break') {
        setBreakTimeLeft(prev => prev - 1);
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
    // Check if total work time triggers a break
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

    // Smart break logic
    if (totalWorkTime >= SMART_BREAK_THRESHOLD_MINUTES * 60) {
      startBreak();
    } else {
       if (remainingTasks.length <= 1) { // 1 because state update is pending
           onExit([...completedTasks, currentTask!.id]);
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
        onExit(completedTasks);
    } else {
        setCurrentScreen('select');
    }
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
                        Möchtest du den Fokus-Modus wirklich beenden? Dein Fortschritt geht nicht verloren.
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

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 w-full">
        {currentScreen === 'select' && renderSelectScreen()}
        {currentScreen === 'work' && renderWorkScreen()}
        {currentScreen === 'break' && renderBreakScreen()}
    </div>
  );
}
