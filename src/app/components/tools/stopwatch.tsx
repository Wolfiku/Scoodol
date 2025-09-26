
"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Pause, RotateCcw, Flag } from 'lucide-react';

const formatTime = (time: number) => {
  const milliseconds = `00${time % 1000}`.slice(-3, -1);
  const seconds = `0${Math.floor(time / 1000) % 60}`.slice(-2);
  const minutes = `0${Math.floor(time / (1000 * 60)) % 60}`.slice(-2);
  const hours = `0${Math.floor(time / (1000 * 60 * 60))}`.slice(-2);
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};

export default function StopwatchTool() {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      const startTime = Date.now() - time;
      timerRef.current = setInterval(() => {
        setTime(Date.now() - startTime);
      }, 10);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, time]);

  const handleStartStop = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(0);
    setLaps([]);
  };

  const handleLap = () => {
    if (isRunning) {
      setLaps(prevLaps => [...prevLaps, time]);
    }
  };
  
  const getLapTime = (lap: number, index: number) => {
    const previousLap = index > 0 ? laps[index - 1] : 0;
    return lap - previousLap;
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Stoppuhr</CardTitle>
        <CardDescription>Messe die Zeit für deine Aufgaben.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6">
        <div className="text-4xl font-mono font-bold text-center w-full bg-muted p-4 rounded-lg">
          {formatTime(time)}
        </div>
        <div className="grid grid-cols-2 gap-4 w-full">
          <Button onClick={handleLap} variant="outline" disabled={!isRunning}>
            <Flag className="mr-2" /> Runde
          </Button>
          <Button onClick={handleReset} variant="destructive">
            <RotateCcw className="mr-2" /> Reset
          </Button>
          <Button onClick={handleStartStop} className="col-span-2 text-xl py-6">
            {isRunning ? <Pause className="mr-2" /> : <Play className="mr-2" />}
            {isRunning ? 'Pause' : 'Start'}
          </Button>
        </div>
        {laps.length > 0 && (
          <ScrollArea className="h-48 w-full rounded-md border mt-4">
            <div className="p-4 text-sm">
                <div className="grid grid-cols-3 gap-2 font-semibold pb-2 mb-2 border-b">
                    <span>Runde</span>
                    <span>Rundenzeit</span>
                    <span>Gesamtzeit</span>
                </div>
                {[...laps].reverse().map((lap, index) => (
                    <div key={laps.length - index} className="grid grid-cols-3 gap-2 py-1 font-mono">
                        <span>{laps.length - index}</span>
                        <span>+ {formatTime(getLapTime(lap, laps.length - 1 - index))}</span>
                        <span>{formatTime(lap)}</span>
                    </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
