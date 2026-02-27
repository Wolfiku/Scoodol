
'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft, Save, Check, MoreHorizontal, Info, Share2, Lock, Unlock, Trash2, Edit, BookOpen, Link2, Plus, X, Globe } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { format, formatDistanceToNow, isBefore, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import ShareNoteDialog from '@/app/components/share-note-dialog';
import CustomMarkdownRenderer from '@/app/components/custom-markdown-renderer';

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
  isLocked: boolean;
}

type SaveStatus = 'idle' | 'dirty' | 'saving';

interface LinkItem {
    id: string;
    title: string;
    url: string;
}

function NoteEditor() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { noteId } = params;
  const isNewNote = noteId === 'new';
  const templateType = searchParams.get('template');

  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(isNewNote);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [dateDisplayType, setDateDisplayType] = useState<'updated' | 'created'>('updated');

  // Smart Link-Sammlung State
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [linkNotes, setLinkNotes] = useState('');

  const noteDocRef = useMemoFirebase(() => 
    !isNewNote && user && typeof noteId === 'string'
      ? doc(firestore, `users/${user.uid}/quickNotes`, noteId)
      : null
  , [firestore, user, noteId, isNewNote]);

  const { data: note, isLoading: isLoadingNote } = useDoc<QuickNote>(noteDocRef);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Apply templates for new notes
  useEffect(() => {
    if (isNewNote && templateType && content === '') {
        if (templateType === 'study') {
            setTitle('Neuer Lernzettel');
            setContent('# Lernzettel: [Thema]\n\n### 💡 Kernkonzepte\n- [ ] Konzept 1...\n- [ ] Konzept 2...\n\n### 📝 Zusammenfassung\nZusammenfassung der wichtigsten Inhalte in eigenen Worten.\n\n### 🔢 Wichtige Fakten & Formeln\n- **Fakt 1**: Erklärung\n- **Formel**: a² + b² = c²\n\n### ❓ Mögliche Prüfungsfragen\n1. Frage?\n   - Antwort...');
        } else if (templateType === 'protocol') {
            const today = new Date().toLocaleDateString('de-DE');
            setTitle(`Protokoll: ${today}`);
            setContent(`# Stunden-Protokoll: [Fach]\n**Datum:** ${today}\n**Thema:** \n\n### 📓 Mitschrift\n- Punkt 1\n- Punkt 2\n\n### 🎯 Wichtige Erkenntnisse\nWas ich mir unbedingt merken muss...\n\n### 🏠 Hausaufgaben & To-Dos\n- [ ] Aufgabe bis zum [Datum]`);
        } else if (templateType === 'presentation') {
            setTitle('Referats-Planung');
            setContent(`# Referat: [Titel]\n\n### 📅 Meilensteine\n- [ ] Thema eingegrenzt\n- [ ] Recherche abgeschlossen\n- [ ] Gliederung erstellt\n- [ ] Handout vorbereitet\n- [ ] Präsentation geübt\n\n### 📂 Gliederung\n1. **Einleitung**: Interesse wecken.\n2. **Hauptteil**: Details A, Details B.\n3. **Schluss**: Fazit und Quellen.\n\n### 💡 Ideen & Entwürfe\nZusätzliche Notizen...`);
        } else if (templateType === 'links') {
            setTitle('Recherche: Link-Sammlung');
            setContent('Link-Sammlung initialisiert.');
        }
    }
  }, [isNewNote, templateType, content]);

  // Load content into states
  useEffect(() => {
      if (note) {
          setTitle(note.title);
          setContent(note.content);
          if (note.isLocked) {
            setIsEditing(false);
          }
          setSaveStatus('idle');

          // Attempt to parse links if it's a link collection
          if (templateType === 'links' || note.title.toLowerCase().includes('link')) {
              // Basic parsing of our custom format
              const linksMatch = note.content.match(/## 🔗 Links\n([\s\S]*?)\n\n## 📝 Notizen/);
              if (linksMatch) {
                  const linksLines = linksMatch[1].split('\n').filter(l => l.startsWith('- '));
                  const parsedLinks = linksLines.map(line => {
                      const m = line.match(/- \[(.*?)\]\((.*?)\)/);
                      return m ? { id: Math.random().toString(), title: m[1], url: m[2] } : null;
                  }).filter(l => l !== null) as LinkItem[];
                  setLinks(parsedLinks);
              }
              const notesMatch = note.content.match(/## 📝 Notizen\n([\s\S]*)$/);
              if (notesMatch) setLinkNotes(notesMatch[1].trim());
          }
      }
  }, [note, templateType]);

  const handleSave = useCallback(async () => {
    if (!firestore || !user || !title.trim() || note?.isLocked) return;
    setSaveStatus('saving');

    let finalContent = content;
    if (templateType === 'links') {
        finalContent = `# Link-Sammlung: ${title}\n\n## 🔗 Links\n${links.map(l => `- [${l.title}](${l.url})`).join('\n')}\n\n## 📝 Notizen\n${linkNotes}`;
    }

    try {
        if (isNewNote) {
            const notesColRef = collection(firestore, `users/${user.uid}/quickNotes`);
            const newDocRef = await addDoc(notesColRef, {
                title: title,
                content: finalContent,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                isLocked: false,
            });
            router.replace(`/workspace/notes/${newDocRef.id}${templateType ? `?template=${templateType}` : ''}`);
        } else {
            if (!noteDocRef) return;
            await setDoc(noteDocRef, {
                title: title,
                content: finalContent,
                updatedAt: serverTimestamp(),
            }, { merge: true });
        }
        setSaveStatus('idle');
    } catch (error) {
        setSaveStatus('dirty');
    }
  }, [firestore, user, title, content, links, linkNotes, isNewNote, noteDocRef, router, note?.isLocked, templateType]);

  useEffect(() => {
    if (isLoadingNote) return;
    
    // Check if anything changed
    const currentFinalContent = templateType === 'links' 
        ? `# Link-Sammlung: ${title}\n\n## 🔗 Links\n${links.map(l => `- [${l.title}](${l.url})`).join('\n')}\n\n## 📝 Notizen\n${linkNotes}`
        : content;

    if (note && title === note.title && currentFinalContent === note.content) return;

    if (title.trim()) {
        setSaveStatus('dirty');
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(handleSave, 1500);
    }

    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [title, content, links, linkNotes, note, isLoadingNote, handleSave, templateType]);

  const handleDelete = async () => {
      if(isNewNote || !noteDocRef) return;
      await deleteDoc(noteDocRef);
      toast({ title: "Notiz gelöscht!" });
      router.push('/workspace');
  }

  const toggleLock = async () => {
    if (isNewNote || !noteDocRef) return;
    const newLockState = !note?.isLocked;
    await setDoc(noteDocRef, { isLocked: newLockState }, { merge: true });
    if(newLockState) setIsEditing(false);
    toast({ title: newLockState ? "Notiz gesperrt" : "Notiz entsperrt" });
  }

  const addLink = () => {
      if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
      let url = newLinkUrl.trim();
      if (!url.startsWith('http')) url = 'https://' + url;
      
      setLinks([...links, { id: Date.now().toString(), title: newLinkTitle, url }]);
      setNewLinkTitle('');
      setNewLinkUrl('');
      toast({ title: "Link hinzugefügt" });
  }

  const removeLink = (id: string) => {
      setLinks(links.filter(l => l.id !== id));
  }

  const getFormattedDate = (timestamp: QuickNote['createdAt'] | undefined, type: 'created' | 'updated') => {
    if (!timestamp) return '';
    const date = new Date(timestamp.seconds * 1000);
    const dayAgo = subDays(new Date(), 1);
    return isBefore(date, dayAgo) ? format(date, "d. MMM. yyyy", { locale: de }) : formatDistanceToNow(date, { addSuffix: true, locale: de });
  };

  const renderSaveStatus = () => {
      switch(saveStatus) {
          case 'saving': return <Loader2 className="h-4 w-4 animate-spin" />;
          case 'idle': return isEditing ? <Check className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />;
          case 'dirty': default: return <Save className="h-4 w-4" />;
      }
  }

  const showEditor = (isEditing && !note?.isLocked) || (isNewNote);
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
            <AlertDialogHeader><AlertDialogTitle>Notiz-Informationen</AlertDialogTitle></AlertDialogHeader>
            <div className="text-sm space-y-2">
                <p><strong>Titel:</strong> {note?.title || 'Kein Titel'}</p>
                <p><strong>Typ:</strong> {templateType === 'links' ? 'Smart Link-Sammlung' : 'Quick Note'}</p>
                <p><strong>Erstellt:</strong> {note?.createdAt ? format(new Date(note.createdAt.seconds * 1000), "d. MMMM yyyy, HH:mm", { locale: de }) : '...'}</p>
                <p><strong>Zuletzt geändert:</strong> {note?.updatedAt ? format(new Date(note.updatedAt.seconds * 1000), "d. MMMM yyyy, HH:mm", { locale: de }) : '...'}</p>
            </div>
            <AlertDialogFooter><Button onClick={() => setIsInfoDialogOpen(false)}>Schließen</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Notiz wirklich löschen?</AlertDialogTitle>
                    <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Löschen</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {note && <ShareNoteDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} note={note} />}

      <main className="relative flex-1 flex flex-col min-h-0 p-4 md:p-8 max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-4 mb-8">
                <Input 
                    placeholder="Titel..."
                    className="text-3xl md:text-4xl font-black border-0 shadow-none focus-visible:ring-0 px-0 h-auto flex-1 bg-transparent"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    readOnly={!showEditor}
                />
                 {note?.isLocked && <Lock className="h-5 w-5 text-green-500" />}
                <div className="flex items-center justify-center h-6 gap-2 text-sm text-muted-foreground">
                    <span className="cursor-pointer hover:text-foreground hidden sm:inline" onClick={() => setDateDisplayType(dateDisplayType === 'updated' ? 'created' : 'updated')}>
                      {note ? getFormattedDate(note?.[dateDisplayType === 'updated' ? 'updatedAt' : 'createdAt'], dateDisplayType) : ''}
                    </span>
                    {renderSaveStatus()}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /><span>Zurück</span></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsEditing(!isEditing)} disabled={note?.isLocked}>
                            {isEditing ? <><BookOpen className="mr-2 h-4 w-4" /><span>Lesemodus</span></> : <><Edit className="mr-2 h-4 w-4" /><span>Bearbeiten</span></>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleSave} disabled={saveStatus !== 'dirty' || note?.isLocked}><Save className="mr-2 h-4 w-4" /><span>Jetzt speichern</span></DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsInfoDialogOpen(true)} disabled={!note}><Info className="mr-2 h-4 w-4" /><span>Info</span></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsShareDialogOpen(true)} disabled={!note}><Share2 className="mr-2 h-4 w-4" /><span>Teilen</span></DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={toggleLock} disabled={isNewNote}>
                            {note?.isLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}<span>{note?.isLocked ? 'Entsperren' : 'Sperren'}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} disabled={!note || note?.isLocked} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /><span>Löschen</span></DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {templateType === 'links' ? (
                <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {showEditor && (
                        <Card className="bg-primary/5 border-dashed border-2">
                            <CardContent className="p-6 space-y-4">
                                <Label className="font-bold flex items-center gap-2"><Plus className="w-4 h-4"/> Neuen Link hinzufügen</Label>
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3">
                                    <Input placeholder="Titel (z.B. Wikipedia)" value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} />
                                    <Input placeholder="URL (z.B. en.wikipedia.org/...)" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} />
                                    <Button onClick={addLink} disabled={!newLinkTitle.trim() || !newLinkUrl.trim()}><Plus className="w-4 h-4" /></Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2"><Link2 className="text-primary w-5 h-5"/> Gesammelte Links</h2>
                        <div className="grid gap-3">
                            {links.map(link => (
                                <div key={link.id} className="flex items-center gap-3 p-4 border rounded-xl bg-card hover:shadow-sm transition-all group">
                                    <div className="p-2 bg-secondary rounded-lg"><Globe className="w-5 h-5 text-muted-foreground" /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold truncate">{link.title}</p>
                                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">{link.url}</a>
                                    </div>
                                    {showEditor && (
                                        <Button variant="ghost" size="icon" onClick={() => removeLink(link.id)} className="opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></Button>
                                    )}
                                </div>
                            ))}
                            {links.length === 0 && <p className="text-center text-muted-foreground py-10 bg-secondary/20 rounded-xl border-2 border-dashed italic">Noch keine Links hinzugefügt.</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="font-bold flex items-center gap-2"><Edit className="w-4 h-4"/> Recherche-Notizen</Label>
                        <Textarea 
                            placeholder="Zusätzliche Gedanken zu deiner Recherche..."
                            className={cn("min-h-[200px] text-base leading-relaxed", !showEditor && "border-0 shadow-none focus-visible:ring-0 p-0 resize-none")}
                            value={linkNotes}
                            onChange={e => setLinkNotes(e.target.value)}
                            readOnly={!showEditor}
                        />
                    </div>
                </div>
            ) : showEditor ? (
                <Textarea 
                    placeholder="Schreib hier deine Gedanken auf... Du kannst Markdown verwenden!"
                    className="w-full h-full flex-1 border-0 resize-none shadow-none focus-visible:ring-0 p-0 text-lg leading-relaxed bg-transparent"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    autoFocus
                />
            ) : (
                <div className="w-full h-full flex-1" onClick={() => { if (!note?.isLocked) setIsEditing(true); }}>
                    <CustomMarkdownRenderer content={content} />
                </div>
            )}
      </main>
    </div>
  );
}

export default function NotePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>}>
            <NoteEditor />
        </Suspense>
    );
}
