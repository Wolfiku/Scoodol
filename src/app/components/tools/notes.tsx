
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Notes() {
  const [notes, setNotes] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

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

  useEffect(() => {
    if (isMounted) {
      try {
        localStorage.setItem('scoodol-notes', notes);
      } catch (error) {
        console.error("Could not save notes to localStorage", error);
      }
    }
  }, [notes, isMounted]);

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
      <CardHeader>
        <CardTitle>Notizen</CardTitle>
        <CardDescription>Ein einfacher Notizblock. Deine Notizen werden automatisch gespeichert.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <Textarea
          placeholder="Schreibe hier deine Gedanken auf..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="flex-1 w-full h-full resize-none text-base"
          aria-label="Notizblock"
        />
      </CardContent>
      <CardFooter>
        <Button onClick={handleDownload}>
          <Download className="mr-2" />
          Als .txt herunterladen
        </Button>
      </CardFooter>
    </Card>
  );
}
