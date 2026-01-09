
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft, Save, Check } from 'lucide-react';

type QuickNote = {
  title: string;
  content: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
  updatedAt: {
    seconds: number;
    nanoseconds: number;
  };
  ownerId: string;
}

type SaveStatus = 'idle' | 'dirty' | 'saving';
type DateDisplayType = 'created' | 'updated';

export default function NotePage() {
  const router = useRouter();
  const params = useParams();
  const { noteId } = params;
  const isNewNote = noteId === 'new';

  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dateDisplayType, setDateDisplayType] = useState<DateDisplayType>('created');

  const noteDocRef = useMemoFirebase(() => 
    !isNewNote && user && typeof noteId === 'string'
      ? doc(firestore, `users/${user.uid}/quickNotes`, noteId)
      : null
  , [firestore, user, noteId, isNewNote]);

  const { data: note, isLoading: isLoadingNote } = useDoc<QuickNote>(noteDocRef);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  
  useEffect(() => {
      if (note) {
          setTitle(note.title);
          setContent(note.content);
          setSaveStatus('idle');
      }
  }, [note]);

    const handleSave = useCallback(async (currentTitle: string, currentContent: string) => {
    if (!firestore || !user || !currentTitle.trim()) {
        return;
    };
    setSaveStatus('saving');

    try {
        if (isNewNote) {
            const notesColRef = collection(firestore, `users/${user.uid}/quickNotes`);
            const newDocRef = await addDoc(notesColRef, {
                title: currentTitle,
                content: currentContent,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
             // After creating, redirect to the new note's URL to enable further auto-saving
            router.replace(`/workspace/notes/${newDocRef.id}`);

        } else {
            if (!noteDocRef) return;
            await setDoc(noteDocRef, {
                title: currentTitle,
                content: currentContent,
                updatedAt: serverTimestamp(),
            }, { merge: true });
        }
        setSaveStatus('idle');

    } catch (error) {
        setSaveStatus('dirty'); // Revert to dirty if save fails
    }
  }, [firestore, user, isNewNote, noteDocRef, router]);


  useEffect(() => {
    if (isLoadingNote || (note && title === note.title && content === note.content)) {
      return;
    }

    if (title.trim() || content.trim()) {
        setSaveStatus('dirty');
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
            handleSave(title, content);
        }, 1500); // 1.5 second delay
    }

    return () => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
    };
  }, [title, content, note, isLoadingNote, handleSave]);


  const getFormattedDate = () => {
    if (!note) return null;
    const dateToShow = dateDisplayType === 'created' ? note.createdAt : note.updatedAt;
    if (!dateToShow) return null;

    const date = new Date(dateToShow.seconds * 1000);
    const formattedDate = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
    
    return formattedDate;
  }
  
  const toggleDateDisplay = () => {
      if (note && note.updatedAt && note.createdAt.seconds !== note.updatedAt.seconds) {
        setDateDisplayType(prev => prev === 'created' ? 'updated' : 'created');
      }
  }


  const renderSaveStatus = () => {
      switch(saveStatus) {
          case 'saving':
              return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
          case 'idle':
              return <Check className="h-4 w-4 text-green-500" />;
          case 'dirty':
          default:
            return <Save className="h-4 w-4 text-muted-foreground" />;
      }
  }


  const isLoading = isUserLoading || isLoadingNote;

  if (isLoading && !isNewNote) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }
  
  if (!isUserLoading && (!user || user.isAnonymous)) {
    router.push('/login');
    return null;
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="relative flex-1 flex flex-col min-h-0 p-4 md:p-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/workspace')} className="absolute top-4 left-4 md:top-8 md:left-8 z-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <main className="flex-1 flex flex-col min-h-0 pt-12">
            <Input 
              placeholder="Gib deiner Notiz einen Titel..."
              className="text-3xl md:text-4xl font-bold border-0 shadow-none focus-visible:ring-0 px-0 h-auto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading && !isNewNote}
            />

            <div className="flex justify-end items-center gap-4 py-2">
              <Button 
                  variant="ghost" 
                  onClick={toggleDateDisplay} 
                  className="text-xs text-muted-foreground px-2 h-auto"
                  disabled={!note?.updatedAt || note.createdAt.seconds === note.updatedAt.seconds}
                >
                  {getFormattedDate()}
              </Button>
              <div className="flex items-center justify-center h-6 w-6">
                 {renderSaveStatus()}
              </div>
            </div>

            <Textarea 
              placeholder="Schreib hier deine Gedanken auf..."
              className="w-full h-full flex-1 border-0 resize-none shadow-none focus-visible:ring-0 p-0 text-base leading-relaxed"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isLoading && !isNewNote}
            />
        </main>
      </div>
    </div>
  );
}
