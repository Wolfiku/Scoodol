
"use client"

import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Camera, Edit, Info, Loader2, Save, Upload, ArrowRight, Sunrise, Sunset, AlertTriangle } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"


type TimetableEntry = {
    id: string;
    fach: string;
    lehrer?: string;
    room?: string;
    start: string;
    ende: string;
    hauptfach?: boolean;
    notizen?: string;
    materialien?: string;
};

type TimetableData = {
    [key: string]: TimetableEntry[];
};

type TimetableSettings = {
    schoolStartTime: string;
    schoolEndTime: string;
    firstBreakDuration: number;
    secondBreakDuration: number;
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
    
    // Afternoon starts where the morning ended (including the last break if applicable)
    let afternoonStartTime = currentTime;
    // But if the school end time is before the calculated end of lessons, use the school end time.
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
                hauptfach: false
            };
        });
    });
    return timetable;
}

export default function SetupView({ onSetupComplete, onTimetableImport, isEditing = false }: { onSetupComplete: (newTimetable: TimetableData, settings: TimetableSettings, profilePicture?: string) => void, onTimetableImport: (importedData: any) => void, isEditing?: boolean }) {
    const [mode, setMode] = useState<'welcome' | 'time-setup' | 'select' | 'manual' | 'scan'>(isEditing ? 'manual' : 'welcome');
    const [timetableSettings, setTimetableSettings] = useState<TimetableSettings>({ schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 });
    const [timetable, setTimetable] = useState<TimetableData>(createInitialTimetable(timetableSettings));
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importFileInputRef = useRef<HTMLInputElement>(null);
    const profilePicInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [showValidationDialog, setShowValidationDialog] = useState(false);
    const [calculatedDuration, setCalculatedDuration] = useState(0);

     useEffect(() => {
        if (isEditing) {
            const savedSettings = localStorage.getItem("timetableSettings");
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                setTimetableSettings(parsedSettings);
                 const savedTimetable = localStorage.getItem("timetable");
                if (savedTimetable) {
                    setTimetable(JSON.parse(savedTimetable));
                } else {
                     setTimetable(createInitialTimetable(parsedSettings));
                }
            }
            const savedPic = localStorage.getItem("profilePicture");
            if (savedPic) {
                setProfilePicture(savedPic);
            }
        }
    }, [isEditing]);
    
    // Regenerate timetable when settings change during setup
    useEffect(() => {
        const existingData = timetable;
        const newTimeSlots = generateTimeSlots(timetableSettings);
        const updatedTimetable: TimetableData = {};

        weekDays.forEach(day => {
            updatedTimetable[day] = newTimeSlots.map((slot, index) => {
                const existingEntry = existingData[day]?.[index];
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
        setTimetable(updatedTimetable);
    }, [timetableSettings]);

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
            // TODO: This should ideally use the globally selected language
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
        toast({ title: "Stundenplan gespeichert!", description: "Die App ist jetzt einsatzbereit."});
        onSetupComplete(timetable, timetableSettings, profilePicture || undefined);
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
                         <Button size="lg" className="w-full" onClick={() => setMode('time-setup')}>Los geht's!</Button>
                         <Button size="lg" variant="outline" className="w-full" onClick={() => importFileInputRef.current?.click()}>
                            <Upload className="mr-2" /> Daten importieren
                        </Button>
                        <input 
                            type="file" 
                            ref={importFileInputRef} 
                            className="hidden" 
                            accept=".json"
                            onChange={handleImportFileChange}
                        />
                    </CardContent>
                    <CardFooter className="flex justify-center gap-4 text-sm">
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


                 <h2 className="text-3xl font-bold mb-2">Stundenplan bearbeiten</h2>
                 <p className="text-muted-foreground mb-6">Trage deine Fächer, Lehrer und Räume ein. Du kannst leere Felder für Pausen oder Freistunden lassen.</p>
                 <div className="overflow-x-auto pb-20">
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
                                     <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{slotIndex + 1}. Stunde</span>
                                            <span className="text-xs text-muted-foreground">{slot.start} - {slot.ende}</span>
                                        </div>
                                     </TableCell>
                                     {weekDays.map(day => {
                                        const entry = timetable[day]?.[slotIndex];
                                        if(!entry) return <TableCell key={day}></TableCell>;
                                        
                                        return (
                                            <TableCell key={day} className="p-1">
                                                <div className="flex flex-col gap-1">
                                                    <Input 
                                                        placeholder="Fach" 
                                                        value={entry.fach || ''} 
                                                        onChange={e => handleInputChange(day, slotIndex, 'fach', e.target.value)}
                                                    />
                                                    <Input 
                                                        placeholder="Lehrer" 
                                                        value={entry.lehrer || ''} 
                                                        onChange={e => handleInputChange(day, slotIndex, 'lehrer', e.target.value)}
                                                        />
                                                     <Input 
                                                        placeholder="Raum" 
                                                        value={entry.room || ''} 
                                                        onChange={e => handleInputChange(day, slotIndex, 'room', e.target.value)}
                                                        />
                                                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer p-1">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={!!entry.hauptfach} 
                                                            onChange={e => handleInputChange(day, slotIndex, 'hauptfach', e.target.checked)}
                                                            className="rounded border-gray-300"
                                                        />
                                                        Hauptfach
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
                 <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t">
                    <div className="container mx-auto flex justify-end">
                         <Button size="lg" onClick={handleSave}>
                            <Save className="mr-2"/> Stundenplan speichern
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return null;
}
