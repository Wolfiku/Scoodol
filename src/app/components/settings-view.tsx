
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useTheme } from "@/hooks/use-theme"
import { Sun, Moon, Sparkles, Droplets, Sunset, Trees } from "lucide-react"

const themes = [
    { value: "default", label: "Standard", lightIcon: Sparkles, darkIcon: Sparkles, lightColor: "bg-sky-500", darkColor: "bg-slate-500"},
    { value: "ocean", label: "Ozean", lightIcon: Droplets, darkIcon: Droplets, lightColor: "bg-blue-500", darkColor: "bg-blue-800" },
    { value: "sunset", label: "Sonnenuntergang", lightIcon: Sunset, darkIcon: Sunset, lightColor: "bg-orange-500", darkColor: "bg-red-900" },
    { value: "forest", label: "Wald", lightIcon: Trees, darkIcon: Trees, lightColor: "bg-green-500", darkColor: "bg-green-900" }
]


export default function SettingsView() {
    const { theme, setTheme, resolvedTheme, colorTheme, setColorTheme } = useTheme();

    const handleModeChange = (mode: 'light' | 'dark') => {
        if (colorTheme && colorTheme !== 'default') {
            setTheme(`${mode}-${colorTheme}`);
        } else {
            setTheme(mode);
        }
    }

    const handleColorThemeChange = (newColor: string) => {
        setColorTheme(newColor);
    }

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Einstellungen</h2>
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
                                const isActive = colorTheme === t.value;

                                return (
                                <Label 
                                    key={t.value}
                                    htmlFor={`theme-${t.value}`}
                                    className="block p-4 rounded-lg border-2 has-[:checked]:border-primary cursor-pointer"
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
        </div>
    )
}

function Button({variant, onClick, children}: any) {
    const baseClasses = "flex items-center justify-center px-4 py-2 rounded-md transition-colors";
    const variantClasses = {
        default: "bg-primary text-primary-foreground",
        outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground"
    }
    return <button onClick={onClick} className={`${baseClasses} ${variantClasses[variant]}`}>{children}</button>
}
