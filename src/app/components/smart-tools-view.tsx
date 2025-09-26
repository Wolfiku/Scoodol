"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calculator as CalculatorIcon, Scale, BookText, Atom, FileText, Timer as TimerIcon, Notebook, Sparkles, Wand2 } from 'lucide-react';
import Calculator from './tools/calculator';
import GradeCalculator from './tools/grade-calculator';
import FormulaCollection from './tools/formula-collection';
import PeriodicTableSearch from './tools/periodic-table-search';
import ReportCardAnalyzer from './tools/report-card-analyzer';
import Timer from './tools/timer';
import StopwatchTool from './tools/stopwatch';
import Notes from './tools/notes';
import AiTutor from './tools/ai-tutor';
import TextSimplifier from './tools/text-simplifier';


type Tool = 'calculator' | 'grade-calculator' | 'formula-collection' | 'periodic-table' | 'report-card-analyzer' | 'timer' | 'stopwatch' | 'notes' | 'ai-tutor' | 'text-simplifier';

const allTools: { id: Tool; title: string; description: string; icon: React.ReactNode; isBeta?: boolean }[] = [
    { id: 'ai-tutor', title: 'AI Tutor', description: 'Chatte mit einer KI bei Fragen & Problemen.', icon: <Sparkles className="w-8 h-8" />, isBeta: true },
    { id: 'text-simplifier', title: 'Text-Vereinfacher', description: 'Vereinfache komplizierte Texte & Aufgaben.', icon: <Wand2 className="w-8 h-8" /> },
    { id: 'calculator', title: 'Taschenrechner', description: 'Ein einfacher Rechner für schnelle Berechnungen.', icon: <CalculatorIcon className="w-8 h-8" /> },
    { id: 'grade-calculator', title: 'Notenrechner', description: 'Berechne deinen Notendurchschnitt.', icon: <Scale className="w-8 h-8" /> },
    { id: 'formula-collection', title: 'Formelsammlung', description: 'Finde Formeln für Mathe, Physik & Chemie.', icon: <BookText className="w-8 h-8" /> },
    { id: 'periodic-table', title: 'Periodensystem', description: 'Suche nach chemischen Elementen.', icon: <Atom className="w-8 h-8" /> },
    { id: 'report-card-analyzer', title: 'Zeugnis-Analyse', description: 'Analysiere dein Zeugnis mit KI.', icon: <FileText className="w-8 h-8" /> },
    { id: 'timer', title: 'Timer', description: 'Stelle einen Countdown für Lernphasen.', icon: <TimerIcon className="w-8 h-8" /> },
    { id: 'stopwatch', title: 'Stoppuhr', description: 'Stoppe die Zeit für Aufgaben oder Experimente.', icon: <TimerIcon className="w-8 h-8" /> },
    { id: 'notes', title: 'Notizen', description: 'Ein einfacher Notizblock für deine Gedanken.', icon: <Notebook className="w-8 h-8" /> },
];

export default function SmartToolsView() {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [availableTools, setAvailableTools] = useState(allTools.filter(t => !t.isBeta));
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const betaEnabled = localStorage.getItem('betaFeaturesEnabled') === 'true';
    if (betaEnabled) {
      setAvailableTools(allTools);
    } else {
      setAvailableTools(allTools.filter(t => !t.isBeta));
    }
  }, []);

  const renderTool = () => {
    switch (selectedTool) {
      case 'calculator':
        return <Calculator />;
      case 'grade-calculator':
        return <GradeCalculator />;
      case 'formula-collection':
          return <FormulaCollection />;
      case 'periodic-table':
          return <PeriodicTableSearch />;
      case 'report-card-analyzer':
          return <ReportCardAnalyzer />;
      case 'timer':
        return <Timer />;
      case 'stopwatch':
        return <StopwatchTool />;
      case 'notes':
        return <Notes />;
      case 'ai-tutor':
        return <AiTutor />;
      case 'text-simplifier':
        return <TextSimplifier />;
      default:
        return null;
    }
  };

  if (selectedTool) {
    return (
      <div>
        <Button variant="ghost" onClick={() => setSelectedTool(null)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zur Tool-Auswahl
        </Button>
        {renderTool()}
      </div>
    );
  }

  return (
    <div>
        <h2 className="text-3xl font-bold mb-6">Smart Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableTools.map(tool => (
                <Card 
                    key={tool.id} 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedTool(tool.id)}
                >
                    <CardHeader className="flex flex-row items-center gap-4">
                        {tool.icon}
                        <div>
                            <CardTitle>{tool.title}</CardTitle>
                            <CardDescription>{tool.description}</CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            ))}
        </div>
    </div>
  );
}
