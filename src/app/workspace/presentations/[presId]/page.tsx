
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
    MoveUp, MoveDown, Maximize2, MoreHorizontal, Settings
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
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type SlideLayout = 'title' | 'content-left' | 'content-center' | 'image-only';

interface Slide {
    id: string;
    title: string;
    content: string;
    layout: SlideLayout;
    imageUrl?: string;
}

interface PresentationDoc {
    title: string;
    ownerId: string;
    slides: Slide[];
    theme: 'default' | 'dark' | 'ocean' | 'forest';
    updatedAt: any;
}

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
        { id: 's1', title: 'Meine Präsentation', content: 'Willkommen zu meinem Referat.', layout: 'title' }
    ]);
    const [theme, setTheme] = useState<PresentationDoc['theme']>('default');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving'>('idle');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isPresenting, setIsPresenting] = useState(false);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

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

        const dataToSave = { title, slides, theme };

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
            content: 'Hier klicken, um Text hinzuzufügen...',
            layout: 'content-left'
        };
        setSlides([...slides, newSlide]);
        triggerAutoSave();
    };

    const updateSlide = (id: string, updates: Partial<Slide>) => {
        setSlides(slides.map(s => s.id === id ? { ...s, ...updates } : s));
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

            <main className="flex-1 flex overflow-hidden bg-secondary/10">
                {/* Thumbnails Sidebar */}
                <aside className="w-64 border-r bg-background overflow-y-auto p-4 space-y-4 no-scrollbar">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Übersicht</h3>
                    {slides.map((slide, idx) => (
                        <div key={slide.id} className="space-y-1">
                            <div 
                                className={cn(
                                    "aspect-video border-2 rounded-lg cursor-pointer transition-all overflow-hidden flex flex-col items-center justify-center p-2 text-center",
                                    currentSlideIndex === idx ? "border-primary ring-2 ring-primary/20 scale-[1.02]" : "hover:border-primary/40 border-muted"
                                )}
                                onClick={() => setCurrentSlideIndex(idx)}
                            >
                                <p className="text-[8px] font-bold line-clamp-1">{slide.title || 'Leere Folie'}</p>
                                <div className="w-full h-1 bg-muted mt-2 rounded-full" />
                                <div className="w-2/3 h-1 bg-muted mt-1 rounded-full" />
                            </div>
                            <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[9px] font-black text-muted-foreground">Folie {idx + 1}</span>
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
                            <Card key={slide.id} id={`slide-${idx}`} className={cn(
                                "border-2 overflow-hidden rounded-3xl transition-all shadow-xl bg-card",
                                currentSlideIndex === idx ? "border-primary ring-4 ring-primary/5" : "opacity-60 grayscale-[0.5] scale-95"
                            )}>
                                <CardHeader className="p-4 border-b bg-muted/20 flex flex-row justify-between items-center space-y-0">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center font-black">{idx + 1}</Badge>
                                        <Select value={slide.layout} onValueChange={(v: any) => updateSlide(slide.id, { layout: v })}>
                                            <SelectTrigger className="h-7 w-32 border-0 bg-transparent text-xs font-bold focus:ring-0">
                                                <Layout className="w-3 h-3 mr-1" />
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="title">Titel-Folie</SelectItem>
                                                <SelectItem value="content-left">Inhalt (Links)</SelectItem>
                                                <SelectItem value="content-center">Inhalt (Zentriert)</SelectItem>
                                                <SelectItem value="image-only">Nur Bild</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={idx === 0} onClick={() => moveSlide(idx, 'up')}><MoveUp className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={idx === slides.length - 1} onClick={() => moveSlide(idx, 'down')}><MoveDown className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteSlide(slide.id)}><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-10 min-h-[400px] flex flex-col gap-6">
                                    {slide.layout !== 'image-only' && (
                                        <Input 
                                            value={slide.title} 
                                            placeholder="Überschrift..."
                                            onChange={e => updateSlide(slide.id, { title: e.target.value })}
                                            className={cn(
                                                "border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent",
                                                slide.layout === 'title' ? "text-4xl font-black text-center" : "text-2xl font-bold"
                                            )}
                                        />
                                    )}
                                    
                                    {(slide.layout === 'content-left' || slide.layout === 'content-center') && (
                                        <Textarea 
                                            value={slide.content}
                                            placeholder="Inhalt hier eingeben..."
                                            onChange={e => updateSlide(slide.id, { content: e.target.value })}
                                            className={cn(
                                                "border-0 shadow-none focus-visible:ring-0 p-0 h-auto min-h-[200px] bg-transparent text-lg resize-none",
                                                slide.layout === 'content-center' && "text-center"
                                            )}
                                        />
                                    )}

                                    {slide.layout === 'image-only' && (
                                        <div className="flex-1 flex flex-col items-center justify-center gap-4">
                                            <div className="p-8 border-2 border-dashed rounded-3xl w-full flex flex-col items-center justify-center bg-secondary/20">
                                                {slide.imageUrl ? (
                                                    <img src={slide.imageUrl} alt="Slide" className="max-h-[300px] rounded-xl shadow-lg mb-4" />
                                                ) : (
                                                    <Monitor className="w-12 h-12 text-muted-foreground opacity-30 mb-2" />
                                                )}
                                                <Input 
                                                    value={slide.imageUrl || ''} 
                                                    placeholder="Bild-URL einfügen..."
                                                    onChange={e => updateSlide(slide.id, { imageUrl: e.target.value })}
                                                    className="max-w-xs text-center h-8 text-xs"
                                                />
                                            </div>
                                        </div>
                                    )}
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
                        {/* Exit Button */}
                        <Button variant="ghost" size="icon" className="absolute top-6 right-6 rounded-full h-12 w-12 hover:bg-black/10" onClick={() => setIsPresenting(false)}>
                            <X className="h-6 w-6" />
                        </Button>

                        {/* Slide Content */}
                        <div className="w-full max-w-6xl animate-in fade-in zoom-in duration-500">
                            {slides[currentSlideIndex].layout === 'title' && (
                                <div className="text-center space-y-12">
                                    <div className={cn("w-20 h-2 mx-auto rounded-full mb-8", currentTheme.accent)} />
                                    <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-none">{slides[currentSlideIndex].title}</h1>
                                    <p className="text-2xl md:text-3xl opacity-70 font-medium">{slides[currentSlideIndex].content}</p>
                                </div>
                            )}

                            {slides[currentSlideIndex].layout === 'content-left' && (
                                <div className="space-y-10">
                                    <h2 className="text-5xl md:text-7xl font-black tracking-tight border-l-8 pl-8" style={{ borderColor: currentTheme.accent.replace('bg-', '') }}>{slides[currentSlideIndex].title}</h2>
                                    <p className="text-2xl md:text-4xl leading-relaxed whitespace-pre-wrap">{slides[currentSlideIndex].content}</p>
                                </div>
                            )}

                            {slides[currentSlideIndex].layout === 'content-center' && (
                                <div className="text-center space-y-10">
                                    <h2 className="text-5xl md:text-7xl font-black tracking-tight">{slides[currentSlideIndex].title}</h2>
                                    <p className="text-2xl md:text-4xl leading-relaxed whitespace-pre-wrap max-w-4xl mx-auto">{slides[currentSlideIndex].content}</p>
                                </div>
                            )}

                            {slides[currentSlideIndex].layout === 'image-only' && (
                                <div className="flex flex-col items-center justify-center">
                                    {slides[currentSlideIndex].imageUrl ? (
                                        <img src={slides[currentSlideIndex].imageUrl} alt="Slide" className="max-h-[80vh] w-auto rounded-2xl shadow-2xl animate-in zoom-in duration-700" />
                                    ) : (
                                        <p className="text-4xl font-black opacity-20">Kein Bild vorhanden</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Navigation Footer */}
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
                            Möchtest du "{title}" wirklich endgültig entfernen? Diese Aktion kann nicht rückgängig gemacht werden.
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
