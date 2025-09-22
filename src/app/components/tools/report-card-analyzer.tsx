
"use client";

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileUp, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeReportCard } from '@/app/actions';
import type { AnalyzeReportCardOutput } from '@/ai/flows/analyze-report-card';

export default function ReportCardAnalyzer() {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalyzeReportCardOutput | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileClick = () => {
        fileInputRef.current?.click();
    }

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

        setFileName(file.name);
        setIsAnalyzing(true);
        setAnalysisResult(null);

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const dataUri = reader.result as string;
            const result = await analyzeReportCard(dataUri);

            if (result.error) {
                 toast({
                    variant: 'destructive',
                    title: 'Fehler bei der Analyse',
                    description: result.error,
                });
            } else {
                setAnalysisResult(result);
                toast({
                    title: 'Analyse abgeschlossen!',
                    description: 'Dein Zeugnis wurde erfolgreich ausgewertet.',
                });
            }
            setIsAnalyzing(false);
        };
        reader.onerror = () => {
             toast({
                variant: 'destructive',
                title: 'Fehler',
                description: 'Die Bilddatei konnte nicht gelesen werden.',
            });
            setIsAnalyzing(false);
        }
    }

  return (
    <Card>
        <CardHeader>
            <CardTitle>KI-gestützte Zeugnis-Analyse</CardTitle>
            <CardDescription>Lade ein Bild deines Zeugnisses hoch, um eine detaillierte Auswertung zu erhalten.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="p-6 border-2 border-dashed rounded-lg text-center">
                 <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                 <Button onClick={handleFileClick} disabled={isAnalyzing}>
                    <FileUp className="mr-2" /> {isAnalyzing ? "Analysiere..." : "Zeugnis hochladen"}
                 </Button>
                 {fileName && !isAnalyzing && <p className="text-sm text-muted-foreground mt-2">Ausgewählte Datei: {fileName}</p>}
                 {isAnalyzing && (
                    <div className="flex items-center justify-center gap-2 mt-4 text-primary">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Die KI wertet dein Zeugnis aus...</span>
                    </div>
                 )}
            </div>

            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Datenschutzhinweis</AlertTitle>
                <AlertDescription>
                    Dein hochgeladenes Dokument wird zur Analyse sicher an eine Google API gesendet. Es wird nicht dauerhaft gespeichert oder für andere Zwecke verwendet.
                </AlertDescription>
            </Alert>
            
            {analysisResult && (
                <div className="space-y-4">
                    <h3 className="text-xl font-bold">Analyseergebnisse</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader><CardTitle>Gesamtschnitt</CardTitle></CardHeader>
                            <CardContent><p className="text-3xl font-bold text-primary">{analysisResult.overallAverage}</p></CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>Hauptfachschnitt</CardTitle></CardHeader>
                            <CardContent><p className="text-3xl font-bold text-primary">{analysisResult.mainSubjectsAverage}</p></CardContent>
                        </Card>
                    </div>

                    {analysisResult.summary && (
                         <Card>
                            <CardHeader><CardTitle>Textliche Beurteilung (Zusammenfassung)</CardTitle></CardHeader>
                            <CardContent><p className="text-muted-foreground">{analysisResult.summary}</p></CardContent>
                        </Card>
                    )}

                     {analysisResult.statistics && (
                        <Card>
                            <CardHeader><CardTitle>Statistiken</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Schnitt (mündlich)</p>
                                    <p className="text-2xl font-semibold">{analysisResult.statistics.oralAverage || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Schnitt (schriftlich)</p>
                                    <p className="text-2xl font-semibold">{analysisResult.statistics.writtenAverage || 'N/A'}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {analysisResult.grades && analysisResult.grades.length > 0 && (
                         <Card>
                            <CardHeader><CardTitle>Erkannte Noten</CardTitle></CardHeader>
                            <CardContent>
                               <ul className="space-y-2">
                                    {analysisResult.grades.map((g, i) => (
                                        <li key={i} className="flex justify-between items-center p-2 bg-secondary rounded-md">
                                            <div>
                                                <span className="font-semibold">{g.subject}</span>
                                                <span className="text-xs text-muted-foreground ml-2">({g.type})</span>
                                            </div>
                                            <span className="font-bold text-lg">{g.grade}</span>
                                        </li>
                                    ))}
                               </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

        </CardContent>
    </Card>
  );
}

    