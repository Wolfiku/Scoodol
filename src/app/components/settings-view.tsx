
"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useTheme } from "@/hooks/use-theme"
import { Sun, Moon, Sparkles, Droplets, Sunset, Trees, Edit, Briefcase, ListChecks, CalendarDays, Upload, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

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


export default function SettingsView({ onEditTimetable }: { onEditTimetable: () => void }) {
    const { theme, setTheme, resolvedTheme, colorTheme, setColorTheme } = useTheme();
    const [startView, setStartView] = useState('daily');
    const [isMounted, setIsMounted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

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
            if (!timetableData) {
                toast({ variant: 'destructive', title: "Fehler", description: "Kein Stundenplan zum Exportieren gefunden." });
                return;
            }
            const blob = new Blob([timetableData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'stundenplan.skplanexpo';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast({ title: "Export erfolgreich", description: "Dein Stundenplan wurde heruntergeladen." });
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
                // Simple validation
                JSON.parse(content); 
                localStorage.setItem('timetable', content);
                toast({ title: "Import erfolgreich", description: "Dein Stundenplan wurde aktualisiert. Die App wird neu geladen." });
                
                // Reload to apply changes everywhere
                setTimeout(() => window.location.reload(), 1500);

            } catch (error) {
                toast({ variant: 'destructive', title: "Importfehler", description: "Die Datei ist ungültig oder beschädigt." });
            }
        };
        reader.readAsText(file);
    }

    if (!isMounted) {
        return null;
    }

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Einstellungen</h2>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Design & Layout</CardTitle>
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
                        <CardTitle>Erweiterte Einstellungen</CardTitle>
                        <CardDescription>Passe das Verhalten der App an und sichere deine Daten.</CardDescription>
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
                            <Label>Stundenplan-Daten</Label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button variant="outline" onClick={handleExport}>
                                    <Download className="mr-2" />
                                    Exportieren
                                </Button>
                                <Button variant="outline" onClick={handleImportClick}>
                                    <Upload className="mr-2" />
                                    Importieren
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
                </Card>
            </div>
        </div>
    )
}
