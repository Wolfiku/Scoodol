
"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useTheme } from "@/hooks/use-theme"
import { Sun, Moon, Sparkles, Droplets, Sunset, Trees, Edit, Briefcase, ListChecks, CalendarDays, Upload, Download, Trash2, HelpCircle, Smartphone, Tablet, Laptop, Shield, Wand2, Languages, Clock, Rss, Save, AlertTriangle, User, LogOut, Settings as SettingsIcon, Users, Copy, Check, Link2, RefreshCw, Loader2, Plus } from "lucide-react"
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
import Link from "next/link"
import { Switch } from "@/components/ui/switch"
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { useRouter } from "next/navigation"
import { doc, updateDoc } from "firebase/firestore"
import { APP_VERSION } from "@/app/lib/version"
import { Badge } from "@/components/ui/badge"

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
const STANDARD_LESSON_DURATION = 45;
const MAX_LESSONS_MORNING = 6;


type TimetableSettings = {
    schoolStartTime: string;
    schoolEndTime: string;
    firstBreakDuration: number;
    secondBreakDuration: number;
}

type GroupSettings = {
    syncTimetable?: boolean;
    showInGroup?: boolean;
    shareHomework?: boolean;
}

type UserProfile = {
    groupId?: string;
    groupSettings?: GroupSettings;
    role?: 'user' | 'admin' | 'workspace_plus_user';
    shareId?: string;
}

const parseTimeToMinutes = (time: string): number => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function SettingsView({ onEditTimetable, isPreview = false, onTimetableImport, timetableSettings, onSettingsChange, isTimetableSynced }: { onEditTimetable: () => void, isPreview?: boolean, onTimetableImport: (importedData: any) => void, timetableSettings: TimetableSettings, onSettingsChange: (settings: TimetableSettings) => void, isTimetableSynced: boolean }) {
    const { theme, setTheme, resolvedTheme, colorTheme, setColorTheme, startView, setStartView, aiLanguage, setAiLanguage } = useTheme();
    const [isMounted, setIsMounted] = useState(false);
    const [betaFeaturesEnabled, setBetaFeaturesEnabled] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [resetInput, setResetInput] = useState('');
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    const [tapCount, setTapCount] = useState(0);

    const [localTimetableSettings, setLocalTimetableSettings] = useState<TimetableSettings>(timetableSettings);
    const [showValidationDialog, setShowValidationDialog] = useState(false);
    const [calculatedDuration, setCalculatedDuration] = useState(0);

    const { user } = useUser();
    const auth = useAuth();
    const firestore = useFirestore();
    const router = useRouter();

    const [copied, setCopied] = useState(false);

    const userDocRef = useMemoFirebase(() => 
        user ? doc(firestore, 'users', user.uid) : null
  , [firestore, user]);
    
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);

    const groupDocRef = useMemoFirebase(() => 
        userProfile?.groupId ? doc(firestore, 'groups', userProfile.groupId) : null
    , [firestore, userProfile?.groupId]);
    const { data: groupData } = useDoc<any>(groupDocRef);

    useEffect(() => {
        setLocalTimetableSettings(timetableSettings);
    }, [timetableSettings]);


     useEffect(() => {
        setIsMounted(true);
        const savedBeta = localStorage.getItem("betaFeaturesEnabled");
        setBetaFeaturesEnabled(savedBeta === 'true');
    }, []);
    
    useEffect(() => {
        if(isMounted) {
            localStorage.setItem("betaFeaturesEnabled", String(betaFeaturesEnabled));
        }
    }, [betaFeaturesEnabled, isMounted]);

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
            const timetableSettingsData = localStorage.getItem('timetableSettings');
            const homeworkData = localStorage.getItem('homeworks');
            const themeData = localStorage.getItem('theme');
            const startViewData = localStorage.getItem('startView');
            const profilePictureData = localStorage.getItem('profilePicture');
            const betaFeaturesData = localStorage.getItem('betaFeaturesEnabled');
            const aiLanguageData = localStorage.getItem('aiLanguage');

            const exportData = {
                timetable: timetableData ? JSON.parse(timetableData) : null,
                timetableSettings: timetableSettingsData ? JSON.parse(timetableSettingsData) : null,
                homeworks: homeworkData ? JSON.parse(homeworkData) : null,
                theme: themeData,
                startView: startViewData,
                profilePicture: profilePictureData,
                betaFeaturesEnabled: betaFeaturesData,
                aiLanguage: aiLanguageData,
            }

            if (!timetableData) {
                toast({ variant: 'destructive', title: "Fehler", description: "Kein Stundenplan zum Exportieren gefunden." });
                return;
            }
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'scoodol-data.json';
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

                onTimetableImport(importedData);
                toast({ title: "Import erfolgreich", description: "Deine Daten wurden wiederhergestellt. Die App wird neu geladen." });
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
        if (!betaFeaturesEnabled) return;
        const newTapCount = tapCount + 1;
        setTapCount(newTapCount);
        if (newTapCount >= 3) {
            sessionStorage.setItem('previewMode', 'true');
            toast({ title: 'Preview-Modus aktiviert!', description: 'Starte die App neu, um die Änderungen zu sehen.' });
            setTapCount(0);
        }
    }
    
    const proceedWithSave = () => {
        onSettingsChange(localTimetableSettings);
        toast({ title: "Zeiten gespeichert", description: "Die neuen Schul- und Pausenzeiten wurden übernommen."});
        setShowValidationDialog(false);
    }

    const handleTimeSettingsSave = () => {
        const morningStartMinutes = parseTimeToMinutes(localTimetableSettings.schoolStartTime);
        const morningEndMinutes = parseTimeToMinutes(localTimetableSettings.schoolEndTime);
        const totalMorningMinutes = morningEndMinutes - morningStartMinutes;
        const totalBreakMinutes = (localTimetableSettings.firstBreakDuration || 0) + (localTimetableSettings.secondBreakDuration || 0);
        const netTeachingMinutes = totalMorningMinutes - totalBreakMinutes;
        const lessonDuration = netTeachingMinutes > 0 ? Math.floor(netTeachingMinutes / MAX_LESSONS_MORNING) : 0;
        
        setCalculatedDuration(lessonDuration);

        if (lessonDuration !== STANDARD_LESSON_DURATION) {
            setShowValidationDialog(true);
        } else {
            proceedWithSave();
        }
    }
    
    const handleLogout = async () => {
        if (!auth) return;
        await auth.signOut();
        toast({ title: 'Abgemeldet', description: 'Du wurden erfolgreich abgemeldet.' });
        router.push('/');
    };

    const handleGroupSettingChange = async (key: keyof GroupSettings, value: boolean) => {
        if (!userDocRef) return;
        const currentSettings = userProfile?.groupSettings || {};
        await updateDoc(userDocRef, {
            groupSettings: {
                ...currentSettings,
                [key]: value,
            }
        });
        toast({ title: "Einstellung gespeichert!" });
    }
    
    const copyShareId = () => {
        if(!userProfile?.shareId) return;
        navigator.clipboard.writeText(userProfile.shareId);
        setCopied(true);
        toast({ title: 'Kopiert!', description: 'Deine Share ID wurde in die Zwischenablage kopiert.' });
        setTimeout(() => setCopied(false), 2000);
    }

    const leaveGroup = async () => {
        if (!userDocRef) return;
        await updateDoc(userDocRef, {
            groupId: null,
            groupSettings: {
                syncTimetable: false,
                showInGroup: false,
                shareHomework: false,
            }
        });
        toast({ title: "Du hast die Gruppe verlassen." });
    }

    const timeSettingsChanged = localTimetableSettings.schoolStartTime !== timetableSettings.schoolStartTime 
        || localTimetableSettings.schoolEndTime !== timetableSettings.schoolEndTime
        || localTimetableSettings.firstBreakDuration !== timetableSettings.firstBreakDuration
        || localTimetableSettings.secondBreakDuration !== timetableSettings.secondBreakDuration;


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
            <AlertDialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-amber-500" />
                        Ungewöhnliche Stundendauer
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Basierend auf deinen Einstellungen dauert eine Unterrichtsstunde <strong>{calculatedDuration} Minuten</strong>. Das ist unüblich.
                        <br/><br/>
                        Bist du sicher, dass deine Schul- und Pausenzeiten korrekt sind?
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen & Prüfen</AlertDialogCancel>
                    <AlertDialogAction onClick={proceedWithSave}>Trotzdem speichern</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <h2 className="text-3xl font-bold mb-6">Einstellungen</h2>
            <div className="space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Mein Account</CardTitle>
                        <CardDescription>Verwalte deinen Account und deine persönlichen IDs.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {user && !user.isAnonymous ? (
                             <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <User className="w-5 h-5 text-primary" />
                                    <p>Angemeldet als: <span className="font-semibold">{user.displayName || user.email}</span></p>
                                </div>
                                {userProfile?.shareId && (
                                     <div className="space-y-2">
                                        <Label>Deine persönliche Share ID</Label>
                                        <div className="flex items-center gap-2">
                                            <Input value={userProfile.shareId} readOnly />
                                            <Button onClick={copyShareId} size="icon" variant="outline" className="shrink-0">
                                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                         <p className="text-xs text-muted-foreground">Teile diese ID, damit andere einen privaten Chat mit dir starten können.</p>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    <Button asChild variant="outline">
                                        <Link href="/account">
                                            <SettingsIcon className="mr-2 h-4 w-4" />
                                            Account verwalten
                                        </Link>
                                    </Button>
                                    <Button onClick={handleLogout} variant="outline">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Abmelden
                                    </Button>
                                </div>
                            </div>
                        ) : (
                             <div className="space-y-2">
                                <p className="text-muted-foreground">Du bist momentan als Gast unterwegs. Erstelle einen Account, um deine Daten zu speichern und auf anderen Geräten zu nutzen.</p>
                                <div className="flex gap-2">
                                    <Button asChild>
                                        <Link href="/login">Anmelden</Link>
                                    </Button>
                                    <Button asChild variant="secondary">
                                         <Link href="/register">Registrieren</Link>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                
                 <Card>
                    <CardHeader>
                        <CardTitle>Meine Klasse / Gruppe</CardTitle>
                        <CardDescription>Tritt einer Gruppe bei, um Stundenpläne & mehr zu teilen.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {user && !user.isAnonymous ? (
                            userProfile?.groupId ? (
                                <div className="space-y-4">
                                    <div className="p-4 rounded-2xl bg-secondary/30 border border-border flex items-center gap-4">
                                        <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0">
                                            <Users className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground mb-0.5 tracking-widest">Du bist in</p>
                                            <h3 className="font-bold text-lg truncate leading-tight">
                                                {groupData ? groupData.name : <Loader2 className="w-4 h-4 animate-spin inline-block" />}
                                            </h3>
                                            {groupData?.schoolName && (
                                                <p className="text-xs text-muted-foreground truncate">{groupData.schoolName}</p>
                                            )}
                                        </div>
                                    </div>
                                    <Button asChild className="w-full font-bold h-12 rounded-xl shadow-lg shadow-primary/10">
                                        <Link href={`/groups/${userProfile.groupId}`}>
                                            <Users className="mr-2 h-4 w-4"/> Gruppen-Dashboard öffnen
                                        </Link>
                                    </Button>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-muted-foreground mb-4 text-sm">Du bist momentan kein Mitglied einer digitalen Klasse.</p>
                                    <Button asChild variant="outline" className="w-full border-dashed border-2">
                                        <Link href="/groups">
                                            <Plus className="mr-2 h-4 w-4"/> Gruppe erstellen oder suchen
                                        </Link>
                                    </Button>
                                </div>
                            )
                        ) : (
                            <p className="text-muted-foreground text-sm italic">
                                <Link href="/login" className="text-primary underline">Melde dich an</Link>, um Gruppenfunktionen zu nutzen.
                            </p>
                        )}
                    </CardContent>
                </Card>

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
                        <CardTitle>KI-Einstellungen</CardTitle>
                        <CardDescription>Passe das Verhalten der künstlichen Intelligenz an.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                             <Label>Sprache der KI-Antworten</Label>
                             <RadioGroup 
                                value={aiLanguage}
                                onValueChange={setAiLanguage}
                                className="flex gap-4"
                             >
                                 <Label htmlFor="lang-german" className={cn("flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors", aiLanguage === 'German' ? 'border-primary' : 'border-border')}>
                                    <RadioGroupItem value="German" id="lang-german" />
                                    Deutsch
                                 </Label>
                                  <Label htmlFor="lang-english" className={cn("flex items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-colors", aiLanguage === 'English' ? 'border-primary' : 'border-border')}>
                                    <RadioGroupItem value="English" id="lang-english" />
                                    Englisch
                                 </Label>
                             </RadioGroup>
                        </div>
                         <div className="space-y-4 p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="beta-features" className="flex flex-col gap-1">
                                    <span className="font-bold flex items-center gap-2"><Wand2 className="w-5 h-5 text-primary" />Beta-Funktionen</span>
                                    <span className="text-xs text-muted-foreground">Aktiviere experimentelle & unfertige Features.</span>
                                </Label>
                                <Switch
                                    id="beta-features"
                                    checked={betaFeaturesEnabled}
                                    onCheckedChange={setBetaFeaturesEnabled}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div className="space-y-1.5">
                            <CardTitle>Stundenplan & Zeiten</CardTitle>
                            <CardDescription>Verwalte deinen Stundenplan und die Schul- und Pausenzeiten.</CardDescription>
                        </div>
                        {userProfile?.groupId && (
                             <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 p-2 px-3 rounded-xl animate-in fade-in slide-in-from-top-1 duration-300">
                                <div className="flex flex-col items-end mr-1">
                                    <Label htmlFor="sync-toggle" className="text-[9px] font-black uppercase text-primary leading-none">Gruppen-Sync</Label>
                                    <span className="text-[8px] text-muted-foreground">{groupData?.name || 'Laden...'}</span>
                                </div>
                                <Switch 
                                    id="sync-toggle"
                                    checked={!!userProfile.groupSettings?.syncTimetable} 
                                    onCheckedChange={(v) => handleGroupSettingChange('syncTimetable', v)}
                                />
                             </div>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className={cn("space-y-4 transition-all duration-300", isTimetableSynced && "opacity-40 grayscale pointer-events-none")}>
                            {isTimetableSynced && (
                                <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] mb-2">
                                    <Check className="h-3 w-3" /> Gruppenplan aktiviert
                                </div>
                            )}
                            
                            <Button onClick={onEditTimetable} className="w-full sm:w-auto">
                                <Edit className="mr-2"/> Stundenplan bearbeiten
                            </Button>
                            
                            <Accordion type="single" collapsible>
                                <AccordionItem value="item-1" className="border-none">
                                    <AccordionTrigger className="bg-secondary/50 px-4 rounded-xl hover:no-underline">
                                        <h3 className="text-lg font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> Allgemeine Schul- & Pausenzeiten</h3>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4">
                                        <div className="space-y-4 pt-4">
                                            <div className="grid sm:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label htmlFor="start-time">Schulstart (Vormittag)</Label>
                                                    <Input 
                                                        id="start-time"
                                                        type="time" 
                                                        value={localTimetableSettings.schoolStartTime} 
                                                        onChange={e => setLocalTimetableSettings({ ...localTimetableSettings, schoolStartTime: e.target.value })} 
                                                        className="w-full"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor="end-time">Schulende (Vormittag)</Label>
                                                    <Input 
                                                        id="end-time"
                                                        type="time" 
                                                        value={localTimetableSettings.schoolEndTime} 
                                                        onChange={e => setLocalTimetableSettings({ ...localTimetableSettings, schoolEndTime: e.target.value })} 
                                                        className="w-full"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor="break1">1. große Pause (in Min.)</Label>
                                                    <Input 
                                                        id="break1"
                                                        type="number" 
                                                        value={localTimetableSettings.firstBreakDuration || ''} 
                                                        onChange={e => setLocalTimetableSettings({ ...localTimetableSettings, firstBreakDuration: parseInt(e.target.value) || 0 })} 
                                                        className="w-full"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor="break2">2. große Pause (in Min.)</Label>
                                                    <Input 
                                                        id="break2"
                                                        type="number" 
                                                        value={localTimetableSettings.secondBreakDuration || ''} 
                                                        onChange={e => setLocalTimetableSettings({ ...localTimetableSettings, secondBreakDuration: parseInt(e.target.value) || 0 })} 
                                                        className="w-full"
                                                    />
                                                </div>
                                            </div>
                                            <Button onClick={handleTimeSettingsSave} disabled={!timeSettingsChanged} className="w-full sm:w-auto">
                                                <Save className="mr-2 h-4 w-4" /> Zeiten speichern
                                            </Button>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Erweiterte Einstellungen</CardTitle>
                        <CardDescription>Sichere oder lösche deine Daten.</CardDescription>
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
                                    accept=".json"
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

                <Card>
                    <CardHeader>
                        <CardTitle>News & Updates</CardTitle>
                        <CardDescription>Hier bekommst du neue Informationen zum Projekt.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" asChild>
                           <Link href="https://wolfikuproduction.de/scoodolnews" target="_blank" rel="noopener noreferrer"><Rss className="mr-2"/>Zu den News</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Hilfe & Anleitung</CardTitle>
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
                        <CardTitle>Rechtliches</CardTitle>
                        <CardDescription>Impressum und Datenschutzerklärung.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-2">
                        <Button variant="outline" asChild>
                           <Link href="/impressum"><Shield className="mr-2"/>Impressum</Link>
                        </Button>
                        <Button variant="outline" asChild>
                           <Link href="/datenschutz"><Shield className="mr-2"/>Datenschutz</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
             <div className="flex justify-between items-center text-sm text-muted-foreground mt-8">
                <span 
                    className="cursor-pointer"
                    onClick={handleFooterTap}
                >
                    made by @wolfiku
                </span>
                <span>
                    Version {APP_VERSION}
                </span>
            </div>
        </div>
    )
}
