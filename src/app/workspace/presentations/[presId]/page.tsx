
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Loader2, ArrowLeft, Plus, Trash2, Presentation, Play, Save, Check, 
    ChevronLeft, ChevronRight, X, Monitor, Type, Layout, Palette, 
    MoveUp, MoveDown, Maximize2, MoreHorizontal, Settings,
    Bold, Italic, Underline, Link as LinkIcon, Image as ImageIcon, Video, 
    AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Code, Library, 
    BookmarkPlus, CornerUpRight, ExternalLink, ChevronDown, FontCursor, Eraser, Palette as PaletteIcon, Highlighter
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface Slide {
    id: string;
    title: string;
    content: string;
}

interface PresentationDoc {
    title: string;
    ownerId: string;
    slides: Slide[];
    theme: 'default' | 'dark' | 'ocean' | 'forest';
    updatedAt: any;
}

const FONTS = [
    { name: 'Standard', family: 'var(--font-pt-sans), sans-serif' },
    { name: 'Playfair Display', family: 'Playfair Display, serif' },
    { name: 'Montserrat', family: 'Montserrat, sans-serif' },
    { name: 'Fira Code', family: 'Fira Code, monospace' },
    { name: 'Dancing Script', family: 'Dancing Script, cursive' },
];

const THEMES = [
    { id: 'default', name: 'Standard (Hell)', bg: 'bg-white', text: 'text-slate-900', accent: 'bg-primary' },
    { id: 'dark', name: 'Nacht-Modus', bg: 'bg-slate-950', text: 'text-slate-50', accent: 'bg-blue-600' },
    { id: 'ocean', name: 'Ozean-Blau', bg: 'bg-blue-900', text: 'text-blue-50', accent: 'bg-cyan-400' },
    { id: 'forest', name: 'Wald-Grün', bg: 'bg-emerald-950', text: 'text-emerald-50', accent: 'bg-lime-500' },
];

export default function PresentationPage() {
    const router = useRouter();
    const params = useParams();
    const presId = params?.presId as string;
    const isNewPres = presId === 'new';

    const { toast } = useToast();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [title, setTitle] = useState('');
    const [slides, setSlides] = useState<Slide[]>([
        { id: 's1', title: 'Meine Präsentation', content: '<div>Willkommen zu meinem Referat.</div>' }
    ]);
    const [theme, setTheme] = useState<PresentationDoc['theme']>('default');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving'>('idle');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isPresenting, setIsPresenting] = useState(false);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [isMediaDialogOpen, setIsMediaDialogOpen] = useState<{type: 'image' | 'video' | 'link', open: boolean}>({type: 'link', open: false});
    const [mediaUrl, setMediaUrl] = useState('');
    
    const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const savedRange = useRef<Range | null>(null);

    const docRef = useMemoFirebase(() => 
        !isNewPres && user && typeof presId === 'string'
            ? doc(firestore, `users/${user.uid}/presentations`, presId)
            : null
    , [firestore, user, presId, isNewPres]);

    const { data: presentationData, isLoading: isLoadingPres } = useDoc<PresentationDoc>(docRef);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (presentationData && saveStatus === 'idle') {
            setTitle(presentationData.title);
            setSlides(presentationData.slides || []);
            setTheme(presentationData.theme || 'default');
        }
    }, [presentationData, saveStatus]);

    const handleSave = useCallback(async () => {
        if (!firestore || !user || !title.trim() || saveStatus === 'idle') return;
        setSaveStatus('saving');

        // Sync contents from DOM before saving
        const syncedSlides = slides.map(s => ({
            ...s,
            content: editorRefs.current[s.id]?.innerHTML || s.content
        }));

        const dataToSave = { title, slides: syncedSlides, theme };

        try {
            if (isNewPres) {
                const colRef = collection(firestore, `users/${user.uid}/presentations`);
                const newDoc = await addDoc(colRef, {
                    ...dataToSave,
                    ownerId: user.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                router.replace(`/workspace/presentations/${newDoc.id}`);
            } else if (docRef) {
                await setDoc(docRef, { ...dataToSave, updatedAt: serverTimestamp() }, { merge: true });
            }
            setSaveStatus('idle');
        } catch (error) {
            setSaveStatus('dirty');
        }
    }, [firestore, user, title, slides, theme, isNewPres, docRef, router, saveStatus]);

    const triggerAutoSave = () => {
        setSaveStatus('dirty');
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(handleSave, 2000);
    };

    const addSlide = () => {
        const newSlide: Slide = {
            id: Date.now().toString(),
            title: 'Neue Folie',
            content: '<div>Inhalt hier eingeben...</div>',
        };
        setSlides([...slides, newSlide]);
        triggerAutoSave();
    };

    const updateSlideTitle = (id: string, newTitle: string) => {
        setSlides(slides.map(s => s.id === id ? { ...s, title: newTitle } : s));
        triggerAutoSave();
    };

    const deleteSlide = (id: string) => {
        if (slides.length <= 1) return;
        setSlides(slides.filter(s => s.id !== id));
        triggerAutoSave();
    };

    const moveSlide = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= slides.length) return;
        const newSlides = [...slides];
        [newSlides[index], newSlides[newIndex]] = [newSlides[newIndex], newSlides[index]];
        setSlides(newSlides);
        triggerAutoSave();
    };

    const execCommand = (command: string, value: string = '') => {
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand(command, false, value);
        triggerAutoSave();
    };

    const applyStyle = (styleKey: 'fontSize' | 'fontFamily', value: string) => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;
        document.execCommand('styleWithCSS', false, 'true');
        if (styleKey === 'fontFamily') {
            document.execCommand('fontName', false, value);
        }
        triggerAutoSave();
    };

    const openMediaDialog = (type: 'image' | 'video' | 'link') => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) savedRange.current = selection.getRangeAt(0).cloneRange();
        setIsMediaDialogOpen({ type, open: true });
    };

    const handleMediaInsert = () => {
        const selection = window.getSelection();
        if (savedRange.current) {
            selection?.removeAllRanges();
            selection?.addRange(savedRange.current);
        }
        
        if (isMediaDialogOpen.type === 'link') {
            execCommand('createLink', mediaUrl);
        } else if (isMediaDialogOpen.type === 'image') {
            const html = `<div style="text-align:center;"><img src="${mediaUrl}" style="max-width:100%; border-radius:12px;" /></div><p><br></p>`;
            execCommand('insertHTML', html);
        } else if (isMediaDialogOpen.type === 'video') {
             let embedUrl = mediaUrl;
             if (mediaUrl.includes('youtube.com/watch?v=')) embedUrl = mediaUrl.replace('watch?v=', 'embed/');
             else if (mediaUrl.includes('youtu.be/')) embedUrl = mediaUrl.replace('youtu.be/', 'youtube.com/embed/');
             const html = `<div style="position:relative;padding-bottom:56.25%;height:0;border-radius:12px;overflow:hidden;"><iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;" frameborder="0" allowfullscreen></iframe></div><p><br></p>`;
             execCommand('insertHTML', html);
        }
        
        setMediaUrl('');
        setIsMediaDialogOpen({ ...isMediaDialogOpen, open: false });
    };

    useEffect(() => {
        if (!isPresenting) return;
        const handleKeys = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === ' ') setCurrentSlideIndex(p => Math.min(p + 1, slides.length - 1));
            if (e.key === 'ArrowLeft') setCurrentSlideIndex(p => Math.max(p - 1, 0));
            if (e.key === 'Escape') setIsPresenting(false);
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [isPresenting, slides.length]);

    const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0];

    if (isUserLoading || (isLoadingPres && !isNewPres)) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
    }

    return (
        <div className="flex flex-col h-screen bg-background overflow-hidden">
            <style jsx global>{`
                .slide-editor [contenteditable]:empty:before { content: 'Inhalt schreiben...'; color: #a1a1aa; font-style: italic; }
                .slide-editor table { border-collapse: collapse; width: 100%; margin: 1em 0; }
                .slide-editor td { border: 1px solid #ddd; padding: 8px; }
            `}</style>

            <Dialog open={isMediaDialogOpen.open} onOpenChange={(o) => setIsMediaDialogOpen({...isMediaDialogOpen, open: o})}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isMediaDialogOpen.type === 'link' ? 'Link einfügen' : isMediaDialogOpen.type === 'image' ? 'Bild einfügen' : 'Video einfügen'}</DialogTitle>
                        <DialogDescription>Gib die URL für dein Element ein.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4"><Input placeholder="https://..." value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} autoFocus /></div>
                    <DialogFooter><Button onClick={handleMediaInsert}>Einfügen</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <header className="bg-background border-b p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-4 flex-1">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/workspace')}><ArrowLeft className="h-5 w-5" /></Button>
                    <div className="flex flex-col">
                        <Input 
                            value={title} 
                            placeholder="Titel der Präsentation..."
                            onChange={e => { setTitle(e.target.value); triggerAutoSave(); }} 
                            className="h-7 text-lg font-bold border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent flex-1" 
                        />
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] uppercase font-black px-1.5 h-4">Folien: {slides.length}</Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                • {saveStatus === 'saving' ? <Loader2 className="h-2.5 w-2.5 animate-spin"/> : <Check className="h-2.5 w-2.5"/>}
                                <span className="ml-1 uppercase text-[9px] font-bold">{saveStatus === 'saving' ? 'Auto-Save' : 'Gespeichert'}</span>
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <Select value={theme} onValueChange={(v: any) => { setTheme(v); triggerAutoSave(); }}>
                        <SelectTrigger className="w-40 h-9 rounded-full">
                            <Palette className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Design" />
                        </SelectTrigger>
                        <SelectContent>
                            {THEMES.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => { setIsPresenting(true); setCurrentSlideIndex(0); }} className="font-black gap-2 h-9 rounded-full px-5">
                        <Play className="h-4 w-4 fill-current" /> Präsentieren
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Löschen</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Toolbar for formatting */}
            <div className="bg-secondary/20 border-b p-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-[11px] font-bold"><Type className="h-3.5 w-3.5" /> <ChevronDown className="h-2.5 w-2.5 opacity-50" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto">
                            {FONTS.map(font => (<DropdownMenuItem key={font.name} onClick={() => applyStyle('fontFamily', font.family)} style={{ fontFamily: font.family }}>{font.name}</DropdownMenuItem>))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('bold')}><Bold className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('italic')}><Italic className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('underline')}><Underline className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Formatierung löschen" onClick={() => execCommand('removeFormat')}><Eraser className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" title="Farbe"><PaletteIcon className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2">{['#000000', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4', '#10b981'].map(color => (<button key={color} className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: color }} onClick={() => execCommand('foreColor', color)} />))}</DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" title="Marker"><Highlighter className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2">
                            <button className="w-5 h-5 rounded-full border border-border flex items-center justify-center bg-background" onClick={() => execCommand('hiliteColor', 'transparent')} title="Keine Markierung"><X className="w-3 h-3 text-destructive" /></button>
                            {['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa', '#ccfbf1', '#f3f4f6', '#ffedd5'].map(color => (<button key={color} className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: color }} onClick={() => execCommand('hiliteColor', color)} />))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('insertUnorderedList')}><List className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('insertOrderedList')}><ListOrdered className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 pl-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMediaDialog('link')}><LinkIcon className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMediaDialog('image')}><ImageIcon className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMediaDialog('video')}><Video className="h-3.5 w-3.5" /></Button>
                    <Separator orientation="vertical" className="h-4 mx-1" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-primary ml-1"><Library className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => { execCommand('insertHTML', '<pre style="background:#121212;color:#e0e0e0;padding:1rem;border-radius:0.75rem;font-family:monospace;"><code>Code hier...</code></pre><p><br></p>'); }}><Code className="mr-2 h-4 w-4" /> Codefeld</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { execCommand('insertHTML', '<div style="border:2px dashed hsla(var(--accent),0.3);background:hsl(var(--secondary));padding:1rem;border-radius:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;"><div><div style="font-size:9px;text-transform:uppercase;font-weight:900;color:hsl(var(--accent));">Hausaufgabe</div><div style="font-weight:700;">Aufgabe hier schreiben...</div></div><button class="add-hw-btn" style="background:hsl(var(--accent));color:white;border:none;padding:0.5rem 1rem;border-radius:0.5rem;font-weight:700;cursor:pointer;">➕ Planen</button></div><p><br></p>'); }}><BookmarkPlus className="mr-2 h-4 w-4" /> Hausivorlage</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <main className="flex-1 flex overflow-hidden bg-secondary/10">
                {/* Thumbnails Sidebar */}
                <aside className="w-64 border-r bg-background overflow-y-auto p-4 space-y-4 no-scrollbar">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Übersicht</h3>
                    {slides.map((slide, idx) => (
                        <div key={slide.id} className="space-y-1">
                            <div 
                                className={cn(
                                    "aspect-video border-2 rounded-lg cursor-pointer transition-all overflow-hidden flex flex-col items-center justify-center p-2 text-center bg-card",
                                    currentSlideIndex === idx ? "border-primary ring-2 ring-primary/20 scale-[1.02]" : "hover:border-primary/40 border-muted"
                                )}
                                onClick={() => {
                                    const syncedSlides = [...slides];
                                    syncedSlides[currentSlideIndex].content = editorRefs.current[slides[currentSlideIndex].id]?.innerHTML || syncedSlides[currentSlideIndex].content;
                                    setSlides(syncedSlides);
                                    setCurrentSlideIndex(idx);
                                }}
                            >
                                <p className="text-[8px] font-bold line-clamp-1">{slide.title || 'Leere Folie'}</p>
                                <div className="w-full h-1 bg-muted mt-2 rounded-full" />
                                <div className="w-2/3 h-1 bg-muted mt-1 rounded-full" />
                            </div>
                        </div>
                    ))}
                    <Button variant="outline" className="w-full border-dashed border-2 py-8 rounded-xl flex flex-col gap-1" onClick={addSlide}>
                        <Plus className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase">Neu</span>
                    </Button>
                </aside>

                {/* Main Editor */}
                <section className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
                    <div className="w-full max-w-4xl space-y-8 pb-20">
                        {slides.map((slide, idx) => (
                            <Card key={slide.id} className={cn(
                                "border-2 overflow-hidden rounded-3xl transition-all shadow-xl bg-card slide-editor",
                                currentSlideIndex === idx ? "border-primary ring-4 ring-primary/5" : "opacity-60 grayscale-[0.5] scale-95"
                            )}>
                                <CardHeader className="p-4 border-b bg-muted/20 flex flex-row justify-between items-center space-y-0">
                                    <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center font-black">{idx + 1}</Badge>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={idx === 0} onClick={() => moveSlide(idx, 'up')}><MoveUp className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={idx === slides.length - 1} onClick={() => moveSlide(idx, 'down')}><MoveDown className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteSlide(slide.id)}><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-10 min-h-[500px] flex flex-col gap-6">
                                    <Input 
                                        value={slide.title} 
                                        placeholder="Titel der Folie..."
                                        onChange={e => updateSlideTitle(slide.id, e.target.value)}
                                        className="text-4xl font-black border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent"
                                    />
                                    <Separator />
                                    <div 
                                        ref={el => { editorRefs.current[slide.id] = el; }}
                                        contentEditable={currentSlideIndex === idx}
                                        dangerouslySetInnerHTML={{ __html: slide.content }}
                                        onInput={triggerAutoSave}
                                        className="outline-none min-h-[350px] text-lg leading-relaxed prose dark:prose-invert max-w-none"
                                    />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            </main>

            {/* Presentation Overlay */}
            <Dialog open={isPresenting} onOpenChange={setIsPresenting}>
                <DialogContent className="max-w-none w-screen h-screen p-0 border-0 rounded-none bg-black">
                    <div className={cn("w-full h-full flex flex-col items-center justify-center relative p-12 transition-all duration-500", currentTheme.bg, currentTheme.text)}>
                        <Button variant="ghost" size="icon" className="absolute top-6 right-6 rounded-full h-12 w-12 hover:bg-black/10" onClick={() => setIsPresenting(false)}>
                            <X className="h-6 w-6" />
                        </Button>

                        <div className="w-full max-w-6xl animate-in fade-in zoom-in duration-500">
                             <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-tight mb-8 border-b-8 pb-4" style={{borderColor:'hsl(var(--primary))'}}>{slides[currentSlideIndex].title}</h1>
                             <div className="text-2xl md:text-4xl leading-relaxed prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: slides[currentSlideIndex].content }} />
                        </div>

                        <div className="absolute bottom-8 left-0 right-0 px-12 flex justify-between items-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                            <div className="flex gap-4">
                                <Button variant="ghost" size="icon" className="rounded-full h-12 w-12" disabled={currentSlideIndex === 0} onClick={() => setCurrentSlideIndex(p => p - 1)}><ChevronLeft className="h-8 w-8"/></Button>
                                <Button variant="ghost" size="icon" className="rounded-full h-12 w-12" disabled={currentSlideIndex === slides.length - 1} onClick={() => setCurrentSlideIndex(p => p + 1)}><ChevronRight className="h-8 w-8"/></Button>
                            </div>
                            <div className="text-xs font-black uppercase tracking-widest opacity-50">
                                {currentSlideIndex + 1} / {slides.length} • Scoodol Presentation
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-3xl p-8">
                    <AlertDialogHeader>
                        <div className="p-4 bg-destructive/10 w-fit rounded-full mx-auto mb-4"><Trash2 className="w-8 h-8 text-destructive" /></div>
                        <AlertDialogTitle className="text-center text-2xl font-black">Präsentation löschen?</AlertDialogTitle>
                        <AlertDialogDescription className="text-center text-lg">
                            Möchtest du "{title}" wirklich endgültig entfernen?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 flex-col sm:flex-row gap-2">
                        <AlertDialogCancel className="rounded-2xl h-12 font-bold flex-1">Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => { if (docRef) { await deleteDoc(docRef); toast({ title: 'Gelöscht' }); router.push('/workspace'); } }} className="bg-destructive text-white hover:bg-destructive/90 rounded-2xl h-12 font-bold flex-1">Ja, löschen</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
