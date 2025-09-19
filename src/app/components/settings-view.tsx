
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useTheme } from "@/hooks/use-theme"
import { Sun, Moon, Sparkles, Droplets, Sunset, Trees, Edit, Briefcase, ListChecks, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
                        <CardDescription>Passe das Verhalten der App an.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
