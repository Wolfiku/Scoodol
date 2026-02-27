
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
    Table as TableIcon, Image as ImageIcon, Video, AlignLeft, AlignCenter, AlignRight, 
    List, ListOrdered, Save, Check, Type, MoreHorizontal, Trash2, ChevronDown,
    Strikethrough, Palette, Highlighter, Grid3X3, PlusSquare, MinusSquare,
    Indent, Outdent
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
      <div class="table-container" style="margin: 1.5em 0; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #ddd; border-radius: 8px;">
          <thead>
            <tr style="background-color: #f4f4f5;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Kopfzeile 1</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Kopfzeile 2</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #ddd; padding: 12px;">Inhalt 1</td>
              <td style="border: 1px solid #ddd; padding: 12px;">Inhalt 2</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p><br></p>
    `;
    execCommand('insertHTML', tableHtml);
  };

  // Advanced Table Controls
  const getTableUnderCursor = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return null;
    let node = selection.getRangeAt(0).startContainer;
    while (node && node !== editorRef.current) {
      if (node.nodeName === 'TABLE') return node as HTMLTableElement;
      node = node.parentNode as Node;
    }
    return null;
  };

  const addRow = () => {
    const table = getTableUnderCursor();
    if (!table) return;
    const row = table.insertRow();
    for (let i = 0; i < table.rows[0].cells.length; i++) {
      const cell = row.insertCell();
      cell.innerHTML = 'Neu';
      cell.style.border = '1px solid #ddd';
      cell.style.padding = '12px';
    }
    triggerAutoSave();
  };

  const addColumn = () => {
    const table = getTableUnderCursor();
    if (!table) return;
    for (let i = 0; i < table.rows.length; i++) {
      const cell = table.rows[i].insertCell();
      cell.innerHTML = 'Neu';
      cell.style.border = '1px solid #ddd';
      cell.style.padding = '12px';
      if (i === 0 && table.tHead) {
          cell.style.backgroundColor = '#f4f4f5';
          cell.style.fontWeight = 'bold';
      }
    }
    triggerAutoSave();
  };

  const deleteCurrentTable = () => {
    const table = getTableUnderCursor();
    if (!table) return;
    table.remove();
    triggerAutoSave();
  };

  const deleteRow = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      let node = selection.getRangeAt(0).startContainer;
      while (node && node.nodeName !== 'TR') node = node.parentNode as Node;
      if (node) {
          (node as HTMLTableRowElement).remove();
          triggerAutoSave();
      }
  }

  const handleMediaInsert = () => {
    if (!mediaUrl.trim()) return;

    if (isMediaDialogOpen.type === 'link') {
        execCommand('createLink', mediaUrl);
    } else if (isMediaDialogOpen.type === 'image') {
        const imgHtml = `<img src="${mediaUrl}" style="max-width: 100%; height: auto; border-radius: 12px; margin: 1.5em 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" alt="Eingefügtes Bild" />`;
        execCommand('insertHTML', imgHtml);
    } else if (isMediaDialogOpen.type === 'video') {
        let embedUrl = mediaUrl;
        if (mediaUrl.includes('youtube.com/watch?v=')) {
            embedUrl = mediaUrl.replace('watch?v=', 'embed/');
        } else if (mediaUrl.includes('youtu.be/')) {
            embedUrl = mediaUrl.replace('youtu.be/', 'youtube.com/embed/');
        }
        const videoHtml = `
            <div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; margin: 2em 0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                <iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
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
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
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
                    Gib die URL für dein Medium ein.
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

      <header className="bg-background border-b p-4 flex flex-col gap-4 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
                <Button variant="ghost" size="icon" onClick={() => router.push('/workspace')}><ArrowLeft className="h-5 w-5" /></Button>
                <Input 
                    placeholder="Titel des Dokuments..." 
                    className="text-2xl font-black border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent flex-1"
                    value={title}
                    onChange={e => { setTitle(e.target.value); triggerAutoSave(); }}
                />
            </div>
            <div className="flex items-center gap-2 ml-4">
                <span className="text-[10px] uppercase font-black text-muted-foreground flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded">
                    {saveStatus === 'saving' ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3"/>}
                    {saveStatus === 'saving' ? 'Wird gespeichert' : 'Gespeichert'}
                </span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={handleSave} disabled={saveStatus !== 'dirty'}><Save className="mr-2 h-4 w-4" /> Manuell speichern</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Löschen</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-secondary/20 rounded-xl overflow-x-auto no-scrollbar border">
            {/* Fonts & Sizes */}
            <div className="flex items-center gap-1 border-r pr-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-1 font-bold text-xs"><Type className="h-4 w-4" /> <ChevronDown className="h-3 w-3" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => execCommand('fontName', 'Arial')}>Standard (Sans)</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontName', 'Georgia')}>Serifen (Schule)</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontName', 'Courier New')}>Code (Mono)</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-1 font-black">A <ChevronDown className="h-3 w-3" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => execCommand('fontSize', '2')}>Klein</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontSize', '3')}>Normal</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontSize', '5')}>Groß</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontSize', '7')}>Sehr Groß</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Basic Style */}
            <div className="flex items-center gap-1 border-r pr-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('bold')} title="Fett"><Bold className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('italic')} title="Kursiv"><Italic className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('underline')} title="Unterstrichen"><Underline className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('strikethrough')} title="Durchgestrichen"><Strikethrough className="h-4 w-4" /></Button>
            </div>

            {/* Colors */}
            <div className="flex items-center gap-1 border-r pr-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Textfarbe"><Palette className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2">
                        {['#000000', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4', '#10b981'].map(color => (
                            <button key={color} className="w-6 h-6 rounded-full border border-border" style={{ backgroundColor: color }} onClick={() => execCommand('foreColor', color)} />
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Hintergrundfarbe"><Highlighter className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2">
                        {['#ffffff', '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa', '#ccfbf1', '#f3f4f6', '#ffedd5'].map(color => (
                            <button key={color} className="w-6 h-6 rounded-full border border-border" style={{ backgroundColor: color }} onClick={() => execCommand('hiliteColor', color)} />
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Alignment & Lists */}
            <div className="flex items-center gap-1 border-r pr-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('justifyLeft')}><AlignLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('justifyCenter')}><AlignCenter className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('justifyRight')}><AlignRight className="h-4 w-4" /></Button>
                <Separator orientation="vertical" className="h-4 mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('insertUnorderedList')}><List className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('insertOrderedList')}><ListOrdered className="h-4 w-4" /></Button>
                <Separator orientation="vertical" className="h-4 mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('outdent')}><Outdent className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('indent')}><Indent className="h-4 w-4" /></Button>
            </div>

            {/* Media */}
            <div className="flex items-center gap-1 border-r pr-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMediaDialogOpen({type: 'link', open: true})} title="Link einfügen"><LinkIcon className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMediaDialogOpen({type: 'image', open: true})} title="Bild einfügen"><ImageIcon className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMediaDialogOpen({type: 'video', open: true})} title="Video einfügen"><Video className="h-4 w-4" /></Button>
            </div>

            {/* Table Management */}
            <div className="flex items-center gap-1 bg-primary/10 px-1 rounded-lg">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={insertTable} title="Tabelle einfügen"><TableIcon className="h-4 w-4" /></Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-primary text-xs font-bold">
                            Tabelle <ChevronDown className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuLabel>Tabellen-Optionen</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={addRow} className="gap-2"><PlusSquare className="h-4 w-4" /> Zeile unterhalb</DropdownMenuItem>
                        <DropdownMenuItem onClick={addColumn} className="gap-2"><PlusSquare className="h-4 w-4" /> Spalte rechts</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={deleteRow} className="text-destructive gap-2"><MinusSquare className="h-4 w-4" /> Zeile löschen</DropdownMenuItem>
                        <DropdownMenuItem onClick={deleteCurrentTable} className="text-destructive gap-2 font-bold"><Trash2 className="h-4 w-4" /> Ganze Tabelle löschen</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-12 flex justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-4xl bg-background shadow-2xl rounded-2xl min-h-[1100px] p-8 md:p-20 border transition-all">
            <div 
                ref={editorRef}
                contentEditable
                className="w-full h-full outline-none prose dark:prose-invert max-w-none text-lg leading-relaxed focus:ring-0 selection:bg-primary/20"
                onInput={triggerAutoSave}
                spellCheck="false"
                style={{ fontFamily: 'inherit' }}
            />
        </div>
      </main>

      <style jsx global>{`
        [contenteditable]:empty:before {
          content: 'Beginne hier mit deinem Text...';
          color: #a1a1aa;
          cursor: text;
          font-style: italic;
        }
        table {
            transition: all 0.2s;
        }
        table td, table th {
            min-width: 100px;
            position: relative;
        }
        table tr:hover {
            background-color: rgba(0,0,0,0.02);
        }
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        .prose img {
            transition: transform 0.3s;
        }
        .prose img:hover {
            transform: scale(1.01);
        }
      `}</style>
    </div>
  );
}
