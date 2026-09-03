
"use client"

import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Camera, Edit, Info, Loader2, Save, Upload, ArrowRight, Sunrise, Sunset, AlertTriangle, ArrowLeft, Download, CheckCircle2, Clock, RefreshCcw, CalendarDays } from 'lucide-react';
import { scanTimetableImage } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type TimetableEntry = {
    id: string;
    fach: string;
    lehrer?: string;
    room?: string;
    start: string;
    ende: string;
    hauptfach?: boolean;
    rotation?: 'both' | 'a' | 'b';
};

type TimetableData = {
    [key: string]: TimetableEntry[];
};

type TimetableSettings = {
    schoolStartTime: string;
    schoolEndTime: string;
    firstBreakDuration: number;
    secondBreakDuration: number;
    isABWeekActive?: boolean;
}

const weekDays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
const LESSONS_BEFORE_FIRST_BREAK = 2;
const LESSONS_BEFORE_SECOND_BREAK = 2; 
const MAX_LESSONS_MORNING = 6;
const MAX_LESSONS_TOTAL = 10;
const STANDARD_LESSON_DURATION = 45;

const parseTimeToMinutes = (time: string): number => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const formatMinutesToTime = (minutes: number): string => {
    if (isNaN(minutes)) return '00:00';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const generateTimeSlots = (settings: TimetableSettings): { start: string, ende: string }[] => {
    const slots = [];
    const morningStartMinutes = parseTimeToMinutes(settings.schoolStartTime);
    const morningEndMinutes = parseTimeToMinutes(settings.schoolEndTime);
    
    if (morningStartMinutes >= morningEndMinutes) {
        return Array(MAX_LESSONS_TOTAL).fill({ start: '00:00', ende: '00:00'});
    }
    
    const totalMorningMinutes = morningEndMinutes - morningStartMinutes;
    const totalBreakMinutes = (settings.firstBreakDuration || 0) + (settings.secondBreakDuration || 0);
    const netTeachingMinutes = totalMorningMinutes - totalBreakMinutes;
    const lessonDuration = netTeachingMinutes > 0 ? Math.floor(netTeachingMinutes / MAX_LESSONS_MORNING) : 0;

    let currentTime = morningStartMinutes;

    for (let i = 0; i < MAX_LESSONS_MORNING; i++) {
        const lessonStart = currentTime;
        const lessonEnd = currentTime + lessonDuration;
        
        slots.push({
            start: formatMinutesToTime(lessonStart),
            ende: formatMinutesToTime(lessonEnd),
        });

        currentTime = lessonEnd;

        if (i + 1 === LESSONS_BEFORE_FIRST_BREAK) {
             currentTime += settings.firstBreakDuration || 0;
        } else if (i + 1 === LESSONS_BEFORE_FIRST_BREAK + LESSONS_BEFORE_SECOND_BREAK) {
            currentTime += settings.secondBreakDuration || 0;
        }
    }
    
    let afternoonStartTime = currentTime;
    if (morningEndMinutes < afternoonStartTime) {
        afternoonStartTime = morningEndMinutes;
    }

    const afternoonLessonDuration = 45;
    for (let i = MAX_LESSONS_MORNING; i < MAX_LESSONS_TOTAL; i++) {
        const lessonStart = afternoonStartTime;
        const lessonEnd = afternoonStartTime + afternoonLessonDuration;
        
        slots.push({
            start: formatMinutesToTime(lessonStart),
            ende: formatMinutesToTime(lessonEnd),
        });
        afternoonStartTime = lessonEnd;
    }

    return slots;
};

const createInitialTimetable = (settings: TimetableSettings): TimetableData => {
    const timetable: TimetableData = {};
    const timeSlots = generateTimeSlots(settings);
    weekDays.forEach(day => {
        timetable[day] = timeSlots.map((slot, index) => {
            return {
                id: `${day.slice(0, 2).toLowerCase()}-${index + 1}`,
                fach: '',
                lehrer: '',
                room: '',
                start: slot.start,
                ende: slot.ende,
                hauptfach: false,
                rotation: 'both'
            };
        });
    });
    return timetable;
}

type UserData = {
    timetable: TimetableData,
    timetableSettings: TimetableSettings,
    settings: {
        profilePicture?: string,
    }
}

export default function SetupView({ onSetupComplete, onTimetableImport, initialData, isEditing = false, isCreatorMode = false, viewMode = 'setup', isGroupPlan = false }: { onSetupComplete: (userData: Partial<UserData>) => void, onTimetableImport: (importedData: any) => void, initialData?: Partial<UserData>, isEditing?: boolean, isCreatorMode?: boolean, viewMode?: 'setup' | 'creator' | 'edit', isGroupPlan?: boolean }) {
    const [mode, setMode] = useState<'welcome' | 'time-setup' | 'select' | 'manual' | 'scan'>(isEditing ? 'manual' : 'welcome');
    
    const [timetableSettings, setTimetableSettings] = useState<TimetableSettings>(initialData?.timetableSettings || { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15, isABWeekActive: false });
    const [timetable, setTimetable] = useState<TimetableData>(initialData?.timetable && Object.keys(initialData.timetable).length > 0 ? initialData.timetable : createInitialTimetable(initialData?.timetableSettings || timetableSettings));
    const [profilePicture, setProfilePicture] = useState<string | null>(initialData?.settings?.profilePicture || null);
    
    const [isScanning, setIsScanning] = useState(false);
    const [activeWeekTab, setActiveWeekTab] = useState<'A' | 'B'>('A');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const importFileInputRef = useRef<HTMLInputElement>(null);
    const profilePicInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [showValidationDialog, setShowValidationDialog] = useState(false);
    const [calculatedDuration, setCalculatedDuration] = useState(0);
    const { user } = useUser();
    const router = useRouter();


    useEffect(() => {
        if (isEditing && initialData) {
            setTimetableSettings(initialData.timetableSettings || { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15, isABWeekActive: false });
            setTimetable(initialData.timetable || createInitialTimetable(initialData.timetableSettings || timetableSettings));
            setProfilePicture(initialData.settings?.profilePicture || null);
        }
    }, [isEditing, initialData]);
    

    useEffect(() => {
        if (viewMode === 'creator' || viewMode === 'edit') {
            setMode('manual');
        }
    }, [viewMode]);

    // Regenerate timetable when settings change
    useEffect(() => {
        const newTimeSlots = generateTimeSlots(timetableSettings);
        const updatedTimetable: TimetableData = {};

        weekDays.forEach(day => {
            updatedTimetable[day] = newTimeSlots.map((slot, index) => {
                const existingEntry = timetable[day]?.[index];
                return {
                    id: existingEntry?.id || `${day.slice(0, 2).toLowerCase()}-${index + 1}`,
                    fach: existingEntry?.fach || '',
                    lehrer: existingEntry?.lehrer || '',
                    room: existingEntry?.room || '',
                    start: slot.start,
                    ende: slot.ende,
                    hauptfach: existingEntry?.hauptfach || false,
                    rotation: existingEntry?.rotation || 'both',
                };
            });
        });
        setTimetable(updatedTimetable);
    }, [timetableSettings.schoolStartTime, timetableSettings.schoolEndTime, timetableSettings.firstBreakDuration, timetableSettings.secondBreakDuration]);

    const timeSlots = useMemo(() => generateTimeSlots(timetableSettings), [timetableSettings]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            toast({
                variant: 'destructive',
                title: 'Offline',
                description: 'Diese Funktion benötigt eine Internetverbindung.',
            });
            return;
        }

        setIsScanning(true);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const dataUri = reader.result as string;
            const result = await scanTimetableImage(dataUri, 'German');

            if (result.error || !result.timetable) {
                toast({
                    variant: 'destructive',
                    title: 'Fehler beim Scannen',
                    description: result.error || 'Die KI konnte keinen Stundenplan erkennen.',
                });
            } else {
                const newTimetable = createInitialTimetable(timetableSettings);
                const scannedTimeSlots = generateTimeSlots(timetableSettings);
                Object.keys(result.timetable).forEach(day => {
                    const dayName = day as keyof typeof result.timetable;
                    if(newTimetable[dayName]) {
                        const daySchedule = result.timetable[dayName] || [];
                        daySchedule.forEach(aiEntry => {
                            const slotIndex = scannedTimeSlots.findIndex(slot => slot.start === aiEntry.start);
                            if(slotIndex !== -1 && slotIndex < newTimetable[dayName].length) {
                                newTimetable[dayName][slotIndex] = {
                                    ...newTimetable[dayName][slotIndex],
                                    fach: aiEntry.subject,
                                    lehrer: aiEntry.teacher || '',
                                    room: aiEntry.room || '',
                                    hauptfach: aiEntry.isMainSubject || false,
                                    rotation: 'both'
                                };
                            }
                        })
                    }
                })
                setTimetable(newTimetable);
                toast({
                    title: 'Stundenplan gescannt!',
                    description: 'Überprüfe die erkannten Daten und korrigiere sie bei Bedarf.',
                });
                setMode('manual');
            }
            setIsScanning(false);
        };
         reader.onerror = () => {
            toast({
                variant: 'destructive',
                title: 'Fehler',
                description: 'Die Bilddatei konnte nicht gelesen werden.',
            });
            setIsScanning(false);
        }
    }
    
    const handleInputChange = (day: string, slotIndex: number, field: keyof TimetableEntry, value: string | boolean) => {
        const newTimetable = { ...timetable };
        // @ts-ignore
        newTimetable[day][slotIndex][field] = value;
        setTimetable(newTimetable);
    }
    
    const proceedWithSave = () => {
        const dataToSave: Partial<UserData> = {
            timetable,
            timetableSettings,
            settings: {
                profilePicture: profilePicture || undefined,
            }
        };
        onSetupComplete(dataToSave);
        toast({ title: "Stundenplan gespeichert!", description: "Die App ist jetzt einsatzbereit."});
        setShowValidationDialog(false);
    }

    const handleSave = () => {
        const morningStartMinutes = parseTimeToMinutes(timetableSettings.schoolStartTime);
        const morningEndMinutes = parseTimeToMinutes(timetableSettings.schoolEndTime);
        const totalMorningMinutes = morningEndMinutes - morningStartMinutes;
        const totalBreakMinutes = (timetableSettings.firstBreakDuration || 0) + (timetableSettings.secondBreakDuration || 0);
        const netTeachingMinutes = totalMorningMinutes - totalBreakMinutes;
        const lessonDuration = netTeachingMinutes > 0 ? Math.floor(netTeachingMinutes / MAX_LESSONS_MORNING) : 0;
        
        setCalculatedDuration(lessonDuration);

        if (lessonDuration !== STANDARD_LESSON_DURATION) {
            setShowValidationDialog(true);
        } else {
            proceedWithSave();
        }
    }
    
    const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const importedData = JSON.parse(content);
                onTimetableImport(importedData);

            } catch (error) {
                toast({ variant: 'destructive', title: "Importfehler", description: "Die Datei ist ungültig oder beschädigt." });
            }
        };
        reader.readAsText(file);
    }
    
     const handleExport = () => {
        try {
            const dataToExport = {
                timetable: timetable,
                timetableSettings: timetableSettings,
            }

            const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'scoodol-timetable.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast({ title: "Export erfolgreich", description: "Dein Stundenplan wurde heruntergeladen." });
        } catch (error) {
            toast({ variant: 'destructive', title: "Fehler", description: "Der Export ist fehlgeschlagen." });
        }
    }

    const handleProfilePicChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            setProfilePicture(reader.result as string);
        };
    }

    if (mode === 'welcome') {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <Card className="w-full max-w-lg text-center">
                    <CardHeader className="items-center">
                        <Avatar className="h-24 w-24 mb-4 cursor-pointer" onClick={() => profilePicInputRef.current?.click()}>
                           <AvatarImage src={profilePicture || undefined} />
                            <AvatarFallback>
                                <User className="h-12 w-12" />
                            </AvatarFallback>
                        </Avatar>
                        <input type="file" accept="image/*" ref={profilePicInputRef} onChange={handleProfilePicChange} className="hidden" />

                        <CardTitle className="text-3xl">Willkommen bei Scoodol!</CardTitle>
                        <CardDescription>Dein smarter Begleiter für den Schulalltag.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                         <Button size="lg" className="w-full" onClick={() => setMode('time-setup')}>Jetzt einrichten!</Button>
                         
                         {(!user || user.isAnonymous) && (
                             <>
                                <div className="relative py-4">
                                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
                                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">oder bereits ein Nutzer?</span></div>
                                </div>
                                <Button size="lg" variant="outline" className="w-full" asChild>
                                    <Link href="/login">Anmelden</Link>
                                </Button>
                                <div className="text-center text-sm">
                                    Noch keinen Account?{" "}
                                    <Button variant="link" asChild className="p-0 h-auto">
                                        <Link href="/register">Jetzt registrieren</Link>
                                    </Button>
                                </div>
                             </>
                         )}
                    </CardContent>
                    <CardFooter className="flex justify-center gap-4 text-sm pt-4">
                        <Button variant="link" asChild className="text-muted-foreground">
                            <Link href="/impressum">Impressum</Link>
                        </Button>
                         <Button variant="link" asChild className="text-muted-foreground">
                            <Link href="/datenschutz">Datenschutz</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    if (mode === 'time-setup') {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <Card className="w-full max-w-lg text-center">
                    <CardHeader>
                        <CardTitle className="text-2xl">Deine Schul- & Pausenzeiten</CardTitle>
                        <CardDescription>Passe die Zeiten an deinen Schultag an.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6">
                        <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-secondary/50">
                            <Label htmlFor="start-time" className="flex items-center gap-2 text-lg font-semibold text-foreground">
                                <Sunrise className="text-amber-500" />
                                Schulstart
                            </Label>
                            <Input 
                                id="start-time"
                                type="time" 
                                value={timetableSettings.schoolStartTime} 
                                onChange={e => setTimetableSettings(prev => ({ ...prev, schoolStartTime: e.target.value }))} 
                                className="w-auto text-2xl h-14 p-2"
                            />
                        </div>
                        <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-secondary/50">
                            <Label htmlFor="end-time" className="flex items-center gap-2 text-lg font-semibold text-foreground">
                                <Sunset className="text-orange-500" />
                                Schulende (Vormittag)
                            </Label>
                            <Input 
                                id="end-time"
                                type="time" 
                                value={timetableSettings.schoolEndTime} 
                                onChange={e => setTimetableSettings(prev => ({ ...prev, schoolEndTime: e.target.value }))} 
                                className="w-auto text-2xl h-14 p-2"
                            />
                        </div>
                         <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-secondary/50 col-span-1 sm:col-span-2">
                             <Label className="text-lg font-semibold text-foreground">Pausendauer (Minuten)</Label>
                            <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <Label htmlFor="break1" className="text-sm">1. Pause</Label>
                                     <Input 
                                        id="break1"
                                        type="number" 
                                        value={timetableSettings.firstBreakDuration} 
                                        onChange={e => setTimetableSettings(prev => ({ ...prev, firstBreakDuration: parseInt(e.target.value) || 0 }))} 
                                        className="w-20 text-center text-xl h-12 p-2"
                                    />
                                </div>
                                <div className="text-center">
                                     <Label htmlFor="break2" className="text-sm">2. Pause</Label>
                                     <Input 
                                        id="break2"
                                        type="number" 
                                        value={timetableSettings.secondBreakDuration} 
                                        onChange={e => setTimetableSettings(prev => ({ ...prev, secondBreakDuration: parseInt(e.target.value) || 0 }))} 
                                        className="w-20 text-center text-xl h-12 p-2"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" size="lg" onClick={() => setMode('select')}>
                            Weiter <ArrowRight className="ml-2" />
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    if (mode === 'select') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <Card className="w-full max-w-lg">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">Stundenplan einrichten</CardTitle>
                        <CardDescription>Wähle eine Methode, um deinen Stundenplan hinzuzufügen.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button className="w-full" size="lg" onClick={() => { setMode('manual'); }}>
                            <Edit className="mr-2" /> Manuell eingeben
                        </Button>
                        <Button className="w-full" size="lg" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
                            {isScanning ? <Loader2 className="mr-2 animate-spin"/> : <Camera className="mr-2" />}
                            {isScanning ? "Scanne..." : "Stundenplan scannen (KI)"}
                        </Button>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

                        <Alert className="text-left mt-4">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Datenschutzhinweis</AlertTitle>
                            <AlertDescription>
                                Dein hochgeladenes Dokument wird zur Analyse sicher an eine Google API gesendet und nicht dauerhaft gespeichert.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (mode === 'manual' || mode === 'scan') {
         return (
            <div className="container mx-auto p-4 md:p-8">
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

                 <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black">Stundenplan-Editor</h2>
                        <p className="text-sm text-muted-foreground">Verwalte Fächer, Rotation und Schulzeiten.</p>
                    </div>
                     {isCreatorMode && (
                        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
                        </Button>
                    )}
                 </div>

                {isEditing && (
                     <Card className="mb-6 border-dashed bg-secondary/10">
                        <CardContent className="flex flex-wrap items-center gap-3 p-4">
                            {/* KI Scan Action */}
                            <Button variant="secondary" size="sm" className="font-bold gap-2" onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
                                {isScanning ? <Loader2 className="w-4 h-4 animate-spin"/> : <Camera className="w-4 h-4" />}
                                KI-Scan
                            </Button>
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            
                            <Separator orientation="vertical" className="h-6 hidden sm:block" />

                            {/* Rotation A/B Weeks */}
                            <div className="flex items-center gap-2 bg-background border p-1 px-2 rounded-lg">
                                <Label htmlFor="ab-weeks" className="text-[10px] uppercase font-black cursor-pointer">A/B Wochen</Label>
                                <Switch 
                                    id="ab-weeks" 
                                    checked={timetableSettings.isABWeekActive} 
                                    onCheckedChange={(c) => setTimetableSettings({...timetableSettings, isABWeekActive: c})}
                                />
                            </div>

                            {/* Group Specific: Time Settings */}
                            {isGroupPlan && (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="font-bold gap-2">
                                            <Clock className="w-4 h-4" /> Zeiten
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Schul- & Pausenzeiten (Gruppe)</DialogTitle>
                                            <DialogDescription>Diese Zeiten gelten für den gesamten Plan dieser Gruppe.</DialogDescription>
                                        </DialogHeader>
                                        <div className="grid grid-cols-2 gap-4 py-4">
                                            <div className="space-y-1"><Label>Schulstart</Label><Input type="time" value={timetableSettings.schoolStartTime} onChange={e => setTimetableSettings({...timetableSettings, schoolStartTime: e.target.value})} /></div>
                                            <div className="space-y-1"><Label>Schulende</Label><Input type="time" value={timetableSettings.schoolEndTime} onChange={e => setTimetableSettings({...timetableSettings, schoolEndTime: e.target.value})} /></div>
                                            <div className="space-y-1"><Label>1. Pause (Min.)</Label><Input type="number" value={timetableSettings.firstBreakDuration} onChange={e => setTimetableSettings({...timetableSettings, firstBreakDuration: parseInt(e.target.value) || 0})} /></div>
                                            <div className="space-y-1"><Label>2. Pause (Min.)</Label><Input type="number" value={timetableSettings.secondBreakDuration} onChange={e => setTimetableSettings({...timetableSettings, secondBreakDuration: parseInt(e.target.value) || 0})} /></div>
                                        </div>
                                        <DialogFooter><Button onClick={() => toast({title: "Zeiten temporär übernommen", description: "Speichere den Plan, um die Änderungen dauerhaft zu sichern."})}>OK</Button></DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}

                            <Separator orientation="vertical" className="h-6 hidden sm:block" />

                             <Button variant="ghost" size="sm" onClick={() => importFileInputRef.current?.click()}>
                                <Upload className="mr-2 h-3 w-3" /> Import
                            </Button>
                             <Button variant="ghost" size="sm" onClick={handleExport}>
                                <Download className="mr-2 h-3 w-3" /> Export
                            </Button>
                             <input 
                                type="file" 
                                ref={importFileInputRef} 
                                className="hidden" 
                                accept=".json"
                                onChange={handleImportFileChange}
                            />
                        </CardContent>
                    </Card>
                )}


                 <div className="pb-24">
                     {/* Week Selection for A/B */}
                     {timetableSettings.isABWeekActive && (
                         <div className="flex justify-center mb-6">
                            <Tabs value={activeWeekTab} onValueChange={(v: any) => setActiveWeekTab(v)} className="w-full max-w-xs">
                                <TabsList className="grid grid-cols-2 w-full h-12 rounded-2xl p-1 bg-secondary/50">
                                    <TabsTrigger value="A" className="rounded-xl font-black gap-2"><CalendarDays className="w-4 h-4"/> Woche A</TabsTrigger>
                                    <TabsTrigger value="B" className="rounded-xl font-black gap-2"><RefreshCcw className="w-4 h-4"/> Woche B</TabsTrigger>
                                </TabsList>
                            </Tabs>
                         </div>
                     )}

                     {/* Mobile View: Tabs per Day */}
                     <div className="md:hidden">
                        <Tabs defaultValue="Montag" className="w-full">
                            <TabsList className="grid grid-cols-5 w-full bg-secondary/50 rounded-xl">
                                {weekDays.map(day => (
                                    <TabsTrigger key={day} value={day} className="text-xs px-0 rounded-lg">
                                        {day.slice(0, 2)}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            {weekDays.map(day => (
                                <TabsContent key={day} value={day} className="space-y-4 pt-4 animate-in fade-in slide-in-from-right-2 duration-300">
                                    <h3 className="font-bold text-lg px-2 flex items-center gap-2">
                                        <Badge variant="outline">{day}</Badge>
                                        <span className="text-muted-foreground text-sm font-normal">Tagesplan bearbeiten</span>
                                    </h3>
                                    {timeSlots.map((slot, slotIndex) => {
                                        const entry = timetable[day]?.[slotIndex];
                                        if(!entry) return null;
                                        
                                        // Filter for A/B Weeks
                                        if (timetableSettings.isABWeekActive && entry.rotation !== 'both' && entry.rotation !== activeWeekTab.toLowerCase()) {
                                            // Show indicator that there is something else here? Or just show the input and let it handle rotation
                                        }

                                        return (
                                            <Card key={entry.id} className="p-4 shadow-sm border-2">
                                                <div className="flex justify-between items-center mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">{slotIndex + 1}. Stunde</span>
                                                        {timetableSettings.isABWeekActive && (
                                                            <Badge variant={entry.rotation === 'both' ? 'secondary' : 'default'} className="text-[8px] h-4">
                                                                {entry.rotation === 'both' ? 'Wöchentlich' : `Woche ${entry.rotation?.toUpperCase()}`}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded">{slot.start} - {slot.ende}</span>
                                                </div>
                                                <div className="grid gap-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Fach</Label>
                                                        <Input 
                                                            placeholder="z.B. Mathematik" 
                                                            value={entry.fach || ''} 
                                                            onChange={e => handleInputChange(day, slotIndex, 'fach', e.target.value)}
                                                            className="h-11 rounded-xl"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Lehrer</Label>
                                                            <Input 
                                                                placeholder="Name" 
                                                                value={entry.lehrer || ''} 
                                                                onChange={e => handleInputChange(day, slotIndex, 'lehrer', e.target.value)}
                                                                className="h-10 rounded-xl"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Raum</Label>
                                                            <Input 
                                                                placeholder="Nr." 
                                                                value={entry.room || ''} 
                                                                onChange={e => handleInputChange(day, slotIndex, 'room', e.target.value)}
                                                                className="h-10 rounded-xl"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t mt-1 pt-3">
                                                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={!!entry.hauptfach} 
                                                                onChange={e => handleInputChange(day, slotIndex, 'hauptfach', e.target.checked)}
                                                                className="h-4 w-4 rounded border-gray-300 text-primary"
                                                            />
                                                            Hauptfach
                                                        </label>
                                                        
                                                        {timetableSettings.isABWeekActive && (
                                                            <div className="flex items-center gap-2">
                                                                <Label className="text-[9px] uppercase font-bold text-muted-foreground">Rotation:</Label>
                                                                <Select value={entry.rotation || 'both'} onValueChange={(v: any) => handleInputChange(day, slotIndex, 'rotation', v)}>
                                                                    <SelectTrigger className="h-7 text-[10px] w-28 bg-secondary/30">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="both">Jede Woche</SelectItem>
                                                                        <SelectItem value="a">Nur Woche A</SelectItem>
                                                                        <SelectItem value="b">Nur Woche B</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        )
                                    })}
                                </TabsContent>
                            ))}
                        </Tabs>
                     </div>

                     {/* Desktop View: Full Table */}
                     <div className="hidden md:block overflow-x-auto">
                        <Table className="border min-w-[800px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[150px]">Stunde</TableHead>
                                    {weekDays.map(day => <TableHead key={day}>{day}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {timeSlots.map((slot, slotIndex) => (
                                    <TableRow key={`${slot.start}-${slot.ende}`}>
                                        <TableCell className="font-medium bg-muted/20">
                                            <div className="flex flex-col">
                                                <span className="font-black">{slotIndex + 1}. Stunde</span>
                                                <span className="text-[10px] text-muted-foreground">{slot.start} - {slot.ende}</span>
                                            </div>
                                        </TableCell>
                                        {weekDays.map(day => {
                                            const entry = timetable[day]?.[slotIndex];
                                            if(!entry) return <TableCell key={day}></TableCell>;
                                            
                                            return (
                                                <TableCell key={day} className="p-2 align-top">
                                                    <div className={cn(
                                                        "flex flex-col gap-2 p-2 rounded-lg border bg-card transition-all",
                                                        entry.fach && "border-primary/20 shadow-sm"
                                                    )}>
                                                        <Input 
                                                            placeholder="Fach" 
                                                            value={entry.fach || ''} 
                                                            onChange={e => handleInputChange(day, slotIndex, 'fach', e.target.value)}
                                                            className="h-8 text-xs font-bold"
                                                        />
                                                        <div className="grid grid-cols-2 gap-1">
                                                            <Input 
                                                                placeholder="Lehrer" 
                                                                value={entry.lehrer || ''} 
                                                                onChange={e => handleInputChange(day, slotIndex, 'lehrer', e.target.value)}
                                                                className="h-7 text-[10px]"
                                                                />
                                                            <Input 
                                                                placeholder="Raum" 
                                                                value={entry.room || ''} 
                                                                onChange={e => handleInputChange(day, slotIndex, 'room', e.target.value)}
                                                                className="h-7 text-[10px]"
                                                                />
                                                        </div>
                                                        <div className="flex items-center justify-between gap-1 pt-1">
                                                            <label className="flex items-center gap-1.5 text-[8px] uppercase font-black text-muted-foreground cursor-pointer hover:text-primary transition-colors">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={!!entry.hauptfach} 
                                                                    onChange={e => handleInputChange(day, slotIndex, 'hauptfach', e.target.checked)}
                                                                    className="rounded-sm h-2.5 w-2.5 border-gray-300"
                                                                />
                                                                HF
                                                            </label>

                                                            {timetableSettings.isABWeekActive && (
                                                                <Select value={entry.rotation || 'both'} onValueChange={(v: any) => handleInputChange(day, slotIndex, 'rotation', v)}>
                                                                    <SelectTrigger className="h-5 text-[8px] p-0 px-1 border-none shadow-none w-auto bg-secondary/50">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="both" className="text-[10px]">Wöchentl.</SelectItem>
                                                                        <SelectItem value="a" className="text-[10px]">Woche A</SelectItem>
                                                                        <SelectItem value="b" className="text-[10px]">Woche B</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                     </div>
                 </div>

                 {/* Sticky Save Bar */}
                 <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-md border-t z-40 shadow-2xl">
                    <div className="container mx-auto flex justify-between items-center gap-4">
                        <p className="hidden sm:block text-xs text-muted-foreground italic">Änderungen werden erst beim Speichern übernommen.</p>
                         <Button size="lg" onClick={handleSave} className="w-full sm:w-auto font-black text-lg h-14 sm:h-12 rounded-2xl shadow-lg">
                            <CheckCircle2 className="mr-2 h-5 w-5"/> Plan speichern
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return null;
}
