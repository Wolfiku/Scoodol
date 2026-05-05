
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Download, Loader2, Check, Save, Upload, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

type UserSettings = {
    notesSlots?: Record<string, string>;
}

const MAX_SLOTS = 15;

export default function Notes() {
  const [editorContent, setEditorContent] = useState('');
  const [activeSlot, setActiveSlot] = useState(1);
  const [isMounted, setIsMounted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'synced'>('idle');
  const { toast } = useToast();
  
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => 
    user && !user.isAnonymous ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);

  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<{ settings: UserSettings }>(userDocRef);

  // 1. Initial Load: LocalStorage for current editor state
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedEditor = localStorage.getItem('scoodol-current-editor');
      if (savedEditor) setEditorContent(savedEditor);
      
      const savedSlot = localStorage.getItem('scoodol-active-slot');
      if (savedSlot) setActiveSlot(parseInt(savedSlot) || 1);
    } catch (error) {}
  }, []);

  // Update local storage when editor content changes
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('scoodol-current-editor', editorContent);
    }
  }, [editorContent, isMounted]);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('scoodol-active-slot', activeSlot.toString());
    }
  }, [activeSlot, isMounted]);

  const handleSaveToSlot = async () => {
    setSaveStatus('saving');
    
    // 1. Update local storage slots
    try {
      const localSlots = JSON.parse(localStorage.getItem('scoodol-notes-slots') || '{}');
      localSlots[activeSlot] = editorContent;
      localStorage.setItem('scoodol-notes-slots', JSON.stringify(localSlots));
    } catch (e) {}

    // 2. Sync to Firestore if logged in
    if (user && !user.isAnonymous && userDocRef) {
        try {
            const currentSlots = userProfile?.settings?.notesSlots || {};
            await setDoc(userDocRef, {
                settings: {
                    notesSlots: {
                        ...currentSlots,
                        [activeSlot]: editorContent
                    }
                }
            }, { merge: true });
            setSaveStatus('synced');
            toast({ title: `Gespeichert in Slot ${activeSlot}` });
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error("Firestore Save Error:", error);
            setSaveStatus('idle');
            toast({ variant: 'destructive', title: 'Fehler beim Cloud-Sync' });
        }
    } else {
        setSaveStatus('synced');
        toast({ title: `Lokal gespeichert in Slot ${activeSlot}` });
        setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleLoadFromSlot = () => {
    let content = '';
    
    // Prefer Cloud Data if logged in
    if (user && !user.isAnonymous && userProfile?.settings?.notesSlots) {
        content = userProfile.settings.notesSlots[activeSlot] || '';
    } else {
        // Fallback to local storage
        try {
            const localSlots = JSON.parse(localStorage.getItem('scoodol-notes-slots') || '{}');
            content = localSlots[activeSlot] || '';
        } catch (e) {}
    }

    setEditorContent(content);
    toast({ title: `Slot ${activeSlot} geladen` });
  };

  const handleDownload = useCallback(() => {
    if (!editorContent) {
        toast({ variant: 'destructive', title: 'Kein Inhalt', description: 'Es gibt nichts zum Herunterladen.' });
        return;
    }
    const blob = new Blob([editorContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notiz-slot-${activeSlot}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Heruntergeladen', description: `Inhalt von Slot ${activeSlot} gespeichert.` });
  }, [editorContent, activeSlot, toast]);

  return (
    <Card className="flex flex-col h-full min-h-[65vh]">
      <CardHeader className="pb-3">
        <div className="flex flex-row items-start justify-between space-y-0 mb-4">
            <div>
                <CardTitle>Notizen Tools</CardTitle>
                <CardDescription>Persönlicher Notizblock mit 15 Cloud-Speicherplätzen.</CardDescription>
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                {saveStatus === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
                {saveStatus === 'synced' && <Check className="w-3 h-3 text-green-500" />}
                {user && !user.isAnonymous ? (
                    <span>Cloud-Sync aktiv</span>
                ) : (
                    <span>Nur Lokal</span>
                )}
            </div>
        </div>

        <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Speicherplatz wählen</span>
            <ScrollArea className="w-full whitespace-nowrap pb-2">
                <div className="flex gap-1.5">
                    {Array.from({ length: MAX_SLOTS }, (_, i) => i + 1).map((slot) => (
                        <Button
                            key={slot}
                            variant={activeSlot === slot ? "default" : "outline"}
                            size="sm"
                            className="h-8 w-8 p-0 rounded-md shrink-0"
                            onClick={() => setActiveSlot(slot)}
                        >
                            {slot}
                        </Button>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col pt-0">
        <div className="flex items-center gap-2 mb-2 p-2 bg-secondary/30 rounded-lg">
             <Button onClick={handleSaveToSlot} variant="ghost" size="sm" className="h-8 gap-2 text-xs font-bold">
                <Save className="h-3.5 w-3.5" /> Speichern
            </Button>
            <Button onClick={handleLoadFromSlot} variant="ghost" size="sm" className="h-8 gap-2 text-xs font-bold">
                <Upload className="h-3.5 w-3.5" /> Laden
            </Button>
            <Button onClick={handleDownload} variant="ghost" size="sm" className="h-8 gap-2 text-xs font-bold">
                <Download className="h-3.5 w-3.5" /> Download
            </Button>
        </div>
        <Textarea
          placeholder={`Inhalt für Slot ${activeSlot} hier eingeben...`}
          value={editorContent}
          onChange={(e) => setEditorContent(e.target.value)}
          className="flex-1 w-full resize-none text-base bg-transparent border-none focus-visible:ring-0 p-2 shadow-none min-h-[300px]"
          aria-label="Notizblock Editor"
          disabled={isLoadingProfile && !!user}
        />
      </CardContent>
      
      <CardFooter className="border-t pt-3 flex items-center justify-between">
         <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground italic">
            <Info className="w-3 h-3" />
            <span>Klicke auf eine Zahl oben, um den Speicherplatz zu wechseln.</span>
         </div>
         {user?.isAnonymous && (
             <span className="text-[10px] font-bold text-amber-600">Melde dich an für Cloud-Backup!</span>
         )}
      </CardFooter>
    </Card>
  );
}
