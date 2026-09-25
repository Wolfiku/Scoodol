
'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft, Save, Check, MoreHorizontal, Info, Share2, Lock, Unlock, Trash2, Edit, BookOpen, Link2, Plus, X, Globe, Sparkles, Send, Calendar as CalendarIcon, FileText, BookmarkPlus } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { format, formatDistanceToNow, isBefore, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import ShareNoteDialog from '@/app/components/share-note-dialog';
import CustomMarkdownRenderer from '@/app/components/custom-markdown-renderer';
import { getTutorReply } from '@/app/actions';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useTheme } from '@/hooks/use-theme';

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

const MARKER_LINKS = '<!-- SCOODOL_TYPE:LINKS -->';
const MARKER_PROTOCOL = '<!-- SCOODOL_TYPE:PROTOCOL -->';
const MARKER_STUDY = '<!-- SCOODOL_TYPE:STUDY -->';

function NoteEditor() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const noteId = params?.noteId as string;
  const isNewNote = noteId === 'new';
  const urlTemplate = searchParams.get('template');

  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { aiLanguage } = useTheme();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<string | null>(urlTemplate);
  
  const [isEditing, setIsEditing] = useState(isNewNote);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [dateDisplayType, setDateDisplayType] = useState<'updated' | 'created'>('updated');

  // Link Smart Template State
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [linkNotes, setLinkNotes] = useState('');

  // Protocol Smart Template State
  const [protoSubject, setProtoSubject] = useState('');
  const [protoDate, setProtoDate] = useState(new Date().toISOString().split('T')[0]);
  const [protoTopic, setProtoTopic] = useState('');
  const [newHwTask, setNewHwTask] = useState('');
  const [newHwDue, setNewHwDue] = useState('');

  // Study Smart Template State
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorReplies, setTutorReplies] = useState<{q: string, a: string}[]>([]);
  const [isTutorLoading, setIsTutorLoading] = useState(false);

  const noteDocRef = useMemoFirebase(() => 
    !isNewNote && user && typeof noteId === 'string'
      ? doc(firestore, `users/${user.uid}/quickNotes`, noteId)
      : null
  , [firestore, user, noteId, isNewNote]);

  const { data: note, isLoading: isLoadingNote } = useDoc<QuickNote>(noteDocRef);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Apply templates for new notes
  useEffect(() => {
    if (isNewNote && urlTemplate && content === '') {
        setActiveTemplate(urlTemplate);
        if (urlTemplate === 'study') {
            setTitle('Lernzettel: [Thema]');
            setContent('### 💡 Kernkonzepte\n- [ ] Konzept 1...\n\n### 📝 Zusammenfassung\n...\n\n### 🔢 Wichtige Fakten & Formeln\n- a² + b² = c²\n\n### ❓ Mögliche Prüfungsfragen\n1. ?');
        } else if (urlTemplate === 'protocol') {
            setTitle(`Protokoll: ${new Date().toLocaleDateString('de-DE')}`);
            setProtoDate(new Date().toISOString().split('T')[0]);
            setContent(`### 📓 Mitschrift\n- \n\n### 🎯 Wichtige Erkenntnisse\n...`);
        } else if (urlTemplate === 'links') {
            setTitle('Recherche: Link-Sammlung');
        }
    }
  }, [isNewNote, urlTemplate, content]);

  // Load content and split into states
  useEffect(() => {
      if (note) {
          setTitle(note.title);
          if (note.isLocked) setIsEditing(false);

          // Detect template from content
          let detectedTemplate = urlTemplate;
          if (note.content.includes(MARKER_LINKS)) detectedTemplate = 'links';
          else if (note.content.includes(MARKER_PROTOCOL)) detectedTemplate = 'protocol';
          else if (note.content.includes(MARKER_STUDY)) detectedTemplate = 'study';
          
          setActiveTemplate(detectedTemplate);

          // Link Template Parsing
          if (detectedTemplate === 'links') {
              const linksMatch = note.content.match(/## 🔗 Links\n([\s\S]*?)\n\n## 📝 Notizen/);
              if (linksMatch) {
                  const parsed = linksMatch[1].split('\n').filter(l => l.startsWith('- ')).map(line => {
                      const m = line.match(/- \[(.*?)\]\((.*?)\)/);
                      return m ? { id: Math.random().toString(), title: m[1], url: m[2] } : null;
                  }).filter(l => l !== null) as LinkItem[];
                  setLinks(parsed);
              }
              const notesMatch = note.content.match(/## 📝 Notizen\n([\s\S]*)$/);
              if (notesMatch) setLinkNotes(notesMatch[1].trim());
          } else if (detectedTemplate === 'protocol') {
              const headMatch = note.content.match(/# Protokoll: (.*) vom (.*)\n\*\*Thema:\*\* (.*)\n\n/);
              if (headMatch) {
                  setProtoSubject(headMatch[1]);
                  setProtoDate(headMatch[2]);
                  setProtoTopic(headMatch[3]);
                  setContent(note.content.replace(/# Protokoll: .*\n\*\*Thema:\*\* .*\n\n/, '').replace(MARKER_PROTOCOL, '').trim());
              } else {
                  setContent(note.content.replace(MARKER_PROTOCOL, '').trim());
              }
          } else if (detectedTemplate === 'study') {
              setContent(note.content.replace(MARKER_STUDY, '').trim());
          } else {
              setContent(note.content);
          }
          
          setSaveStatus('idle');
      }
  }, [note, urlTemplate]);

  const handleSave = useCallback(async () => {
    if (!firestore || !user || !title.trim() || note?.isLocked) return;
    setSaveStatus('saving');

    let finalContent = content;
    if (activeTemplate === 'links') {
        finalContent = `${MARKER_LINKS}\n# Link-Sammlung: ${title}\n\n## 🔗 Links\n${links.map(l => `- [${l.title}](${l.url})`).join('\n')}\n\n## 📝 Notizen\n${linkNotes}`;
    } else if (activeTemplate === 'protocol') {
        finalContent = `${MARKER_PROTOCOL}\n# Protokoll: ${protoSubject} vom ${protoDate}\n**Thema:** ${protoTopic}\n\n${content}`;
    } else if (activeTemplate === 'study') {
        finalContent = `${MARKER_STUDY}\n${content}`;
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
            router.replace(`/workspace/notes/${newDocRef.id}${activeTemplate ? `?template=${activeTemplate}` : ''}`);
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
  }, [firestore, user, title, content, links, linkNotes, isNewNote, noteDocRef, router, note?.isLocked, activeTemplate, protoSubject, protoDate, protoTopic]);

  const triggerAutoSave = () => {
    if (isLoadingNote || note?.isLocked) return;
    setSaveStatus('dirty');
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(handleSave, 1500);
  };

  useEffect(() => {
      if (title.trim() && isEditing) {
          triggerAutoSave();
      }
  }, [title, content, links, linkNotes, protoSubject, protoDate, protoTopic]);

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
      setNewLinkTitle(''); setNewLinkUrl('');
      triggerAutoSave();
  }

  const handleAddHw = async () => {
      if (!newHwTask.trim() || !user) return;
      const homeworksRef = collection(firestore, `users/${user.uid}/homeworks`);
      await addDocumentNonBlocking(homeworksRef, {
          subject: protoSubject,
          task: newHwTask,
          dueDate: newHwDue,
          done: false,
          source: 'protocol'
      });
      toast({ title: "Hausaufgabe hinzugefügt!", description: `In Fach ${protoSubject} gespeichert.` });
      setNewHwTask(''); setNewHwDue('');
  }

  const handleAskTutor = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!tutorQuestion.trim() || isTutorLoading) return;
      setIsTutorLoading(true);
      const q = tutorQuestion;
      setTutorQuestion('');
      
      const result = await getTutorReply(content, q, aiLanguage);
      if (result.reply) {
          setTutorReplies(prev => [...prev, { q, a: result.reply }]);
      } else if (result.error) {
          toast({ variant: 'destructive', title: "Tutor-Fehler", description: result.error });
      }
      setIsTutorLoading(false);
  }

  const getFormattedDate = (timestamp: QuickNote['createdAt'] | undefined, type: 'created' | 'updated') => {
    if (!timestamp) return '';
    const date = new Date(timestamp.seconds * 1000);
    const dayAgo = subDays(new Date(), 1);
    return isBefore(date, dayAgo) ? format(date, "d. MMM. yyyy", { locale: de }) : formatDistanceToNow(date, { addSuffix: true, locale: de });
  };

  const showEditor = (isEditing && !note?.isLocked) || (isNewNote);
  const isLoading = isUserLoading || isLoadingNote;

  if (isLoading && !isNewNote) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  if (!isUserLoading && (!user || user.isAnonymous)) { router.push('/login'); return null; }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
       <AlertDialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Notiz-Informationen</AlertDialogTitle></AlertDialogHeader>
            <div className="text-sm space-y-2">
                <p><strong>Titel:</strong> {note?.title || 'Kein Titel'}</p>
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

      <header className="p-4 md:p-6 bg-background border-b z-20 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/workspace')}><ArrowLeft className="h-5 w-5" /></Button>
            <Input 
                placeholder="Titel..."
                className="text-2xl font-black border-0 shadow-none focus-visible:ring-0 px-0 h-auto flex-1 bg-transparent"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setSaveStatus('dirty'); }}
                readOnly={!showEditor}
            />
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mr-2">
                    <span className="cursor-pointer hover:text-foreground hidden sm:inline" onClick={() => setDateDisplayType(dateDisplayType === 'updated' ? 'created' : 'updated')}>
                      {note ? getFormattedDate(note?.[dateDisplayType === 'updated' ? 'updatedAt' : 'createdAt'], dateDisplayType) : ''}
                    </span>
                    {saveStatus === 'saving' ? <Loader2 className="h-3 w-3 animate-spin" /> : saveStatus === 'dirty' ? <Save className="h-3 w-3 opacity-50" /> : <Check className="h-3 w-3" />}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setIsEditing(!isEditing)} disabled={note?.isLocked}>
                            {isEditing ? <><BookOpen className="mr-2 h-4 w-4" /><span>Lesemodus</span></> : <><Edit className="mr-2 h-4 w-4" /><span>Bearbeiten</span></>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsInfoDialogOpen(true)} disabled={!note}><Info className="mr-2 h-4 w-4" /><span>Info</span></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsShareDialogOpen(true)} disabled={!note}><Share2 className="mr-2 h-4 w-4" /><span>Teilen</span></DropdownMenuItem>
                        <DropdownMenuItem onClick={toggleLock} disabled={isNewNote}>
                            {note?.isLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}<span>{note?.isLocked ? 'Entsperren' : 'Sperren'}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} disabled={!note || note?.isLocked} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /><span>Löschen</span></DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
      </header>

      <main className="flex-1 overflow-y-auto relative p-4 md:p-8 max-w-5xl mx-auto w-full">
            {activeTemplate === 'links' ? (
                <div className="space-y-8 animate-in fade-in duration-500">
                    {showEditor && (
                        <Card className="bg-primary/5 border-dashed border-2">
                            <CardContent className="p-6 space-y-4">
                                <Label className="font-bold flex items-center gap-2"><Plus className="w-4 h-4"/> Link hinzufügen</Label>
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3">
                                    <Input placeholder="Titel" value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} />
                                    <Input placeholder="URL" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} />
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
                                    {showEditor && <Button variant="ghost" size="icon" onClick={() => { setLinks(links.filter(l => l.id !== link.id)); setSaveStatus('dirty'); }}><X className="w-4 h-4" /></Button>}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Zusätzliche Notizen</Label>
                        <Textarea 
                            placeholder="Zusätzliche Gedanken zu deiner Recherche..." 
                            className={cn("min-h-[200px] text-base leading-relaxed", !showEditor && "border-0 shadow-none focus-visible:ring-0 p-0 resize-none")}
                            value={linkNotes} 
                            onChange={e => { setLinkNotes(e.target.value); setSaveStatus('dirty'); }} 
                            readOnly={!showEditor} 
                        />
                    </div>
                </div>
            ) : activeTemplate === 'protocol' ? (
                <div className="space-y-8 animate-in fade-in duration-500">
                    {showEditor ? (
                        <>
                            <Card className="bg-accent/5 border-2">
                                <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><FileText className="w-4 h-4" /> Protokoll-Daten</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1"><Label>Fach</Label><Input value={protoSubject} onChange={e => { setProtoSubject(e.target.value); setSaveStatus('dirty'); }} placeholder="Mathe..." /></div>
                                    <div className="space-y-1"><Label>Datum</Label><Input type="date" value={protoDate} onChange={e => { setProtoDate(e.target.value); setSaveStatus('dirty'); }} /></div>
                                    <div className="space-y-1"><Label>Thema</Label><Input value={protoTopic} onChange={e => { setProtoTopic(e.target.value); setSaveStatus('dirty'); }} placeholder="Analysis..." /></div>
                                </CardContent>
                            </Card>

                            <Card className="border-dashed border-2 bg-primary/5">
                                <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2 text-primary"><BookmarkPlus className="w-4 h-4" /> Hausaufgabe hinzufügen</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-3">
                                    <Input placeholder="Aufgabe..." value={newHwTask} onChange={e => setNewHwTask(e.target.value)} />
                                    <Input type="date" value={newHwDue} onChange={e => setNewHwDue(e.target.value)} />
                                    <Button onClick={handleAddHw} disabled={!newHwTask.trim()}><Plus className="w-4 h-4" /></Button>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <div className="bg-secondary/30 p-6 rounded-2xl border flex flex-wrap gap-x-8 gap-y-2 items-baseline">
                            <div><span className="text-[10px] uppercase font-black text-muted-foreground block">Fach</span><span className="text-xl font-bold">{protoSubject || 'N/A'}</span></div>
                            <div><span className="text-[10px] uppercase font-black text-muted-foreground block">Datum</span><span className="text-lg font-medium">{protoDate ? new Date(protoDate).toLocaleDateString('de-DE') : 'N/A'}</span></div>
                            <div className="flex-1 min-w-[200px]"><span className="text-[10px] uppercase font-black text-muted-foreground block">Thema</span><span className="text-lg italic">"{protoTopic || 'Unbekannt'}"</span></div>
                        </div>
                    )}

                    <div className="pt-4">
                        {showEditor ? (
                            <Textarea 
                                placeholder="Mitschrift..." 
                                className="min-h-[400px] border-0 focus-visible:ring-0 text-lg shadow-none p-0 resize-none leading-relaxed bg-transparent" 
                                value={content} 
                                onChange={e => { setContent(e.target.value); setSaveStatus('dirty'); }} 
                            />
                        ) : (
                            <CustomMarkdownRenderer content={content} />
                        )}
                    </div>
                </div>
            ) : activeTemplate === 'study' ? (
                <div className="flex flex-col h-full space-y-8 animate-in fade-in duration-500">
                    <div className="flex-1">
                        {showEditor ? <Textarea placeholder="Lernzettel..." className="min-h-[400px] border-0 focus-visible:ring-0 text-lg shadow-none p-0 resize-none leading-relaxed bg-transparent" value={content} onChange={e => { setContent(e.target.value); setSaveStatus('dirty'); }} /> : <CustomMarkdownRenderer content={content} />}
                    </div>
                    
                    <div className="border-t pt-8 space-y-4">
                        <div className="flex items-center gap-2 text-primary"><Sparkles className="w-5 h-5" /><h3 className="font-bold">Lern-Assistent (KI)</h3></div>
                        <div className="space-y-4">
                            {tutorReplies.map((r, i) => (
                                <div key={i} className="space-y-2 animate-in slide-in-from-left-2">
                                    <div className="flex justify-end"><div className="bg-primary text-primary-foreground p-3 rounded-2xl rounded-tr-none max-w-[80%] text-sm">{r.q}</div></div>
                                    <div className="flex justify-start"><div className="bg-secondary p-3 rounded-2xl rounded-tl-none max-w-[80%] text-sm">{r.a}</div></div>
                                </div>
                            ))}
                            {isTutorLoading && <div className="flex justify-start"><div className="bg-secondary p-3 rounded-2xl rounded-tl-none flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Denke nach...</div></div>}
                        </div>
                        <form onSubmit={handleAskTutor} className="flex gap-2 bg-background border rounded-full p-1 pl-4 shadow-sm focus-within:ring-2 ring-primary transition-all">
                            <input 
                                className="flex-1 bg-transparent border-0 outline-none text-sm" 
                                placeholder="Stelle eine Frage zu deinem Lernzettel..." 
                                value={tutorQuestion}
                                onChange={e => setTutorQuestion(e.target.value)}
                                disabled={isTutorLoading}
                            />
                            <Button type="submit" size="icon" className="rounded-full" disabled={!tutorQuestion.trim() || isTutorLoading}><Send className="w-4 h-4" /></Button>
                        </form>
                    </div>
                </div>
            ) : showEditor ? (
                <Textarea placeholder="Schreib hier deine Gedanken auf..." className="w-full h-full border-0 resize-none shadow-none focus-visible:ring-0 p-0 text-lg leading-relaxed bg-transparent" value={content} onChange={(e) => { setContent(e.target.value); setSaveStatus('dirty'); }} autoFocus />
            ) : (
                <div className="w-full h-full flex-1" onClick={() => { if (!note?.isLocked) setIsEditing(true); }}><CustomMarkdownRenderer content={content} /></div>
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
