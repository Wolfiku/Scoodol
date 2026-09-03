
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
import { Separator } from '@/components/ui/separator';


type TimetableEntry = {
    id: string;
    fach: string;
    lehrer?: string;
    room?: string;
    start: string;
    ende: string;
    hauptfach?: boolean;
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
            };
        });
    });
    return timetable;
}

type UserData = {
    timetable: TimetableData | { weekA: TimetableData, weekB: TimetableData },
    timetableSettings: TimetableSettings,
    settings: {
        profilePicture?: string,
    }
}

export default function SetupView({ onSetupComplete, onTimetableImport, initialData, isEditing = false, isCreatorMode = false, viewMode = 'setup', isGroupPlan = false }: { onSetupComplete: (userData: Partial<UserData>) => void, onTimetableImport: (importedData: any) => void, initialData?: Partial<UserData>, isEditing?: boolean, isCreatorMode?: boolean, viewMode?: 'setup' | 'creator' | 'edit', isGroupPlan?: boolean }) {
    const [mode, setMode] = useState<'welcome' | 'time-setup' | 'select' | 'manual' | 'scan'>(isEditing ? 'manual' : 'welcome');
    
    const [timetableSettings, setTimetableSettings] = useState<TimetableSettings>(initialData?.timetableSettings || { schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15, isABWeekActive: false });
    
    // Complex A/B Logic
    const [timetableA, setTimetableA] = useState<TimetableData>(() => {
        if (initialData?.timetable) {
            // @ts-ignore
            if (initialData.timetable.weekA) return initialData.timetable.weekA;
            return initialData.timetable as TimetableData;
        }
        return createInitialTimetable(timetableSettings);
    });

    const [timetableB, setTimetableB] = useState<TimetableData>(() => {
        // @ts-ignore
        if (initialData?.timetable?.weekB) return initialData.timetable.weekB;
        return createInitialTimetable(timetableSettings);
    });
    
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

    // Auto-Sync week B if it's empty when A/B is activated
    useEffect(() => {
        if (timetableSettings.isABWeekActive) {
            const isBEmpty = Object.values(timetableB).every(day => day.every(entry => !entry.fach));
            if (isBEmpty) {
                // Clone week A to week B
                const clonedB = JSON.parse(JSON.stringify(timetableA));
                setTimetableB(clonedB);
                toast({ title: "Plan für Woche B kopiert", description: "Woche B ist jetzt erst einmal identisch mit Woche A." });
            }
        }
    }, [timetableSettings.isABWeekActive]);

    const activeTimetable = activeWeekTab === 'A' ? timetableA : timetableB;
    const setActiveTimetable = activeWeekTab === 'A' ? setTimetableA : setTimetableB;

    // Regenerate time slots in entries when settings change
    useEffect(() => {
        const newTimeSlots = generateTimeSlots(timetableSettings);
        
        const updateSlots = (currentTable: TimetableData) => {
            const updated: TimetableData = {};
            weekDays.forEach(day => {
                updated[day] = newTimeSlots.map((slot, index) => {
                    const existingEntry = currentTable[day]?.[index];
                    return {
                        id: existingEntry?.id || `${day.slice(0, 2).toLowerCase()}-${index + 1}`,
                        fach: existingEntry?.fach || '',
                        lehrer: existingEntry?.lehrer || '',
                        room: existingEntry?.room || '',
                        start: slot.start,
                        ende: slot.ende,
                        hauptfach: existingEntry?.hauptfach || false,
                    };
                });
            });
            return updated;
        };

        setTimetableA(prev => updateSlots(prev));
        setTimetableB(prev => updateSlots(prev));
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
                                };
                            }
                        })
                    }
                })
                setActiveTimetable(newTimetable);
                toast({
                    title: 'Stundenplan gescannt!',
                    description: `Der Plan wurde in Woche ${activeWeekTab} eingefügt.`,
                });
                setMode('manual');
            }
            setIsScanning(false);
        };
    }
    
    const handleInputChange = (day: string, slotIndex: number, field: keyof TimetableEntry, value: string | boolean) => {
        setActiveTimetable(prev => {
            const updated = { ...prev };
            // @ts-ignore
            updated[day][slotIndex][field] = value;
            return updated;
        });
    }
    
    const proceedWithSave = () => {
        const dataToSave: Partial<UserData> = {
            timetable: timetableSettings.isABWeekActive 
                ? { weekA: timetableA, weekB: timetableB }
                : timetableA,
            timetableSettings,
            settings: {
                profilePicture: profilePicture || undefined,
            }
        };
        onSetupComplete(dataToSave);
        toast({ title: "Stundenplan gespeichert!" });
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
                toast({ variant: 'destructive', title: "Importfehler" });
            }
        };
        reader.readAsText(file);
    }
    
     const handleExport = () => {
        try {
            const dataToExport = {
                timetable: timetableSettings.isABWeekActive ? { weekA: timetableA, weekB: timetableB } : timetableA,
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
            toast({ title: "Export erfolgreich" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Fehler beim Export" });
        }
    }

    if (mode === 'welcome') {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <Card className="w-full max-w-lg text-center">
                    <CardHeader className="items-center">
                        <Avatar className="h-24 w-24 mb-4 cursor-pointer" onClick={() => profilePicInputRef.current?.click()}>
                           <AvatarImage src={profilePicture || undefined} />
                            <AvatarFallback><User className="h-12 w-12" /></AvatarFallback>
                        </Avatar>
                        <input type="file" accept="image/*" ref={profilePicInputRef} onChange={(e) => {
                             const file = e.target.files?.[0];
                             if (file) {
                                 const reader = new FileReader();
                                 reader.readAsDataURL(file);
                                 reader.onload = () => setProfilePicture(reader.result as string);
                             }
                        }} className="hidden" />
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
                                <Button size="lg" variant="outline" className="w-full" asChild><Link href="/login">Anmelden</Link></Button>
                             </>
                         )}
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (mode === 'time-setup') {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <Card className="w-full max-w-lg text-center">
                    <CardHeader><CardTitle className="text-2xl">Deine Schul- & Pausenzeiten</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6">
                        <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-secondary/50">
                            <Label className="flex items-center gap-2 text-lg font-semibold"><Sunrise className="text-amber-500" /> Schulstart</Label>
                            <Input type="time" value={timetableSettings.schoolStartTime} onChange={e => setTimetableSettings(prev => ({ ...prev, schoolStartTime: e.target.value }))} className="w-auto text-2xl h-14 p-2" />
                        </div>
                        <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-secondary/50">
                            <Label className="flex items-center gap-2 text-lg font-semibold"><Sunset className="text-orange-500" /> Schulende</Label>
                            <Input type="time" value={timetableSettings.schoolEndTime} onChange={e => setTimetableSettings(prev => ({ ...prev, schoolEndTime: e.target.value }))} className="w-auto text-2xl h-14 p-2" />
                        </div>
                    </CardContent>
                    <CardFooter><Button className="w-full" size="lg" onClick={() => setMode('select')}>Weiter <ArrowRight className="ml-2" /></Button></CardFooter>
                </Card>
            </div>
        )
    }

    if (mode === 'select') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <Card className="w-full max-w-lg">
                    <CardHeader className="text-center"><CardTitle className="text-2xl">Stundenplan einrichten</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <Button className="w-full" size="lg" onClick={() => setMode('manual')}><Edit className="mr-2" /> Manuell eingeben</Button>
                        <Button className="w-full" size="lg" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
                            {isScanning ? <Loader2 className="mr-2 animate-spin"/> : <Camera className="mr-2" />}
                            {isScanning ? "Scanne..." : "Stundenplan scannen (KI)"}
                        </Button>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
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
                        <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-amber-500" /> Ungewöhnliche Stundendauer</AlertDialogTitle>
                        <AlertDialogDescription>Unterrichtsstunde dauert <strong>{calculatedDuration} Minuten</strong>. Bist du sicher?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={proceedWithSave}>Trotzdem speichern</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                 <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black">Stundenplan-Editor</h2>
                        <p className="text-sm text-muted-foreground">Verwalte deine Fächer und die Schulwochen.</p>
                    </div>
                 </div>

                 <Card className="mb-6 border-dashed bg-secondary/10">
                    <CardContent className="flex flex-wrap items-center gap-3 p-4">
                        <Button variant="secondary" size="sm" className="font-bold gap-2" onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
                            {isScanning ? <Loader2 className="w-4 h-4 animate-spin"/> : <Camera className="w-4 h-4" />} KI-Scan
                        </Button>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <Separator orientation="vertical" className="h-6 hidden sm:block" />
                        <div className="flex items-center gap-2 bg-background border p-1 px-2 rounded-lg">
                            <Label htmlFor="ab-weeks" className="text-[10px] uppercase font-black cursor-pointer">A/B Wochen</Label>
                            <Switch id="ab-weeks" checked={timetableSettings.isABWeekActive} onCheckedChange={(c) => setTimetableSettings({...timetableSettings, isABWeekActive: c})} />
                        </div>
                        <Separator orientation="vertical" className="h-6 hidden sm:block" />
                        <Button variant="ghost" size="sm" onClick={() => importFileInputRef.current?.click()}><Upload className="mr-2 h-3 w-3" /> Import</Button>
                        <Button variant="ghost" size="sm" onClick={handleExport}><Download className="mr-2 h-3 w-3" /> Export</Button>
                    </CardContent>
                </Card>

                 <div className="pb-24">
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

                     {/* Mobile View */}
                     <div className="md:hidden">
                        <Tabs defaultValue="Montag" className="w-full">
                            <TabsList className="grid grid-cols-5 w-full bg-secondary/50 rounded-xl">
                                {weekDays.map(day => <TabsTrigger key={day} value={day} className="text-xs px-0 rounded-lg">{day.slice(0, 2)}</TabsTrigger>)}
                            </TabsList>
                            {weekDays.map(day => (
                                <TabsContent key={day} value={day} className="space-y-4 pt-4">
                                    {timeSlots.map((slot, slotIndex) => {
                                        const entry = activeTimetable[day]?.[slotIndex];
                                        if(!entry) return null;
                                        return (
                                            <Card key={entry.id} className="p-4 shadow-sm border-2">
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-xs font-black uppercase text-muted-foreground">{slotIndex + 1}. Stunde</span>
                                                    <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded">{slot.start} - {slot.ende}</span>
                                                </div>
                                                <div className="grid gap-3">
                                                    <Input placeholder="Fach" value={entry.fach || ''} onChange={e => handleInputChange(day, slotIndex, 'fach', e.target.value)} className="h-11 rounded-xl" />
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Input placeholder="Lehrer" value={entry.lehrer || ''} onChange={e => handleInputChange(day, slotIndex, 'lehrer', e.target.value)} className="h-10 rounded-xl" />
                                                        <Input placeholder="Raum" value={entry.room || ''} onChange={e => handleInputChange(day, slotIndex, 'room', e.target.value)} className="h-10 rounded-xl" />
                                                    </div>
                                                </div>
                                            </Card>
                                        )
                                    })}
                                </TabsContent>
                            ))}
                        </Tabs>
                     </div>

                     {/* Desktop View */}
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
                                            const entry = activeTimetable[day]?.[slotIndex];
                                            if(!entry) return <TableCell key={day}></TableCell>;
                                            return (
                                                <TableCell key={day} className="p-2 align-top">
                                                    <div className={cn("flex flex-col gap-2 p-2 rounded-lg border bg-card transition-all", entry.fach && "border-primary/20 shadow-sm")}>
                                                        <Input placeholder="Fach" value={entry.fach || ''} onChange={e => handleInputChange(day, slotIndex, 'fach', e.target.value)} className="h-8 text-xs font-bold" />
                                                        <div className="grid grid-cols-2 gap-1">
                                                            <Input placeholder="Lehrer" value={entry.lehrer || ''} onChange={e => handleInputChange(day, slotIndex, 'lehrer', e.target.value)} className="h-7 text-[10px]" />
                                                            <Input placeholder="Raum" value={entry.room || ''} onChange={e => handleInputChange(day, slotIndex, 'room', e.target.value)} className="h-7 text-[10px]" />
                                                        </div>
                                                        <label className="flex items-center gap-1.5 text-[8px] uppercase font-black text-muted-foreground cursor-pointer">
                                                            <input type="checkbox" checked={!!entry.hauptfach} onChange={e => handleInputChange(day, slotIndex, 'hauptfach', e.target.checked)} className="rounded-sm h-2.5 w-2.5" /> HF
                                                        </label>
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

                 <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/70 backdrop-blur-md border-t z-40 shadow-2xl">
                    <div className="container mx-auto flex justify-between items-center gap-4">
                        <p className="hidden sm:block text-xs text-muted-foreground italic">Änderungen werden erst beim Speichern übernommen.</p>
                        <Button size="lg" onClick={handleSave} className="w-full sm:w-auto font-black text-lg h-14 sm:h-12 rounded-2xl shadow-lg"><CheckCircle2 className="mr-2 h-5 w-5"/> Plan speichern</Button>
                    </div>
                </div>
            </div>
        )
    }

    return null;
}
