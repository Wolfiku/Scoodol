
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Loader2, ArrowLeft, Plus, Trash2, Play, Save, Check, 
    ChevronLeft, ChevronRight, X, Palette, 
    MoreHorizontal,
    Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, 
    Square, Circle, Minus, Type, 
    BringToFront, SendToBack, GripHorizontal, Copy, Strikethrough
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface SlideElement {
    id: string;
    type: 'text' | 'rect' | 'circle' | 'line';
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    width: number; // percentage 0-100
    height: number; // percentage 0-100
    content?: string;
    rotate?: number;
    styles: {
        backgroundColor?: string;
        borderColor?: string;
        borderWidth?: number;
        borderRadius?: number;
        color?: string;
        fontSize?: number;
        fontFamily?: string;
        textAlign?: 'left' | 'center' | 'right';
        fontWeight?: string;
        fontStyle?: string;
        textDecoration?: string;
        opacity?: number;
        zIndex: number;
    }
}

interface Slide {
    id: string;
    title: string;
    elements: SlideElement[];
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
    { name: 'Bangers', family: 'Bangers, cursive' },
];

const THEMES = [
    { id: 'default', name: 'Standard (Hell)', bg: 'bg-white', text: 'text-slate-900', accent: 'bg-primary' },
    { id: 'dark', name: 'Nacht-Modus', bg: 'bg-slate-950', text: 'text-slate-50', accent: 'bg-blue-600' },
    { id: 'ocean', name: 'Ozean-Blau', bg: 'bg-blue-900', text: 'text-blue-50', accent: 'bg-cyan-400' },
    { id: 'forest', name: 'Wald-Grün', bg: 'bg-emerald-950', text: 'text-emerald-50', accent: 'bg-lime-500' },
];

const COLORS = ['transparent', '#000000', '#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

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
        { 
            id: 's1', 
            title: 'Titel-Folie', 
            elements: [
                { 
                    id: 'e1', 
                    type: 'text', 
                    x: 10, y: 30, width: 80, height: 20, 
                    content: 'Meine Präsentation', 
                    styles: { fontSize: 48, fontWeight: '900', textAlign: 'center', zIndex: 1, color: '#000000', fontFamily: 'var(--font-pt-sans), sans-serif' } 
                },
                { 
                    id: 'e2', 
                    type: 'text', 
                    x: 20, y: 55, width: 60, height: 10, 
                    content: 'Untertitel hier einfügen', 
                    styles: { fontSize: 24, textAlign: 'center', zIndex: 2, color: '#64748b', fontFamily: 'var(--font-pt-sans), sans-serif' } 
                }
            ] 
        }
    ]);
    const [theme, setTheme] = useState<PresentationDoc['theme']>('default');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving'>('idle');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isPresenting, setIsPresenting] = useState(false);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [isEditingText, setIsEditingText] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [hasMovedDuringDrag, setHasMovedAtLeastOnce] = useState(false);
    
    const canvasRef = useRef<HTMLDivElement>(null);
    const dragOffset = useRef({ x: 0, y: 0 });

    const docRef = useMemoFirebase(() => 
        !isNewPres && user && typeof presId === 'string'
            ? doc(firestore, `users/${user.uid}/presentations`, presId)
            : null
    , [firestore, user, presId, isNewPres]);

    const { data: presentationData, isLoading: isLoadingPres } = useDoc<PresentationDoc>(docRef);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (presentationData) {
            setTitle(presentationData.title || '');
            setSlides(presentationData.slides || []);
            setTheme(presentationData.theme || 'default');
            setSaveStatus('idle');
        }
    }, [presentationData]);

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
            id: (Date.now() + Math.random()).toString(),
            title: 'Neue Folie',
            elements: [],
        };
        setSlides([...slides, newSlide]);
        setCurrentSlideIndex(slides.length);
        triggerAutoSave();
    };

    const deleteSlide = (id: string) => {
        if (slides.length <= 1) return;
        const newSlides = slides.filter(s => s.id !== id);
        setSlides(newSlides);
        if (currentSlideIndex >= newSlides.length) setCurrentSlideIndex(Math.max(0, newSlides.length - 1));
        triggerAutoSave();
    };

    const addElement = (type: SlideElement['type']) => {
        const currentSlide = slides[currentSlideIndex];
        if (!currentSlide) return;

        const newElement: SlideElement = {
            id: 'e' + (Date.now() + Math.random()).toString(36).substr(2, 9),
            type,
            x: 40,
            y: 40,
            width: type === 'line' ? 20 : 20,
            height: type === 'line' ? 1 : 20,
            content: type === 'text' ? 'Neuer Text' : undefined,
            styles: {
                backgroundColor: type === 'text' ? 'transparent' : '#3b82f6',
                color: type === 'text' ? '#000000' : undefined,
                fontSize: 24,
                fontFamily: 'var(--font-pt-sans), sans-serif',
                textAlign: 'center',
                zIndex: (currentSlide.elements?.length || 0) + 1,
                borderWidth: type === 'line' ? 0 : 0,
                borderColor: '#000000',
                borderRadius: type === 'circle' ? 9999 : 0,
                opacity: 1
            }
        };

        const newSlides = [...slides];
        if (!newSlides[currentSlideIndex].elements) newSlides[currentSlideIndex].elements = [];
        newSlides[currentSlideIndex].elements.push(newElement);
        setSlides(newSlides);
        setSelectedElementId(newElement.id);
        setIsEditingText(false);
        triggerAutoSave();
    };

    const updateElement = (elementId: string, updates: Partial<SlideElement>) => {
        if (!slides[currentSlideIndex]) return;
        const newSlides = [...slides];
        const elements = newSlides[currentSlideIndex].elements || [];
        const index = elements.findIndex(e => e.id === elementId);
        if (index !== -1) {
            elements[index] = { ...elements[index], ...updates };
            setSlides(newSlides);
            triggerAutoSave();
        }
    };

    const updateElementStyle = (elementId: string, styleUpdates: Partial<SlideElement['styles']>) => {
        if (!slides[currentSlideIndex]) return;
        const newSlides = [...slides];
        const elements = newSlides[currentSlideIndex].elements || [];
        const index = elements.findIndex(e => e.id === elementId);
        if (index !== -1) {
            elements[index].styles = { ...elements[index].styles, ...styleUpdates };
            setSlides(newSlides);
            triggerAutoSave();
        }
    };

    const deleteElement = (elementId: string) => {
        if (!slides[currentSlideIndex]) return;
        const newSlides = [...slides];
        newSlides[currentSlideIndex].elements = (newSlides[currentSlideIndex].elements || []).filter(e => e.id !== elementId);
        setSlides(newSlides);
        setSelectedElementId(null);
        setIsEditingText(false);
        triggerAutoSave();
    };

    const duplicateElement = () => {
        if (!selectedElementId || !slides[currentSlideIndex]) return;
        const elements = slides[currentSlideIndex].elements || [];
        const el = elements.find(e => e.id === selectedElementId);
        if (!el) return;

        const newElement: SlideElement = {
            ...el,
            id: 'e' + (Date.now() + Math.random()).toString(36).substr(2, 9),
            x: el.x + 2,
            y: el.y + 2,
            styles: { ...el.styles, zIndex: elements.length + 1 }
        };

        const newSlides = [...slides];
        newSlides[currentSlideIndex].elements.push(newElement);
        setSlides(newSlides);
        setSelectedElementId(newElement.id);
        triggerAutoSave();
    }

    const changeZIndex = (direction: 'front' | 'back') => {
        if (!selectedElementId || !slides[currentSlideIndex]) return;
        const elements = slides[currentSlideIndex].elements || [];
        const el = elements.find(e => e.id === selectedElementId);
        if (!el) return;
        
        const currentZ = el.styles.zIndex || 0;
        updateElementStyle(selectedElementId, { zIndex: direction === 'front' ? currentZ + 1 : Math.max(0, currentZ - 1) });
    };

    const onMouseDown = (e: React.MouseEvent, element: SlideElement) => {
        if (isPresenting) return;
        
        // If we are already editing text, let the browser handle clicks for cursor placement
        if (isEditingText && selectedElementId === element.id && element.type === 'text') {
            return;
        }

        // Prevent browser default behavior to allow custom dragging and prevent accidental text selection
        e.preventDefault();
        e.stopPropagation();

        const wasSelected = selectedElementId === element.id;

        if (!wasSelected) {
            setSelectedElementId(element.id);
            setIsEditingText(false);
        }

        setIsDragging(true);
        setHasMovedAtLeastOnce(false);
        
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
        const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

        dragOffset.current = {
            x: mouseX - element.x,
            y: mouseY - element.y
        };
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !selectedElementId || isPresenting) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
        const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

        let newX = mouseX - dragOffset.current.x;
        let newY = mouseY - dragOffset.current.y;

        // Keep within bounds
        newX = Math.max(-10, Math.min(110, newX));
        newY = Math.max(-10, Math.min(110, newY));

        updateElement(selectedElementId, { x: newX, y: newY });
        setHasMovedAtLeastOnce(true);
    };

    const onMouseUp = () => {
        setIsDragging(false);
    };

    const handleElementAction = (e: React.MouseEvent, element: SlideElement) => {
        if (isPresenting) return;
        
        // If it was just a click (no significant movement) on an already selected text element, enter edit mode
        if (!hasMovedDuringDrag && selectedElementId === element.id && element.type === 'text') {
            setIsEditingText(true);
        }
    }

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

    const currentSlide = slides[currentSlideIndex];
    const selectedElement = useMemo(() => 
        currentSlide?.elements?.find(e => e.id === selectedElementId),
    [currentSlide, selectedElementId]);

    const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0];

    const renderElement = (el: SlideElement, isPreview: boolean = false) => {
        const isSelected = !isPreview && selectedElementId === el.id;
        const isEditing = isSelected && isEditingText;

        const style: React.CSSProperties = {
            position: 'absolute',
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.width}%`,
            height: el.type === 'line' ? 'auto' : `${el.height}%`,
            zIndex: el.styles.zIndex,
            backgroundColor: el.styles.backgroundColor,
            borderColor: el.styles.borderColor,
            borderWidth: `${el.styles.borderWidth || 0}px`,
            borderStyle: el.styles.borderWidth ? 'solid' : 'none',
            borderRadius: `${el.styles.borderRadius || 0}px`,
            opacity: el.styles.opacity ?? 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: isDragging ? 'none' : 'all 0.1s',
            cursor: isPreview ? 'default' : (isDragging ? 'grabbing' : (isEditing ? 'text' : 'grab')),
            boxShadow: isSelected ? '0 0 0 2px hsl(var(--primary)), 0 0 0 4px rgba(59, 130, 246, 0.3)' : 'none',
            overflow: 'hidden'
        };

        if (el.type === 'line') {
            style.height = `${el.styles.borderWidth || 2}px`;
            style.backgroundColor = el.styles.borderColor || '#000000';
        }

        return (
            <div 
                key={el.id} 
                style={style}
                onMouseDown={(e) => onMouseDown(e, el)}
                onClick={(e) => handleElementAction(e, el)}
                className={cn("group select-none", el.type === 'text' && "p-2")}
            >
                {el.type === 'text' && (
                    <div 
                        style={{
                            fontSize: `${el.styles.fontSize || 24}px`,
                            fontFamily: el.styles.fontFamily || 'inherit',
                            textAlign: el.styles.textAlign || 'center',
                            fontWeight: el.styles.fontWeight || 'normal',
                            fontStyle: el.styles.fontStyle || 'normal',
                            textDecoration: el.styles.textDecoration || 'none',
                            color: el.styles.color || '#000000',
                            width: '100%',
                            outline: 'none',
                            cursor: isEditing ? 'text' : 'inherit'
                        }}
                        contentEditable={isEditing}
                        suppressContentEditableWarning
                        onBlur={(e) => {
                            updateElement(el.id, { content: e.currentTarget.innerText });
                            setIsEditingText(false);
                        }}
                    >
                        {el.content}
                    </div>
                )}
            </div>
        );
    };

    if (isUserLoading || (isLoadingPres && !isNewPres)) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
    }

    return (
        <div className="flex flex-col h-screen bg-background overflow-hidden" onMouseUp={onMouseUp} onMouseMove={onMouseMove}>
            <header className="bg-background border-b p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-4 flex-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/workspace')}><ArrowLeft className="h-5 w-5" /></Button>
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

            <div className="bg-secondary/20 border-b p-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-inner">
                <div className="flex items-center gap-1 border-r pr-2 pl-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm" className="h-8 font-black gap-2 rounded-full px-4">
                                <Plus className="h-4 w-4" /> Element
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Hinzufügen</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => addElement('text')} className="gap-2"><Type className="h-4 w-4"/> Textfeld</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => addElement('rect')} className="gap-2"><Square className="h-4 w-4"/> Rechteck</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => addElement('circle')} className="gap-2"><Circle className="h-4 w-4"/> Kreis</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => addElement('line')} className="gap-2"><Minus className="h-4 w-4"/> Linie</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {selectedElement ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-1 flex-nowrap shrink-0">
                        <Badge className="bg-primary/10 text-primary border-primary/20 mr-2 uppercase text-[10px]">{selectedElement.type}</Badge>
                        
                        {selectedElement.type === 'text' && (
                            <div className="flex items-center gap-1 border-r pr-2 shrink-0">
                                <Select value={selectedElement.styles.fontFamily} onValueChange={(v) => updateElementStyle(selectedElement.id, { fontFamily: v })}>
                                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>{FONTS.map(f => <SelectItem key={f.name} value={f.family} style={{fontFamily: f.family}}>{f.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <div className="flex items-center gap-0.5 ml-1">
                                    <Button variant={selectedElement.styles.fontWeight === 'bold' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => updateElementStyle(selectedElement.id, { fontWeight: selectedElement.styles.fontWeight === 'bold' ? 'normal' : 'bold' })}><Bold className="h-3.5 w-3.5" /></Button>
                                    <Button variant={selectedElement.styles.fontStyle === 'italic' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => updateElementStyle(selectedElement.id, { fontStyle: selectedElement.styles.fontStyle === 'italic' ? 'normal' : 'italic' })}><Italic className="h-3.5 w-3.5" /></Button>
                                    <Button variant={selectedElement.styles.textDecoration?.includes('underline') ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => updateElementStyle(selectedElement.id, { textDecoration: selectedElement.styles.textDecoration?.includes('underline') ? selectedElement.styles.textDecoration.replace('underline', '').trim() : `${selectedElement.styles.textDecoration || ''} underline`.trim() })}><Underline className="h-3.5 w-3.5" /></Button>
                                    <Button variant={selectedElement.styles.textDecoration?.includes('line-through') ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => updateElementStyle(selectedElement.id, { textDecoration: selectedElement.styles.textDecoration?.includes('line-through') ? selectedElement.styles.textDecoration.replace('line-through', '').trim() : `${selectedElement.styles.textDecoration || ''} line-through`.trim() })}><Strikethrough className="h-3.5 w-3.5" /></Button>
                                </div>
                                <div className="flex items-center gap-0.5 ml-1 border-l pl-1">
                                    <Button variant={selectedElement.styles.textAlign === 'left' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'left' })}><AlignLeft className="h-3.5 w-3.5" /></Button>
                                    <Button variant={selectedElement.styles.textAlign === 'center' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'center' })}><AlignCenter className="h-3.5 w-3.5" /></Button>
                                    <Button variant={selectedElement.styles.textAlign === 'right' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => updateElementStyle(selectedElement.id, { textAlign: 'right' })}><AlignRight className="h-3.5 w-3.5" /></Button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3 shrink-0">
                             <div className="flex flex-col gap-1">
                                <Label className="text-[10px] font-bold uppercase opacity-50">Farbe</Label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="outline" className="w-8 h-8 rounded-full p-0 overflow-hidden border-2" style={{backgroundColor: selectedElement.type === 'text' ? (selectedElement.styles.color || '#000') : (selectedElement.styles.backgroundColor || 'transparent')}} /></DropdownMenuTrigger>
                                    <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2">
                                        {COLORS.map(c => (
                                            <button 
                                                key={c} 
                                                className="w-6 h-6 rounded-full border border-border shadow-sm hover:scale-110 transition-transform" 
                                                style={{backgroundColor: c}} 
                                                onClick={() => updateElementStyle(selectedElement.id, selectedElement.type === 'text' ? { color: c } : { backgroundColor: c })}
                                            />
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                             </div>

                             <div className="flex flex-col gap-1 border-l pl-2">
                                <Label className="text-[10px] font-bold uppercase opacity-50">Format</Label>
                                <div className="flex items-center gap-2">
                                     <Input 
                                        type="number" 
                                        className="h-8 w-16 text-xs" 
                                        value={selectedElement.type === 'text' ? selectedElement.styles.fontSize : (selectedElement.type === 'line' ? selectedElement.styles.borderWidth : selectedElement.width)} 
                                        onChange={(e) => {
                                            const v = parseInt(e.target.value) || 0;
                                            if (selectedElement.type === 'text') updateElementStyle(selectedElement.id, { fontSize: v });
                                            else if (selectedElement.type === 'line') updateElementStyle(selectedElement.id, { borderWidth: v });
                                            else updateElement(selectedElement.id, { width: v, height: v });
                                        }}
                                    />
                                    {selectedElement.type !== 'text' && selectedElement.type !== 'line' && (
                                        <div className="flex items-center gap-1 border-l pl-2">
                                            <Label className="text-[10px]">Ecke</Label>
                                            <Input type="number" className="h-8 w-14 text-xs" value={selectedElement.styles.borderRadius || 0} onChange={(e) => updateElementStyle(selectedElement.id, { borderRadius: parseInt(e.target.value) || 0 })} />
                                        </div>
                                    )}
                                </div>
                             </div>

                             <div className="flex flex-col gap-1 border-l pl-2">
                                <Label className="text-[10px] font-bold uppercase opacity-50">Deckkraft</Label>
                                <div className="w-24 px-1">
                                    <Slider 
                                        value={[(selectedElement.styles.opacity ?? 1) * 100]} 
                                        min={0} 
                                        max={100} 
                                        step={1} 
                                        onValueChange={(v) => updateElementStyle(selectedElement.id, { opacity: v[0] / 100 })} 
                                    />
                                </div>
                             </div>

                             <div className="flex flex-col gap-1 border-l pl-2">
                                <Label className="text-[10px] font-bold uppercase opacity-50">Ebene</Label>
                                <div className="flex gap-0.5">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => changeZIndex('front')} title="Nach vorne"><BringToFront className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => changeZIndex('back')} title="Nach hinten"><SendToBack className="h-4 w-4"/></Button>
                                </div>
                             </div>

                             <div className="flex items-center gap-1 border-l pl-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={duplicateElement} title="Duplizieren"><Copy className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-full hover:bg-destructive/10" onClick={() => deleteElement(selectedElement.id)} title="Löschen"><Trash2 className="h-4 w-4"/></Button>
                             </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-xs text-muted-foreground italic flex items-center gap-2 px-4 h-8 animate-pulse">
                        <GripHorizontal className="h-3 w-3" /> Wähle ein Element zum Bearbeiten.
                    </div>
                )}
            </div>

            <main className="flex-1 flex overflow-hidden bg-secondary/10">
                <aside className="w-64 border-r bg-background overflow-y-auto p-4 space-y-4 no-scrollbar shrink-0">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Folien</h3>
                    {slides.map((slide, idx) => (
                        <div key={slide.id} className="relative group">
                            <div 
                                className={cn(
                                    "aspect-video border-2 rounded-lg cursor-pointer transition-all overflow-hidden bg-card relative shadow-sm",
                                    currentSlideIndex === idx ? "border-primary ring-2 ring-primary/10" : "hover:border-primary/40 border-muted"
                                )}
                                onClick={() => {
                                    setCurrentSlideIndex(idx);
                                    setSelectedElementId(null);
                                    setIsEditingText(false);
                                }}
                            >
                                <div className="absolute inset-0 scale-[0.25] origin-top-left pointer-events-none w-[400%] h-[400%]">
                                    {(slide.elements || []).map(el => renderElement(el, true))}
                                </div>
                                <div className="absolute bottom-1 right-2 text-[10px] font-black opacity-30">{idx + 1}</div>
                            </div>
                            <Button 
                                variant="destructive" 
                                size="icon" 
                                className="absolute -top-1 -right-1 h-5 w-5 rounded-full scale-0 group-hover:scale-100 transition-transform shadow-lg" 
                                onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                    <Button variant="outline" className="w-full border-dashed border-2 py-8 rounded-xl flex flex-col gap-2 hover:bg-primary/5 transition-all" onClick={addSlide}>
                        <Plus className="h-5 w-5" />
                        <span className="text-[10px] font-black uppercase">Folie hinzufügen</span>
                    </Button>
                </aside>

                <section className="flex-1 overflow-auto p-4 md:p-12 flex flex-col items-center">
                    {currentSlide ? (
                        <div className="w-full max-w-5xl space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="flex flex-col">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Folientitel</Label>
                                    <Input 
                                        value={currentSlide.title || ''} 
                                        onChange={(e) => {
                                            const ns = [...slides];
                                            ns[currentSlideIndex].title = e.target.value;
                                            setSlides(ns);
                                            triggerAutoSave();
                                        }}
                                        className="h-8 text-xl font-black border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent"
                                    />
                                </div>
                                <Badge variant="secondary" className="font-bold">Folie {currentSlideIndex + 1} / {slides.length}</Badge>
                            </div>

                            <div 
                                ref={canvasRef}
                                className={cn(
                                    "aspect-video w-full bg-card shadow-2xl rounded-2xl relative overflow-hidden transition-colors border-4",
                                    theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-white'
                                )}
                                onClick={(e) => {
                                    if (e.target === canvasRef.current) {
                                        setSelectedElementId(null);
                                        setIsEditingText(false);
                                    }
                                }}
                            >
                                {(currentSlide.elements || []).map(el => renderElement(el))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full opacity-50"><Loader2 className="animate-spin w-10 h-10 mb-4"/><p>Lade Folie...</p></div>
                    )}
                </section>
            </main>

            <Dialog open={isPresenting} onOpenChange={setIsPresenting}>
                <DialogContent className="max-w-none w-screen h-screen p-0 border-0 rounded-none bg-black">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Präsentation Vollbild</DialogTitle>
                        <DialogDescription>Aktuelle Folie anzeigen</DialogDescription>
                    </DialogHeader>
                    <div className={cn("w-full h-full flex flex-col items-center justify-center relative p-0 transition-all duration-500", currentTheme.bg, currentTheme.text)}>
                        <Button variant="ghost" size="icon" className="absolute top-6 right-6 rounded-full h-12 w-12 hover:bg-black/10 z-50 text-white mix-blend-difference" onClick={() => setIsPresenting(false)}>
                            <X className="h-6 w-6" />
                        </Button>

                        <div className="w-full h-full max-w-[177.78vh] max-h-[56.25vw] relative overflow-hidden">
                             {(currentSlide?.elements || []).map(el => renderElement(el, true))}
                        </div>

                        <div className="absolute bottom-8 left-0 right-0 px-12 flex justify-between items-center opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                            <div className="flex gap-4 pointer-events-auto">
                                <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 bg-black/10 backdrop-blur-md" disabled={currentSlideIndex === 0} onClick={() => setCurrentSlideIndex(p => p - 1)}><ChevronLeft className="h-8 w-8"/></Button>
                                <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 bg-black/10 backdrop-blur-md" disabled={currentSlideIndex === slides.length - 1} onClick={() => setCurrentSlideIndex(p => p + 1)}><ChevronRight className="h-8 w-8"/></Button>
                            </div>
                            <div className="text-xs font-black uppercase tracking-widest opacity-50 bg-black/10 px-4 py-2 rounded-full backdrop-blur-md">
                                {currentSlideIndex + 1} / {slides.length} • Scoodol
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
