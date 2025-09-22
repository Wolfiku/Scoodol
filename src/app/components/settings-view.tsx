
"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useTheme } from "@/hooks/use-theme"
import { Sun, Moon, Sparkles, Droplets, Sunset, Trees, Edit, Briefcase, ListChecks, CalendarDays, Upload, Download, Trash2, HelpCircle, Smartphone, Tablet, Laptop } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"


const themes = [
    { value: "default", label: "Standard", lightIcon: Sparkles, darkIcon: Sparkles, lightColor: "bg-sky-500", darkColor: "bg-slate-500"},
    { value: "ocean", label: "Ozean", lightIcon: Droplets, darkIcon: Droplets, lightColor: "bg-blue-500", darkColor: "bg-blue-800" },
    { value: "sunset", label: "Sonnenuntergang", lightIcon: Sunset, darkIcon: Sunset, lightColor: "bg-orange-500", darkColor: "bg-red-900" },
    { value: "forest", label: "Wald", lightIcon: Trees, darkIcon: Trees, lightColor: "bg-green-500", darkColor: "bg-green-900" }
]

const startViews = [
    { value: "daily", label: "Tagesplan", icon: Briefcase },
    { value: "weekly", label: "Wochenplan", icon: CalendarDays },
    { value: "homework", label: "Hausaufgaben", icon: ListChecks },
]

const RESET_CONFIRMATION_CODE = 'LÖSCHEN';

type TimetableEntry = {
  id: string;
  fach: string;
  lehrer?: string;
  start: string;
  ende: string;
  hauptfach?: boolean;
  notizen?: string;
  materialien?: string;
};

type TimetableData = {
  [key: string]: TimetableEntry[];
};

export default function SettingsView({ onEditTimetable, isPreview = false, onTimetableImport }: { onEditTimetable: () => void, isPreview?: boolean, onTimetableImport: (timetable: TimetableData) => void }) {
    const { theme, setTheme, resolvedTheme, colorTheme, setColorTheme } = useTheme();
    const [startView, setStartView] = useState('daily');
    const [isMounted, setIsMounted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [resetInput, setResetInput] = useState('');
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    const [tapCount, setTapCount] = useState(0);

     useEffect(() => {
        setIsMounted(true);
        const savedStartView = localStorage.getItem('startView');
        if (savedStartView) {
            setStartView(savedStartView);
        }
    }, []);

    useEffect(() => {
        if(isMounted) {
          localStorage.setItem('startView', startView);
        }
    }, [startView, isMounted]);

    const handleModeChange = (mode: 'light' | 'dark') => {
        const currentParts = theme.split('-');
        const currentColor = currentParts.length > 1 ? currentParts[1] : 'default';

        if (currentColor !== 'default') {
            setTheme(`${mode}-${currentColor}`);
        } else {
            setTheme(mode);
        }
    }


    const handleColorThemeChange = (newColor: string) => {
        setColorTheme(newColor);
    }
    
    const handleExport = () => {
        try {
            const timetableData = localStorage.getItem('timetable');
            const homeworkData = localStorage.getItem('homeworks');
            const themeData = localStorage.getItem('theme');
            const startViewData = localStorage.getItem('startView');

            const exportData = {
                timetable: timetableData ? JSON.parse(timetableData) : null,
                homeworks: homeworkData ? JSON.parse(homeworkData) : null,
                theme: themeData,
                startView: startViewData,
            }

            if (!timetableData) {
                toast({ variant: 'destructive', title: "Fehler", description: "Kein Stundenplan zum Exportieren gefunden." });
                return;
            }
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'skoolio-data.skplanexpo';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast({ title: "Export erfolgreich", description: "Deine Daten wurden heruntergeladen." });
        } catch (error) {
            toast({ variant: 'destructive', title: "Fehler", description: "Der Export ist fehlgeschlagen." });
        }
    }

    const handleImportClick = () => {
        fileInputRef.current?.click();
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const importedData = JSON.parse(content);

                if (importedData.timetable) {
                    onTimetableImport(importedData.timetable);
                }
                if (importedData.homeworks) localStorage.setItem('homeworks', JSON.stringify(importedData.homeworks));
                if (importedData.theme) setTheme(importedData.theme);
                if (importedData.startView) setStartView(importedData.startView);

                toast({ title: "Import erfolgreich", description: "Deine Daten wurden wiederhergestellt." });

            } catch (error) {
                toast({ variant: 'destructive', title: "Importfehler", description: "Die Datei ist ungültig oder beschädigt." });
            }
        };
        reader.readAsText(file);
    }
    
    const handleResetData = () => {
        localStorage.clear();
        toast({ title: "Alle Daten zurückgesetzt", description: "Die App wird neu gestartet." });
        setTimeout(() => window.location.reload(), 1500);
    }

    const handleFooterTap = () => {
        const newTapCount = tapCount + 1;
        setTapCount(newTapCount);
        if (newTapCount >= 3) {
            sessionStorage.setItem('previewMode', 'true');
            toast({ title: 'Preview-Modus aktiviert!', description: 'Starte die App neu, um die Änderungen zu sehen.' });
            setTapCount(0);
        }
    }

    if (!isMounted) {
        return null;
    }
    
    if (isPreview) {
        return (
             <div className="flex flex-col items-center justify-center text-center p-8">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Vorschau-Modus</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Weitere Einstellungen gibt es in der Vollversion.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="pb-16">
            <h2 className="text-3xl font-bold mb-6">Einstellungen</h2>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Design &amp; Layout</CardTitle>
                        <CardDescription>Passe das Aussehen der App an deine Wünsche an.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Heller / Dunkler Modus</Label>
                            <div className="flex gap-2">
                                <Button variant={resolvedTheme === 'light' ? 'default' : 'outline'} onClick={() => handleModeChange('light')}>
                                    <Sun className="mr-2"/> Hell
                                </Button>
                                <Button variant={resolvedTheme === 'dark' ? 'default' : 'outline'} onClick={() => handleModeChange('dark')}>
                                    <Moon className="mr-2"/> Dunkel
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Farbthema</Label>
                            <RadioGroup 
                                value={colorTheme}
                                onValueChange={handleColorThemeChange}
                                className="grid grid-cols-2 sm:grid-cols-4 gap-4"
                            >
                                {themes.map(t => {
                                    return (
                                    <Label 
                                        key={t.value}
                                        htmlFor={`theme-${t.value}`}
                                        className={cn(
                                            "block p-4 rounded-lg border-2 cursor-pointer transition-colors",
                                            colorTheme === t.value ? "border-primary" : "border-border"
                                        )}
                                    >
                                        <RadioGroupItem value={t.value} id={`theme-${t.value}`} className="sr-only"/>
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="flex gap-1">
                                                <t.lightIcon className="w-5 h-5 text-gray-700" />
                                                <t.darkIcon className="w-5 h-5 text-gray-300" />
                                            </div>
                                            <span className="font-semibold">{t.label}</span>
                                            <div className="flex gap-1 mt-1">
                                                <div className={`w-6 h-3 rounded-full ${t.lightColor}`} />
                                                <div className={`w-6 h-3 rounded-full ${t.darkColor}`} />
                                            </div>
                                        </div>
                                    </Label>
                                    )
                                })}
                            </RadioGroup>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Stundenplan</CardTitle>
                        <CardDescription>Verwalte deinen Stundenplan.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Button onClick={onEditTimetable}>
                            <Edit className="mr-2"/> Stundenplan bearbeiten
                        </Button>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Hilfe &amp; Anleitung</CardTitle>
                        <CardDescription>Hier findest du nützliche Tipps zur Verwendung der App.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible>
                            <AccordionItem value="install-pwa">
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <HelpCircle className="w-5 h-5" />
                                        <span>Wie installiere ich die App (PWA)?</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-4">
                                    <p>Du kannst diese Web-App wie eine normale App auf deinem Gerät installieren, um schnell darauf zugreifen zu können.</p>
                                    
                                    <div className="flex items-start gap-4 p-3 rounded-lg bg-secondary">
                                        <Tablet className="w-8 h-8 text-primary mt-1" />
                                        <div>
                                            <h4 className="font-semibold">iOS / iPadOS (Safari)</h4>
                                            <p className="text-sm text-muted-foreground">Öffne die App in Safari, tippe auf das "Teilen"-Symbol (das Quadrat mit dem Pfeil nach oben) und wähle dann "Zum Home-Bildschirm".</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 p-3 rounded-lg bg-secondary">
                                        <Smartphone className="w-8 h-8 text-primary mt-1" />
                                        <div>
                                            <h4 className="font-semibold">Android (Chrome)</h4>
                                            <p className="text-sm text-muted-foreground">Öffne die App in Chrome. Je nach Version erscheint eine Aufforderung zur Installation oder du findest die Option "App installieren" bzw. "Zum Startbildschirm hinzufügen" im Browser-Menü (drei Punkte).</p>
                                        </div>
                                    </div>
                                     <div className="flex items-start gap-4 p-3 rounded-lg bg-secondary">
                                        <Laptop className="w-8 h-8 text-primary mt-1" />
                                        <div>
                                            <h4 className="font-semibold">Desktop (Chrome, Edge)</h4>
                                            <p className="text-sm text-muted-foreground">Öffne die App im Browser. In der Adressleiste erscheint rechts ein kleines Icon (oft ein Bildschirm mit einem Pfeil). Klicke darauf und bestätige die Installation.</p>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                </Card>
                <Card>
                     <CardHeader>
                        <CardTitle>Erweiterte Einstellungen</CardTitle>
                        <CardDescription>Passe das Verhalten der App an und sichere oder lösche deine Daten.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                             <Label>Standard-Ansicht nach dem Start</Label>
                             <RadioGroup 
                                value={startView}
                                onValueChange={setStartView}
                                className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                             >
                                 {startViews.map(v => (
                                     <Label 
                                        key={v.value}
                                        htmlFor={`view-${v.value}`}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-colors",
                                            startView === v.value ? "border-primary" : "border-border"
                                        )}
                                    >
                                        <RadioGroupItem value={v.value} id={`view-${v.value}`} className="sr-only"/>
                                        <v.icon className="w-8 h-8 mb-2" />
                                        <span className="font-semibold">{v.label}</span>
                                     </Label>
                                 ))}
                             </RadioGroup>
                        </div>
                        <div className="space-y-2">
                            <Label>App-Daten</Label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button variant="outline" onClick={handleExport}>
                                    <Download className="mr-2" />
                                    Daten exportieren
                                </Button>
                                <Button variant="outline" onClick={handleImportClick}>
                                    <Upload className="mr-2" />
                                    Daten importieren
                                </Button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept=".skplanexpo,application/json"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="border-t pt-6 mt-4">
                        <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                    <Trash2 className="mr-2"/> Alle App-Daten zurücksetzen
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Bist du absolut sicher?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Diese Aktion kann nicht rückgängig gemacht werden. Alle deine Daten, einschließlich Stundenplan und Hausaufgaben, werden dauerhaft gelöscht.
                                        <br/><br/>
                                        Bitte gib <strong className="text-foreground">{RESET_CONFIRMATION_CODE}</strong> ein, um fortzufahren.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <Input 
                                    type="text"
                                    value={resetInput}
                                    onChange={(e) => setResetInput(e.target.value)}
                                    placeholder={`Tippe "${RESET_CONFIRMATION_CODE}"`}
                                />
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setResetInput('')}>Abbrechen</AlertDialogCancel>
                                    <AlertDialogAction
                                        disabled={resetInput !== RESET_CONFIRMATION_CODE}
                                        onClick={handleResetData}
                                    >
                                        Endgültig löschen
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardFooter>
                </Card>
            </div>
             <div className="flex justify-between items-center text-sm text-muted-foreground mt-8">
                <span 
                    className="cursor-pointer"
                    onClick={handleFooterTap}
                >
                    made by @wolfiku, powered by limbo
                </span>
                <span>
                    Version 1.1
                </span>
            </div>
        </div>
    )
}

    