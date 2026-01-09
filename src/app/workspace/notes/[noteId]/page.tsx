
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft, Save, Trash2 } from 'lucide-react';
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

type QuickNote = {
  title: string;
  content: string;
  createdAt: any;
  updatedAt: any;
  ownerId: string;
}

export default function NotePage() {
  const router = useRouter();
  const params = useParams();
  const { noteId } = params;
  const isNewNote = noteId === 'new';

  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const noteDocRef = useMemoFirebase(() => 
    !isNewNote && user && typeof noteId === 'string'
      ? doc(firestore, `users/${user.uid}/quickNotes`, noteId)
      : null
  , [firestore, user, noteId, isNewNote]);

  const { data: note, isLoading: isLoadingNote } = useDoc<QuickNote>(noteDocRef);
  
  useEffect(() => {
      if (note) {
          setTitle(note.title);
          setContent(note.content);
      }
  }, [note]);

  const handleSave = async () => {
    if (!firestore || !user || !title.trim()) {
        toast({ variant: 'destructive', title: 'Titel erforderlich', description: 'Bitte gib einen Titel für deine Notiz ein.' });
        return;
    };
    setIsSaving(true);

    try {
        if (isNewNote) {
            const notesColRef = collection(firestore, `users/${user.uid}/quickNotes`);
            const newDocRef = await addDoc(notesColRef, {
                title,
                content,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            toast({ title: 'Notiz gespeichert!' });
            router.replace(`/workspace/notes/${newDocRef.id}`);
        } else {
            if (!noteDocRef) return;
            await setDoc(noteDocRef, {
                title,
                content,
                updatedAt: serverTimestamp(),
            }, { merge: true });
            toast({ title: 'Änderungen gespeichert!' });
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Fehler', description: 'Die Notiz konnte nicht gespeichert werden.' });
    } finally {
        setIsSaving(false);
    }
  }

  const handleDelete = async () => {
      if (isNewNote || !noteDocRef) return;
      setIsDeleting(true);
      try {
          await deleteDoc(noteDocRef);
          toast({ title: 'Notiz gelöscht!' });
          router.push('/workspace');
      } catch (error) {
           toast({ variant: 'destructive', title: 'Fehler', description: 'Die Notiz konnte nicht gelöscht werden.' });
           setIsDeleting(false);
      }
  }

  const isLoading = isUserLoading || isLoadingNote;

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }
  
  if (!user || user.isAnonymous) {
    router.push('/login');
    return null;
  }

  return (
    <div className="flex flex-col h-screen p-4 md:p-8">
        <header className="flex justify-between items-center mb-6 shrink-0">
            <Button variant="ghost" onClick={() => router.push('/workspace')} className="">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zum Workspace
            </Button>
            <div className="flex gap-2">
                 <Button onClick={handleSave} disabled={isSaving} size="icon">
                    {isSaving ? <Loader2 className="animate-spin"/> : <Save />}
                    <span className="sr-only">Speichern</span>
                </Button>
            </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0">
             <Input 
                placeholder="Gib deiner Notiz einen Titel..."
                className="text-3xl md:text-4xl font-bold border-0 shadow-none focus-visible:ring-0 px-0 h-auto mb-4"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea 
                placeholder="Schreib hier deine Gedanken auf..."
                className="w-full h-full flex-1 border-0 resize-none shadow-none focus-visible:ring-0 p-0 text-base leading-relaxed"
                value={content}
                onChange={(e) => setContent(e.target.value)}
            />
        </main>
    </div>
  );
}
