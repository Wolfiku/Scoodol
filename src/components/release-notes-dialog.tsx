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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Sparkles, 
    UserCheck, 
    Users, 
    LayoutGrid, 
    PlayCircle,
    Moon,
    ArrowRight,
    Zap,
    Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/app/lib/version';

interface ReleaseNotesDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

const features = [
    {
        title: "Account & Cloud-Synchronisation",
        tag: "Cloud",
        description: "Deine Stundenpläne, Aufgaben und Einstellungen sind jetzt sicher synchronisiert und auf all deinen Geräten verfügbar.",
        icon: UserCheck,
    },
    {
        title: "Klassen-Gruppen",
        tag: "Kollaboration",
        description: "Vernetze dich mit deiner Klasse! Teile Hausaufgaben und Stundenpläne direkt in Echtzeit mit deinen Mitschülern.",
        icon: Users,
    },
    {
        title: "Scoodol Workspace",
        tag: "Produktivität",
        description: "Erstelle Text-Dokumente, interaktive Quizze, Präsentationen und Statistiken nahtlos an einem Ort.",
        icon: LayoutGrid,
    },
    {
        title: "Fokus-Modus & Smarter Planer",
        tag: "Lernen",
        description: "Konzentriere dich auf anstehende Aufgaben mit dem Fokus-Timer und intelligenter Fälligkeitserkennung aus deinem Stundenplan.",
        icon: PlayCircle,
    },
    {
        title: "Neues Design & Dark Mode",
        tag: "UI & Speed",
        description: "Lückenloser Dark Mode für alle Bereiche, anpassbare Farb-Themes und spürbar flüssigere Performance.",
        icon: Moon,
    },
];

export function ReleaseNotesDialog({ open: controlledOpen, onOpenChange: setControlledOpen }: ReleaseNotesDialogProps = {}) {
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;

    useEffect(() => {
        if (!isControlled) {
            const lastSeenVersion = localStorage.getItem('scoodol_last_version');
            if (lastSeenVersion !== APP_VERSION) {
                setInternalOpen(true);
            }
        }
    }, [isControlled]);

    const handleClose = () => {
        localStorage.setItem('scoodol_last_version', APP_VERSION);
        if (isControlled && setControlledOpen) {
            setControlledOpen(false);
        } else {
            setInternalOpen(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : (isControlled ? setControlledOpen?.(true) : setInternalOpen(true)))}>
            <DialogContent className="max-w-[95vw] sm:max-w-[540px] p-0 overflow-hidden rounded-xl border border-border shadow-2xl bg-card">
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-border bg-card">
                    <div className="flex items-center gap-2 mb-2.5">
                        <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/20 font-semibold px-2.5 py-0.5 text-xs">
                            v{APP_VERSION}
                        </Badge>
                        <Badge variant="outline" className="text-xs text-muted-foreground font-normal">
                            Großes Update
                        </Badge>
                    </div>

                    <DialogHeader className="text-left space-y-1">
                        <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            Was ist neu in Scoodol?
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                            Wir haben Scoodol umfassend weiterentwickelt. Hier sind die wichtigsten Neuerungen für deinen Schulalltag:
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Content List */}
                <ScrollArea className="max-h-[55vh] sm:max-h-[380px] p-5 sm:p-6">
                    <div className="flex flex-col gap-3">
                        {/* Highlight Banner matching homework planner alerts */}
                        <div className="flex items-start gap-3 p-3.5 rounded-lg bg-primary/10 border border-primary/20 text-foreground">
                            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <div className="space-y-0.5 text-xs">
                                <p className="font-semibold text-primary">Meilenstein Version 2.0</p>
                                <p className="text-muted-foreground leading-relaxed">
                                    Vollständige Cloud-Anbindung, Gruppenarbeit und Workspace für noch besseres Lernen.
                                </p>
                            </div>
                        </div>

                        {/* Feature Items */}
                        {features.map((feature, idx) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={idx}
                                    className="flex items-start gap-3.5 p-3 rounded-lg bg-secondary/60 hover:bg-secondary/90 transition-colors border border-border/40"
                                >
                                    <div className="p-2 rounded-md bg-card text-primary shrink-0 border border-border/50 shadow-xs mt-0.5">
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <h3 className="text-sm font-semibold text-foreground leading-tight">
                                                {feature.title}
                                            </h3>
                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-background/80 text-muted-foreground border border-border/40">
                                                {feature.tag}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {feature.description}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <DialogFooter className="p-4 sm:p-5 border-t border-border bg-card/50 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-[11px] text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 font-medium">
                        <span>Von Schülern für Schüler</span>
                        <span>•</span>
                        <span className="font-mono">v{APP_VERSION}</span>
                    </div>
                    <Button onClick={handleClose} className="w-full sm:w-auto font-medium">
                        <span>Loslegen</span>
                        <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
