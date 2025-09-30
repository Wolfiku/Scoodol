
"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Camera, Loader2, Info, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { scanVocabularyImage } from '@/app/actions';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useTheme } from "@/hooks/use-theme";
import { useRouter } from 'next/navigation';

type Vocabulary = {
  id: number;
  foreign: string;
  german: string;
};

const shuffleArray = (array: any[]) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}


export default function VokabelPage() {
  const [vocabulary, setVocabulary] = useState<Vocabulary[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newForeign, setNewForeign] = useState('');
  const [newGerman, setNewGerman] = useState('');
  
  const [isScanning, setIsScanning] = useState(false);
  const [showScanInfo, setShowScanInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [quizList, setQuizList] = useState<Vocabulary[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);

  const { toast } = useToast();
  const { aiLanguage } = useTheme();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
    const savedVocabulary = localStorage.getItem("vocabulary");
    if (savedVocabulary) {
      setVocabulary(JSON.parse(savedVocabulary));
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("vocabulary", JSON.stringify(vocabulary));
    }
  }, [vocabulary, isMounted]);

  const resetDialogForm = () => {
    setNewForeign("");
    setNewGerman("");
  };

  const handleOpenDialog = () => {
    resetDialogForm();
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    resetDialogForm();
    setIsDialogOpen(false);
  };

  const handleSaveVocabulary = () => {
    if (!newForeign.trim() || !newGerman.trim()) return;

    const newVocab: Vocabulary = {
      id: Date.now(),
      foreign: newForeign,
      german: newGerman,
    };
    setVocabulary(prev => [...prev, newVocab]);
    toast({ title: 'Neue Vokabel hinzugefügt!' });
    
    handleCloseDialog();
  };
  
  const addMultipleVocabularies = (vocabs: { foreign: string; german: string }[]) => {
      const newVocabs: Vocabulary[] = vocabs.map(v => ({
          id: Date.now() + Math.random(),
          foreign: v.foreign,
          german: v.german,
      }));
      setVocabulary(prev => [...prev, ...newVocabs]);
  }

  const deleteVocabulary = (id: number) => {
    setVocabulary(vocabulary.filter((v) => v.id !== id));
  };
  
  const handleCameraClick = () => {
      setShowScanInfo(true);
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

    setIsScanning(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const dataUri = reader.result as string;
        const result = await scanVocabularyImage(dataUri, aiLanguage);
        
        if (result.error || !result.vocabulary || result.vocabulary.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Fehler beim Scannen',
                description: result.error || 'Die KI konnte keine Vokabeln im Bild finden.',
            });
        } else {
            addMultipleVocabularies(result.vocabulary);
            toast({
                title: 'Vokabeln gescannt!',
                description: `${result.vocabulary.length} neue Vokabel(n) wurde(n) hinzugefügt.`,
            });
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

  const startQuiz = () => {
    setQuizList(shuffleArray([...vocabulary]));
    setCurrentQuizIndex(0);
    setIsQuizActive(true);
  }

  const endQuiz = () => {
    setIsQuizActive(false);
    setQuizList([]);
    setCurrentQuizIndex(0);
  }

  if (!isMounted) {
      return (
        <div className="container mx-auto p-4 md:p-8 flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      );
  }
  
  if (isQuizActive) {
      const currentVocab = quizList[currentQuizIndex];
      return (
          <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[80vh]">
              <Card className="w-full max-w-md text-center">
                  <CardHeader>
                      <CardTitle>Lern-Quiz</CardTitle>
                      <CardDescription>Wische nach links (falsch) oder rechts (richtig).</CardDescription>
                  </CardHeader>
                  <CardContent className="py-12">
                      <p className="text-3xl font-bold">{currentVocab?.foreign}</p>
                  </CardContent>
                  <CardFooter className="flex-col gap-4">
                        <Button className="w-full">Vokabel aufdecken</Button>
                        <Button variant="ghost" onClick={endQuiz}>Quiz beenden</Button>
                  </CardFooter>
              </Card>
          </div>
      )
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
        <Button variant="ghost" onClick={() => router.push('/')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Hauptseite
        </Button>
      <Card className="h-full flex flex-col min-h-[70vh]">
        <CardHeader>
          <CardTitle className="flex flex-wrap gap-4 justify-between items-center">
            <span>Vokabeltrainer</span>
            <div className="flex gap-2">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

              <Dialog open={showScanInfo} onOpenChange={setShowScanInfo}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleCameraClick} disabled={isScanning}>
                    {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                    <span className="sr-only">Vokabeln scannen</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Vokabeln scannen</DialogTitle>
                      <DialogDescription>
                         Mache ein Foto von einer Vokabeltabelle (2 Spalten), um sie automatisch hinzuzufügen.
                      </DialogDescription>
                    </DialogHeader>
                     <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Datenschutzhinweis</AlertTitle>
                        <AlertDescription>
                            Dein Bild wird zur Analyse sicher an eine Google API gesendet und nicht gespeichert.
                        </AlertDescription>
                    </Alert>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowScanInfo(false)}>Abbrechen</Button>
                         <Button onClick={() => {
                             setShowScanInfo(false);
                             fileInputRef.current?.click();
                         }}>
                           <Camera className="mr-2" /> Foto auswählen
                         </Button>
                    </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleOpenDialog}>
                    <Plus className="mr-2" /> Neue Vokabel
                  </Button>
                </DialogTrigger>
                <DialogContent onEscapeKeyDown={handleCloseDialog}>
                  <DialogHeader>
                    <DialogTitle>Neue Vokabel hinzufügen</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Input
                      placeholder="Fremdsprache"
                      value={newForeign}
                      onChange={(e) => setNewForeign(e.target.value)}
                    />
                    <Input
                      placeholder="Deutsch"
                      value={newGerman}
                      onChange={(e) => setNewGerman(e.target.value)}
                    />
                  </div>
                  <DialogFooter className="pt-4 sm:pt-0">
                      <Button variant="outline" onClick={handleCloseDialog}>Abbrechen</Button>
                      <Button onClick={handleSaveVocabulary}>Hinzufügen</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardTitle>
           <CardDescription>Füge Vokabeln hinzu und starte eine Lernsitzung, wenn du bereit bist.</CardDescription>
        </CardHeader>
        <ScrollArea className="flex-1">
          <CardContent className="flex flex-col gap-4">
            {vocabulary.length > 0 ? (
                <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-4 font-semibold px-3">
                        <span className="col-span-1">Fremdsprache</span>
                        <span className="col-span-1">Deutsch</span>
                    </div>
                    {vocabulary.map((v) => (
                    <div
                        key={v.id}
                        className="grid grid-cols-3 gap-4 items-center p-3 rounded-md bg-secondary"
                    >
                        <span className="col-span-1 break-words">{v.foreign}</span>
                        <span className="col-span-1 break-words">{v.german}</span>
                        <div className="flex justify-end">
                            <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteVocabulary(v.id)}
                            className="shrink-0"
                            >
                            <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    ))}
              </div>
            ) : (
                <p className="text-muted-foreground text-center p-8">Noch keine Vokabeln vorhanden. Füge welche hinzu, um zu starten!</p>
            )}
          </CardContent>
        </ScrollArea>
        {vocabulary.length > 0 &&
            <CardFooter className="border-t pt-6">
                <Button className="w-full" size="lg" onClick={startQuiz}>Lern-Quiz starten</Button>
            </CardFooter>
        }
      </Card>
    </div>
  );
}

    