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
    Strikethrough, Palette, Highlighter, PlusSquare, MinusSquare,
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
import { Separator } from '@/components/ui/separator';
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
  const [isInTable, setIsInTable] = useState(false);

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

  // Table detection logic
  useEffect(() => {
    const handleSelectionChange = () => {
      const table = getTableUnderCursor();
      setIsInTable(!!table);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

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
    const cellCount = table.rows[0].cells.length;
    for (let i = 0; i < cellCount; i++) {
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
    setIsInTable(false);
    triggerAutoSave();
  };

  const deleteRow = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      let node = selection.getRangeAt(0).startContainer;
      while (node && node.nodeName !== 'TR' && node !== editorRef.current) node = node.parentNode as Node;
      if (node && node.nodeName === 'TR') {
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
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
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

      <header className="bg-background border-b sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between p-3 px-4">
            <div className="flex items-center gap-3 flex-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/workspace')}><ArrowLeft className="h-4 w-4" /></Button>
                <Input 
                    placeholder="Titel des Dokuments..." 
                    className="text-lg font-black border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent flex-1"
                    value={title}
                    onChange={e => { setTitle(e.target.value); triggerAutoSave(); }}
                />
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase font-black text-muted-foreground flex items-center gap-1 bg-secondary/50 px-2 py-0.5 rounded">
                    {saveStatus === 'saving' ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                    {saveStatus === 'saving' ? 'Wird gespeichert' : 'Gespeichert'}
                </span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={handleSave} disabled={saveStatus !== 'dirty'}><Save className="mr-2 h-4 w-4" /> Manuell speichern</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Löschen</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        {/* Compact Single-Line Toolbar */}
        <div className="flex items-center gap-1 p-1 bg-secondary/10 border-t overflow-x-auto no-scrollbar scroll-smooth flex-nowrap">
            {/* Font & Size combined */}
            <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-[11px] font-bold"><Type className="h-3.5 w-3.5" /> <ChevronDown className="h-2.5 w-2.5 opacity-50" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => execCommand('fontName', 'Arial')}>Sans (Standard)</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontName', 'Georgia')}>Serif (Klassisch)</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontName', 'Courier New')}>Mono (Code)</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-[11px] font-black">A <ChevronDown className="h-2.5 w-2.5 opacity-50" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => execCommand('fontSize', '2')}>Klein</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontSize', '3')}>Normal</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontSize', '5')}>Groß</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => execCommand('fontSize', '7')}>Sehr Groß</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Formatting */}
            <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('bold')}><Bold className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('italic')}><Italic className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('underline')}><Underline className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('strikethrough')}><Strikethrough className="h-3.5 w-3.5" /></Button>
            </div>

            {/* Colors */}
            <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Farbe"><Palette className="h-3.5 w-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2">
                        {['#000000', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4', '#10b981'].map(color => (
                            <button key={color} className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: color }} onClick={() => execCommand('foreColor', color)} />
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Marker"><Highlighter className="h-3.5 w-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2">
                        {['#ffffff', '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa', '#ccfbf1', '#f3f4f6', '#ffedd5'].map(color => (
                            <button key={color} className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: color }} onClick={() => execCommand('hiliteColor', color)} />
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Lists & Indent */}
            <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('insertUnorderedList')}><List className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('insertOrderedList')}><ListOrdered className="h-3.5 w-3.5" /></Button>
                <Separator orientation="vertical" className="h-4 mx-1" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('outdent')}><Outdent className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('indent')}><Indent className="h-3.5 w-3.5" /></Button>
            </div>

            {/* Alignment */}
            <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('justifyLeft')}><AlignLeft className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('justifyCenter')}><AlignCenter className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('justifyRight')}><AlignRight className="h-3.5 w-3.5" /></Button>
            </div>

            {/* Media & Table */}
            <div className="flex items-center gap-0.5 shrink-0 pl-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMediaDialogOpen({type: 'link', open: true})}><LinkIcon className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMediaDialogOpen({type: 'image', open: true})}><ImageIcon className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMediaDialogOpen({type: 'video', open: true})}><Video className="h-3.5 w-3.5" /></Button>
                <Separator orientation="vertical" className="h-4 mx-1" />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={insertTable}><TableIcon className="h-3.5 w-3.5" /></Button>
            </div>
        </div>

        {/* Dynamic Contextual Table Toolbar */}
        {isInTable && (
            <div className="flex items-center gap-2 p-1 px-4 bg-primary/10 border-t animate-in slide-in-from-top-1 duration-200">
                <span className="text-[10px] font-black uppercase text-primary/70 mr-2 flex items-center gap-1"><TableIcon className="h-3 w-3" /> Tabelle</span>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={addRow}><PlusSquare className="h-3 w-3" /> Zeile unten</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={addColumn}><PlusSquare className="h-3 w-3" /> Spalte rechts</Button>
                <Separator orientation="vertical" className="h-4 mx-1" />
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2 text-destructive hover:text-destructive" onClick={deleteRow}><MinusSquare className="h-3 w-3" /> Zeile löschen</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2 text-destructive font-black hover:text-destructive" onClick={deleteCurrentTable}><Trash2 className="h-3 w-3" /> Tabelle löschen</Button>
            </div>
        )}
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-12 flex justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-4xl bg-background shadow-2xl rounded-2xl min-h-[1100px] p-8 md:p-20 border transition-all mb-20">
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
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
        }
        table td, table th {
            min-width: 50px;
            border: 1px solid #ddd;
            padding: 12px;
            position: relative;
        }
        .table-container {
            overflow-x: auto;
            border-radius: 8px;
            border: 1px solid #eee;
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
