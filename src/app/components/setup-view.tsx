
"use client"

import { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Camera, Edit, Info, Loader2, Save, Upload, Clock } from 'lucide-react';
import { scanTimetableImage } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { Label } from '@/components/ui/label';


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
}

const weekDays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
const timeSlots = [
    "08:00 - 08:45", "08:45 - 09:30", "09:45 - 10:30", "10:30 - 11:15",
    "11:30 - 12:15", "12:15 - 13:00", "13:30 - 14:15", "14:15 - 15:00",
    "15:15 - 16:00", "16:00 - 16:45"
];

const createInitialTimetable = (): TimetableData => {
    const timetable: TimetableData = {};
    weekDays.forEach(day => {
        timetable[day] = timeSlots.map((slot, index) => {
            const [start, end] = slot.split(' - ');
            return {
                id: `${day.slice(0, 2).toLowerCase()}-${index + 1}`,
                fach: '',
                lehrer: '',
                room: '',
                start: start,
                ende: end,
                hauptfach: false
            };
        });
    });
    return timetable;
}

const padTimetable = (timetable: TimetableData): TimetableData => {
    const fullTimetable = createInitialTimetable();
    const paddedTimetable = { ...fullTimetable };
    
    weekDays.forEach(day => {
        if (timetable[day]) {
            // Copy existing entries up to the max length of the new template
            for (let i = 0; i < timeSlots.length; i++) {
                if(timetable[day][i]) {
                    paddedTimetable[day][i] = { ...fullTimetable[day][i], ...timetable[day][i] };
                }
            }
        }
    });

    return paddedTimetable;
}


export default function SetupView({ onSetupComplete, onTimetableImport, isEditing = false }: { onSetupComplete: (newTimetable: TimetableData, settings: TimetableSettings, profilePicture?: string) => void, onTimetableImport: (importedData: any) => void, isEditing?: boolean }) {
    const [mode, setMode] = useState<'welcome' | 'select' | 'manual' | 'scan'>(isEditing ? 'manual' : 'welcome');
    const [timetable, setTimetable] = useState<TimetableData>(createInitialTimetable);
    const [timetableSettings, setTimetableSettings] = useState<TimetableSettings>({ schoolStartTime: '08:00', schoolEndTime: '13:00' });
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importFileInputRef = useRef<HTMLInputElement>(null);
    const profilePicInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

     useEffect(() => {
        if(isEditing) {
            const savedTimetable = localStorage.getItem("timetable");
            if (savedTimetable) {
                const parsedTimetable = JSON.parse(savedTimetable);
                setTimetable(padTimetable(parsedTimetable));
            }
            const savedSettings = localStorage.getItem("timetableSettings");
            if (savedSettings) {
                setTimetableSettings(JSON.parse(savedSettings));
            }
            const savedPic = localStorage.getItem("profilePicture");
            if (savedPic) {
                setProfilePicture(savedPic);
            }
        }
    }, [isEditing]);

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
                const newTimetable = createInitialTimetable();
                Object.keys(result.timetable).forEach(day => {
                    const dayName = day as keyof typeof result.timetable;
                    if(newTimetable[dayName]) {
                        const daySchedule = result.timetable[dayName] || [];
                        daySchedule.forEach(aiEntry => {
                            const slotIndex = timeSlots.findIndex(slot => slot.startsWith(aiEntry.start));
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
    
    const handleSave = () => {
        toast({ title: "Stundenplan gespeichert!", description: "Die App ist jetzt einsatzbereit."});
        onSetupComplete(timetable, timetableSettings, profilePicture || undefined);
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
                         <Button size="lg" className="w-full" onClick={() => setMode('select')}>Los geht's!</Button>
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


    if (mode === 'select') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <Card className="w-full max-w-lg">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">Stundenplan einrichten</CardTitle>
                        <CardDescription>Wähle eine Methode, um deinen Stundenplan hinzuzufügen.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="start-time" className="text-sm font-medium">Schulstart</Label>
                                <Input 
                                    id="start-time"
                                    type="time" 
                                    value={timetableSettings.schoolStartTime} 
                                    onChange={e => setTimetableSettings(prev => ({ ...prev, schoolStartTime: e.target.value }))} 
                                    className="w-full mt-1 text-5xl h-24"
                                />
                            </div>
                            <div>
                                <Label htmlFor="end-time" className="text-sm font-medium">Schulende</Label>
                                <Input 
                                    id="end-time"
                                    type="time" 
                                    value={timetableSettings.schoolEndTime} 
                                    onChange={e => setTimetableSettings(prev => ({ ...prev, schoolEndTime: e.target.value }))} 
                                    className="w-full mt-1 text-5xl h-24"
                                />
                            </div>
                        </div>

                        <div className="relative flex pt-4 items-center">
                            <div className="flex-grow border-t border-muted"></div>
                            <span className="flex-shrink mx-4 text-muted-foreground text-sm">Stundenplan erstellen</span>
                            <div className="flex-grow border-t border-muted"></div>
                        </div>

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
                                 <TableRow key={slot}>
                                     <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{slotIndex + 1}. Stunde</span>
                                            <span className="text-xs text-muted-foreground">{slot}</span>
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

    

    




    