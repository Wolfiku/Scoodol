
"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
    Sparkles, 
    UserCircle2, 
    Users2, 
    LayoutGrid, 
    Zap, 
    ChevronRight, 
    ChevronLeft, 
    CheckCircle2, 
    PartyPopper,
    Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/app/lib/version';

const steps = [
    {
        title: "Update 2.0 ist da!",
        description: "Willkommen zur bisher größten Erweiterung von Scoodol. Wir haben die App grundlegend neu gedacht.",
        icon: <PartyPopper className="w-16 h-16 text-primary animate-bounce" />,
        color: "bg-primary/10"
    },
    {
        title: "Account System",
        description: "Deine Daten gehören dir – und zwar überall. Melde dich an, um deinen Stundenplan und deine Aufgaben auf all deinen Geräten zu synchronisieren.",
        icon: <UserCircle2 className="w-16 h-16 text-blue-500" />,
        color: "bg-blue-50"
    },
    {
        title: "Klassen-Gruppen",
        description: "Vernetze dich mit deiner Klasse! Teile Hausaufgaben und Stundenpläne in Echtzeit. Gemeinsam lernt es sich leichter.",
        icon: <Users2 className="w-16 h-16 text-green-500" />,
        color: "bg-green-50"
    },
    {
        title: "Scoodol Workspace",
        description: "Mehr als nur ein Planer. Erstelle Text-Dokumente, interaktive Quizzes, Präsentationen und Statistiken direkt in der App.",
        icon: <LayoutGrid className="w-16 h-16 text-purple-500" />,
        color: "bg-purple-50"
    },
    {
        title: "Vieles mehr...",
        description: "Optimierte Performance, ein neuer Dark Mode für alle Bereiche und hunderte kleine UI-Verbesserungen für einen flüssigeren Schulalltag.",
        icon: <Zap className="w-16 h-16 text-amber-500" />,
        color: "bg-amber-50"
    },
    {
        title: "Danke!",
        description: "Danke für dein Vertrauen und die Geduld während der Entwicklung. Scoodol wird von Schülern für Schüler gemacht.",
        icon: <Heart className="w-16 h-16 text-rose-500 fill-rose-500" />,
        color: "bg-rose-50",
        footer: "Danke fürs lange Warten! @wolfiku"
    }
];

export function ReleaseNotesDialog() {
    const [open, setOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        const lastSeenVersion = localStorage.getItem('scoodol_last_version');
        if (lastSeenVersion !== APP_VERSION) {
            setOpen(true);
        }
    }, []);

    const handleClose = () => {
        localStorage.setItem('scoodol_last_version', APP_VERSION);
        setOpen(false);
    };

    const next = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleClose();
        }
    };

    const prev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const step = steps[currentStep];

    return (
        <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogContent className="max-w-[90vw] sm:max-w-[500px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
                <div className={cn("p-10 flex flex-col items-center text-center transition-colors duration-500 min-h-[400px]", step.color)}>
                    <div className="mb-8 p-6 rounded-full bg-white shadow-xl ring-4 ring-white/50">
                        {step.icon}
                    </div>
                    
                    <h2 className="text-3xl font-black tracking-tight mb-4 text-slate-900">
                        {step.title}
                    </h2>
                    
                    <p className="text-lg text-slate-600 leading-relaxed max-w-[320px]">
                        {step.description}
                    </p>

                    {step.footer && (
                        <p className="mt-8 font-black text-primary text-sm uppercase tracking-[0.2em]">
                            {step.footer}
                        </p>
                    )}
                </div>

                <div className="bg-white p-6 flex items-center justify-between gap-4 border-t">
                    <div className="flex gap-1.5">
                        {steps.map((_, i) => (
                            <div 
                                key={i} 
                                className={cn(
                                    "h-1.5 rounded-full transition-all duration-300", 
                                    currentStep === i ? "w-8 bg-primary" : "w-1.5 bg-slate-200"
                                )} 
                            />
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {currentStep > 0 && (
                            <Button variant="ghost" onClick={prev} className="rounded-xl h-12">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                        )}
                        <Button 
                            onClick={next} 
                            className={cn(
                                "rounded-xl h-12 px-8 font-black transition-all",
                                currentStep === steps.length - 1 ? "bg-primary text-white" : "bg-slate-900 text-white"
                            )}
                        >
                            {currentStep === steps.length - 1 ? (
                                <span className="flex items-center gap-2">Los geht's <CheckCircle2 className="h-4 w-4"/></span>
                            ) : (
                                <span className="flex items-center gap-2">Weiter <ChevronRight className="h-4 w-4"/></span>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
