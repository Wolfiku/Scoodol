
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function Timer() {
  const [initialTime, setInitialTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('25');
  const [seconds, setSeconds] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const calculateTotalSeconds = useCallback(() => {
    return (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
  }, [hours, minutes, seconds]);

  useEffect(() => {
    const totalSeconds = calculateTotalSeconds();
    if (!isRunning) {
      setInitialTime(totalSeconds);
      setTimeLeft(totalSeconds);
    }
  }, [hours, minutes, seconds, isRunning, calculateTotalSeconds]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      setIsFinished(true);
      // Removed audioRef.current?.play();
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, timeLeft]);

  const handleStartPause = () => {
    if (timeLeft > 0) {
      setIsRunning(!isRunning);
      setIsFinished(false);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsFinished(false);
    const totalSeconds = calculateTotalSeconds();
    setTimeLeft(totalSeconds);
    // Removed audio handling
  };

  const progress = initialTime > 0 ? (timeLeft / initialTime) * 100 : 0;
  
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Timer</CardTitle>
        <CardDescription>Stelle einen Countdown für deine Lerneinheiten.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6">
        {isRunning || timeLeft < initialTime ? (
          <div className="relative w-64 h-64 flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle className="text-secondary" strokeWidth="7" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50"/>
                <circle
                    className="text-primary"
                    strokeWidth="7"
                    strokeDasharray={2 * Math.PI * 45}
                    strokeDashoffset={(2 * Math.PI * 45) * (1 - progress / 100)}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="45"
                    cx="50"
                    cy="50"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' , transition: 'stroke-dashoffset 1s linear' }}
                />
            </svg>
            <div className={`absolute text-4xl font-mono font-bold ${isFinished ? 'animate-pulse text-destructive' : ''}`}>
              {formatTime(timeLeft)}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              placeholder="00"
              value={hours}
              onChange={e => setHours(e.target.value)}
              className="w-20 text-center text-3xl h-20"
              aria-label="Stunden"
            />
            <span className="text-3xl font-bold">:</span>
            <Input
              type="number"
              min="0"
              max="59"
              placeholder="25"
              value={minutes}
              onChange={e => setMinutes(e.target.value)}
              className="w-20 text-center text-3xl h-20"
              aria-label="Minuten"
            />
            <span className="text-3xl font-bold">:</span>
            <Input
              type="number"
              min="0"
              max="59"
              placeholder="00"
              value={seconds}
              onChange={e => setSeconds(e.target.value)}
              className="w-20 text-center text-3xl h-20"
              aria-label="Sekunden"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 w-full">
          <Button onClick={handleStartPause} className="text-xl py-6" disabled={initialTime === 0 && !isRunning}>
            {isRunning ? <Pause className="mr-2" /> : <Play className="mr-2" />}
            {isRunning ? 'Pause' : 'Start'}
          </Button>
          <Button onClick={handleReset} variant="outline" className="text-xl py-6">
            <RotateCcw className="mr-2" /> Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
