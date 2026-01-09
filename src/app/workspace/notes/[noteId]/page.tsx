'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft, Save, Check, MoreHorizontal, Info, Share2, Lock, Unlock, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format, formatDistanceToNow, isBefore, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import ShareNoteDialog from '@/app/components/share-note-dialog';


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
  const [isLocked, setIsLocked] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [dateDisplayType, setDateDisplayType] = useState<'updated' | 'created'>('updated');


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

    const handleSave = useCallback(async () => {
    if (!firestore || !user || !title.trim() || isLocked) {
        return;
    };
    setSaveStatus('saving');

    try {
        if (isNewNote) {
            const notesColRef = collection(firestore, `users/${user.uid}/quickNotes`);
            const newDocRef = await addDoc(notesColRef, {
                title: title,
                content: content,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            router.replace(`/workspace/notes/${newDocRef.id}`);

        } else {
            if (!noteDocRef) return;
            await setDoc(noteDocRef, {
                title: title,
                content: content,
                updatedAt: serverTimestamp(),
            }, { merge: true });
        }
        setSaveStatus('idle');

    } catch (error) {
        setSaveStatus('dirty');
    }
  }, [firestore, user, title, content, isNewNote, noteDocRef, router, isLocked]);


  useEffect(() => {
    if (isLoadingNote || isLocked || (note && title === note.title && content === note.content)) {
      return;
    }

    if (title.trim() || content.trim()) {
        setSaveStatus('dirty');
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
            handleSave();
        }, 1500);
    }

    return () => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
    };
  }, [title, content, note, isLoadingNote, handleSave, isLocked]);

  const handleDelete = async () => {
      if(isNewNote || !noteDocRef) return;
      
      await deleteDoc(noteDocRef);
      toast({
          title: "Notiz gelöscht!",
          description: `Die Notiz "${note?.title}" wurde entfernt.`
      });
      router.push('/workspace');
  }


  const getFormattedDate = (timestamp: QuickNote['createdAt'] | undefined, type: 'created' | 'updated') => {
    if (!timestamp) return '';
    const date = new Date(timestamp.seconds * 1000);
    const dayAgo = subDays(new Date(), 1);
    
    if (isBefore(date, dayAgo)) {
      return format(date, "d. MMM. yyyy", { locale: de });
    } else {
      return formatDistanceToNow(date, { addSuffix: true, locale: de });
    }
  };

  const renderSaveStatus = () => {
      switch(saveStatus) {
          case 'saving':
              return <Loader2 className="h-4 w-4 animate-spin" />;
          case 'idle':
              return <Check className="h-4 w-4" />;
          case 'dirty':
          default:
            return <Save className="h-4 w-4" />;
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
       <AlertDialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Notiz-Informationen</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="text-sm space-y-2">
                <p><strong>Titel:</strong> {note?.title || 'Kein Titel'}</p>
                <p><strong>Erstellt:</strong> {note?.createdAt ? format(new Date(note.createdAt.seconds * 1000), "d. MMMM yyyy, HH:mm", { locale: de }) : '...'}</p>
                <p><strong>Zuletzt geändert:</strong> {note?.updatedAt ? format(new Date(note.updatedAt.seconds * 1000), "d. MMMM yyyy, HH:mm", { locale: de }) : '...'}</p>
            </div>
            <AlertDialogFooter>
                <Button onClick={() => setIsInfoDialogOpen(false)}>Schließen</Button>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Notiz wirklich löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Diese Aktion kann nicht rückgängig gemacht werden. Bist du sicher, dass du "{note?.title}" löschen möchtest?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isLocked} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {note && <ShareNoteDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} note={note} />}


      <main className="relative flex-1 flex flex-col min-h-0 p-4 md:p-8">
            <div className="flex items-center gap-4 mb-4">
                <Input 
                    placeholder="Gib deiner Notiz einen Titel..."
                    className="text-3xl md:text-4xl font-bold border-0 shadow-none focus-visible:ring-0 px-0 h-auto flex-1"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    readOnly={isLocked}
                />
                 {isLocked && <Lock className="h-5 w-5 text-green-500" />}
                <div className="flex items-center justify-center h-6 gap-2 text-sm text-muted-foreground">
                    <span className="cursor-pointer hover:text-foreground" onClick={() => setDateDisplayType(dateDisplayType === 'updated' ? 'created' : 'updated')}>
                      {getFormattedDate(note?.[dateDisplayType === 'updated' ? 'updatedAt' : 'createdAt'], dateDisplayType)}
                    </span>
                    {renderSaveStatus()}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => router.back()}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            <span>Zurück</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleSave} disabled={saveStatus !== 'dirty' || isLocked}>
                            <Save className="mr-2 h-4 w-4" />
                            <span>Jetzt speichern</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsInfoDialogOpen(true)} disabled={isNewNote}>
                            <Info className="mr-2 h-4 w-4" />
                            <span>Info</span>
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => setIsShareDialogOpen(true)} disabled={isNewNote}>
                            <Share2 className="mr-2 h-4 w-4" />
                            <span>Teilen</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsLocked(!isLocked)}>
                            {isLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                            <span>{isLocked ? 'Entsperren' : 'Sperren'}</span>
                        </DropdownMenuItem>
                         <DropdownMenuSeparator />
                         <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} disabled={isNewNote || isLocked} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Löschen</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Textarea 
                placeholder="Schreib hier deine Gedanken auf..."
                className="w-full h-full flex-1 border-0 resize-none shadow-none focus-visible:ring-0 p-0 text-base leading-relaxed"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                readOnly={isLocked}
            />
      </main>
    </div>
  );
}
