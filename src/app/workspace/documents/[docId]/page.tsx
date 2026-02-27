
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Loader2, ArrowLeft, Bold, Italic, Underline, Link as LinkIcon, 
    Table, Image as ImageIcon, Video, AlignLeft, AlignCenter, AlignRight, 
    List, ListOrdered, Save, Check, Type, MoreHorizontal, Trash2, ChevronDown,
    Strikethrough
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type TextDocument = {
  title: string;
  content: string;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
};

type SaveStatus = 'idle' | 'dirty' | 'saving';

export default function TextDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const docId = params?.docId as string;
  const isNewDoc = docId === 'new';

  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  
  const [title, setTitle] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMediaDialogOpen, setIsMediaDialogOpen] = useState<{type: 'image' | 'video' | 'link', open: boolean}>({type: 'link', open: false});
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaText, setMediaText] = useState('');

  const docRef = useMemoFirebase(() => 
    !isNewDoc && user && typeof docId === 'string'
      ? doc(firestore, `users/${user.uid}/documents`, docId)
      : null
  , [firestore, user, docId, isNewDoc]);

  const { data: documentData, isLoading: isLoadingDoc } = useDoc<TextDocument>(docRef);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (documentData) {
      setTitle(documentData.title);
      if (editorRef.current && editorRef.current.innerHTML !== documentData.content) {
        editorRef.current.innerHTML = documentData.content;
      }
      setSaveStatus('idle');
    }
  }, [documentData]);

  const handleSave = useCallback(async () => {
    if (!firestore || !user || !title.trim()) return;
    setSaveStatus('saving');

    const content = editorRef.current?.innerHTML || '';

    try {
      if (isNewDoc) {
        const docsColRef = collection(firestore, `users/${user.uid}/documents`);
        const newDocRef = await addDoc(docsColRef, {
          title,
          content,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        router.replace(`/workspace/documents/${newDocRef.id}`);
      } else {
        if (!docRef) return;
        await setDoc(docRef, {
          title,
          content,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      setSaveStatus('idle');
    } catch (error) {
      setSaveStatus('dirty');
    }
  }, [firestore, user, title, isNewDoc, docRef, router]);

  const triggerAutoSave = () => {
    setSaveStatus('dirty');
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(handleSave, 2000);
  };

  const execCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    triggerAutoSave();
  };

  const insertTable = () => {
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0; border: 1px solid #ddd;">
        <thead>
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px; background: #f9f9f9;">Spalte 1</th>
            <th style="border: 1px solid #ddd; padding: 8px; background: #f9f9f9;">Spalte 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">Zelle 1</td>
            <td style="border: 1px solid #ddd; padding: 8px;">Zelle 2</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    execCommand('insertHTML', tableHtml);
  };

  const handleMediaInsert = () => {
    if (!mediaUrl.trim()) return;

    if (isMediaDialogOpen.type === 'link') {
        execCommand('createLink', mediaUrl);
    } else if (isMediaDialogOpen.type === 'image') {
        const imgHtml = `<img src="${mediaUrl}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0;" alt="Eingefügtes Bild" />`;
        execCommand('insertHTML', imgHtml);
    } else if (isMediaDialogOpen.type === 'video') {
        // Basic iframe support for YouTube etc.
        let embedUrl = mediaUrl;
        if (mediaUrl.includes('youtube.com/watch?v=')) {
            embedUrl = mediaUrl.replace('watch?v=', 'embed/');
        } else if (mediaUrl.includes('youtu.be/')) {
            embedUrl = mediaUrl.replace('youtu.be/', 'youtube.com/embed/');
        }
        const videoHtml = `
            <div style="position: relative; padding-bottom: 56.25%; height: 0; margin: 15px 0;">
                <iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 12px;" frameborder="0" allowfullscreen></iframe>
            </div>
            <p><br></p>
        `;
        execCommand('insertHTML', videoHtml);
    }

    setMediaUrl('');
    setIsMediaDialogOpen({ ...isMediaDialogOpen, open: false });
  };

  const handleDelete = async () => {
    if (isNewDoc || !docRef) return;
    await deleteDoc(docRef);
    toast({ title: 'Dokument gelöscht' });
    router.push('/workspace');
  };

  if (isUserLoading || (isLoadingDoc && !isNewDoc)) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  return (
    <div className="flex flex-col h-screen bg-secondary/10">
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Dokument wirklich löschen?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isMediaDialogOpen.open} onOpenChange={(open) => setIsMediaDialogOpen({...isMediaDialogOpen, open})}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>
                    {isMediaDialogOpen.type === 'link' ? 'Link einfügen' : isMediaDialogOpen.type === 'image' ? 'Bild-URL einfügen' : 'Video-URL einfügen'}
                </DialogTitle>
                <DialogDescription>
                    Gib die URL ein, die du dem Dokument hinzufügen möchtest.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input id="url" placeholder="https://..." value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} autoFocus />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsMediaDialogOpen({...isMediaDialogOpen, open: false})}>Abbrechen</Button>
                <Button onClick={handleMediaInsert}>Einfügen</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <header className="bg-background border-b p-4 flex flex-col gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
                <Button variant="ghost" size="icon" onClick={() => router.push('/workspace')}><ArrowLeft className="h-5 w-5" /></Button>
                <Input 
                    placeholder="Titel des Dokuments..." 
                    className="text-xl font-bold border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent flex-1"
                    value={title}
                    onChange={e => { setTitle(e.target.value); triggerAutoSave(); }}
                />
            </div>
            <div className="flex items-center gap-2 ml-4">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                    {saveStatus === 'saving' ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3"/>}
                    {saveStatus === 'saving' ? 'Speichert...' : 'Gespeichert'}
                </span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleSave} disabled={saveStatus !== 'dirty'}><Save className="mr-2 h-4 w-4" /> Manuell speichern</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Löschen</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-secondary/30 rounded-lg overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 border-r pr-2 mr-1">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-1"><Type className="h-4 w-4" /> <ChevronDown className="h-3 w-3" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => execCommand('fontName', 'Arial')}>Standard (Arial)</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontName', 'Georgia')}>Serifen (Georgia)</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontName', 'Courier New')}>Code (Courier)</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-1 font-bold">A <ChevronDown className="h-3 w-3" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => execCommand('fontSize', '2')}>Klein</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontSize', '3')}>Normal</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontSize', '5')}>Groß</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontSize', '7')}>Riesig</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex items-center gap-1 border-r pr-2 mr-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('bold')}><Bold className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('italic')}><Italic className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('underline')}><Underline className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('strikethrough')}><Strikethrough className="h-4 w-4" /></Button>
            </div>

            <div className="flex items-center gap-1 border-r pr-2 mr-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('justifyLeft')}><AlignLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('justifyCenter')}><AlignCenter className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('justifyRight')}><AlignRight className="h-4 w-4" /></Button>
            </div>

            <div className="flex items-center gap-1 border-r pr-2 mr-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('insertUnorderedList')}><List className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('insertOrderedList')}><ListOrdered className="h-4 w-4" /></Button>
            </div>

            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMediaDialogOpen({type: 'link', open: true})}><LinkIcon className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={insertTable}><Table className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMediaDialogOpen({type: 'image', open: true})}><ImageIcon className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMediaDialogOpen({type: 'video', open: true})}><Video className="h-4 w-4" /></Button>
            </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-12 flex justify-center">
        <div className="w-full max-w-4xl bg-background shadow-lg rounded-xl min-h-[1000px] p-8 md:p-16">
            <div 
                ref={editorRef}
                contentEditable
                className="w-full h-full outline-none prose dark:prose-invert max-w-none text-lg leading-relaxed focus:ring-0"
                onInput={triggerAutoSave}
                spellCheck="false"
                style={{ fontFamily: 'inherit' }}
            />
        </div>
      </main>

      <style jsx global>{`
        [contenteditable]:empty:before {
          content: 'Schreibe hier dein Dokument...';
          color: #a1a1aa;
          cursor: text;
        }
        table td, table th {
            min-width: 50px;
        }
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
