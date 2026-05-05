
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Download, Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

type UserSettings = {
    scratchpad?: string;
}

export default function Notes() {
  const [notes, setNotes] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'synced'>('idle');
  const { toast } = useToast();
  
  const { user } = useUser();
  const firestore = useFirestore();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const userDocRef = useMemoFirebase(() => 
    user && !user.isAnonymous ? doc(firestore, `users/${user.uid}`) : null
  , [firestore, user]);

  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<{ settings: UserSettings }>(userDocRef);

  // 1. Initial Load: LocalStorage or Guest
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedNotes = localStorage.getItem('scoodol-notes');
      if (savedNotes) {
        setNotes(savedNotes);
      }
    } catch (error) {
      console.error("Could not load notes from localStorage", error);
    }
  }, []);

  // 2. Load from Firestore if available (overwrites local if user is logged in)
  useEffect(() => {
      if (userProfile?.settings?.scratchpad !== undefined) {
          setNotes(userProfile.settings.scratchpad);
      }
  }, [userProfile]);

  // 3. Save Logic
  const handleSave = useCallback(async (currentNotes: string) => {
    // Always save to localStorage for immediate availability
    try {
        localStorage.setItem('scoodol-notes', currentNotes);
    } catch (e) {}

    // Save to Firestore if logged in
    if (user && !user.isAnonymous && userDocRef) {
        setSaveStatus('saving');
        try {
            await setDoc(userDocRef, {
                settings: {
                    scratchpad: currentNotes
                }
            }, { merge: true });
            setSaveStatus('synced');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error("Firestore Save Error:", error);
            setSaveStatus('idle');
        }
    }
  }, [user, userDocRef]);

  const onNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotes(value);
    
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
        handleSave(value);
    }, 1000);
  };

  const handleDownload = useCallback(() => {
    if (!notes) {
        toast({
            variant: 'destructive',
            title: 'Kein Inhalt',
            description: 'Es gibt keine Notizen zum Herunterladen.',
        });
        return;
    }
    const blob = new Blob([notes], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'notizen.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({
        title: 'Heruntergeladen',
        description: 'Deine Notizen wurden als notizen.txt gespeichert.',
    });
  }, [notes, toast]);

  return (
    <Card className="flex flex-col h-full min-h-[60vh]">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
            <CardTitle>Notizen</CardTitle>
            <CardDescription>Ein einfacher Notizblock. Deine Notizen werden automatisch gespeichert.</CardDescription>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {saveStatus === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
            {saveStatus === 'synced' && <Check className="w-3 h-3 text-green-500" />}
            {user && !user.isAnonymous ? (
                <span>{saveStatus === 'saving' ? 'Sichert...' : saveStatus === 'synced' ? 'Gesichert' : 'Cloud-Sync aktiv'}</span>
            ) : (
                <span>Lokal gespeichert</span>
            )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <Textarea
          placeholder="Schreibe hier deine Gedanken auf..."
          value={notes}
          onChange={onNotesChange}
          className="flex-1 w-full h-full resize-none text-base bg-transparent border-none focus-visible:ring-0 p-0 shadow-none"
          aria-label="Notizblock"
          disabled={isLoadingProfile && !!user}
        />
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button onClick={handleDownload} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Als .txt herunterladen
        </Button>
      </CardFooter>
    </Card>
  );
}
