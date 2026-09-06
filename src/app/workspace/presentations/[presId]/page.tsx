
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection, useStorage } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc, updateDoc, increment, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Loader2, ArrowLeft, Plus, Trash2, Play, Save, Check, 
    ChevronLeft, ChevronRight, X, 
    MoreHorizontal,
    Bold, Italic, Square, Circle, Minus, Type, 
    Copy, Palette, RotateCcw,
    Triangle, Star as StarIcon, MoveRight,
    ImageIcon, Video, Ghost, Lightbulb, AlertTriangle, CheckCircle2, Info, GraduationCap, BookOpen, Search, Library, LayoutGrid,
    Smile, Flag, Heart, Zap, Settings, MousePointer2
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
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SlideElement {
    id: string;
    type: 'text' | 'rect' | 'circle' | 'line' | 'triangle' | 'star' | 'arrow' | 'diamond' | 'image' | 'video' | 'icon';
    x: number;
    y: number;
    width: number;
    height: number;
    content?: string;
    iconName?: string;
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
        rotation?: number;
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

const COLORS = ['transparent', '#000000', '#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

const ICONS = [
    { name: 'Star', icon: StarIcon },
    { name: 'Idea', icon: Lightbulb },
    { name: 'Warning', icon: AlertTriangle },
    { name: 'Check', icon: CheckCircle2 },
    { name: 'Info', icon: Info },
    { name: 'School', icon: GraduationCap },
    { name: 'Book', icon: BookOpen },
    { name: 'Search', icon: Search },
    { name: 'User', icon: Ghost },
    { name: 'Smile', icon: Smile },
    { name: 'Heart', icon: Heart },
    { name: 'Zap', icon: Zap },
    { name: 'Flag', icon: Flag },
    { name: 'Settings', icon: Settings },
];

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';

export default function PresentationPage() {
    const router = useRouter();
    const params = useParams();
    const presId = params?.presId as string;
    const isNewPres = presId === 'new';

    const { toast } = useToast();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const storage = useStorage();

    const [title, setTitle] = useState('');
    const [slides, setSlides] = useState<Slide[]>([
        { 
            id: 's1', 
            title: 'Titel-Folie', 
            elements: [
                { 
                    id: 'e1', 
                    type: 'text', 
                    x: 10, y: 35, width: 80, height: 20, 
                    content: 'Meine Präsentation', 
                    styles: { fontSize: 48, fontWeight: '900', textAlign: 'center', zIndex: 1, color: '#000000', fontFamily: 'var(--font-pt-sans), sans-serif', rotation: 0 } 
                }
            ] 
        }
    ]);
    
    const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving'>('idle');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isPresenting, setIsPresenting] = useState(false);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [isEditingText, setIsEditingText] = useState(false);
    const [interactionMode, setInteractionMode] = useState<'none' | 'drag' | 'resize' | 'rotate'>('none');
    const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandle | null>(null);
    const [activeGuides, setGuides] = useState<{x: number | null, y: number | null}>({ x: null, y: null });
    
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);

    const canvasRef = useRef<HTMLDivElement>(null);
    const hasDraggedRef = useRef(false);
    const selectionAtStartOfPointerDown = useRef<string | null>(null);
    const initialDragState = useRef<{ 
        x: number, y: number, 
        elX: number, elY: number, 
        elW: number, elH: number, 
        startFontSize: number, startRotation: number
    } | null>(null);

    const hasInitialized = useRef(false);

    const docRef = useMemoFirebase(() => 
        !isNewPres && user && typeof presId === 'string'
            ? doc(firestore, `users/${user.uid}/presentations`, presId)
            : null
    , [firestore, user, presId, isNewPres]);

    const { data: presentationData, isLoading: isLoadingPres } = useDoc<PresentationDoc>(docRef);
    const mediaRef = useMemoFirebase(() => user ? collection(firestore, `users/${user.uid}/media`) : null, [firestore, user]);
    const mediaQuery = useMemoFirebase(() => mediaRef ? query(mediaRef, orderBy('createdAt', 'desc')) : null, [mediaRef]);
    const { data: userMedia } = useCollection<any>(mediaQuery);

    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (presentationData && !hasInitialized.current) {
            setTitle(presentationData.title || '');
            setSlides(Array.isArray(presentationData.slides) ? presentationData.slides : slides);
            setSaveStatus('idle');
            hasInitialized.current = true;
        }
    }, [presentationData]);

    const handleSave = useCallback(async () => {
        if (!firestore || !user || !title.trim()) return;
        setSaveStatus('saving');
        const dataToSave = { title, slides, ownerId: user.uid, updatedAt: serverTimestamp() };
        try {
            if (isNewPres) {
                const colRef = collection(firestore, `users/${user.uid}/presentations`);
                const newDoc = await addDoc(colRef, { ...dataToSave, createdAt: serverTimestamp() });
                router.replace(`/workspace/presentations/${newDoc.id}`);
            } else if (docRef) {
                await setDoc(docRef, dataToSave, { merge: true });
            }
            setSaveStatus('idle');
        } catch (error) {
            setSaveStatus('dirty');
        }
    }, [firestore, user, title, slides, isNewPres, docRef, router]);

    useEffect(() => {
        if (!hasInitialized.current && !isNewPres) return;
        setSaveStatus('dirty');
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(handleSave, 2000);
        return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    }, [title, slides, isNewPres, handleSave]);

    const currentSlide = useMemo(() => (Array.isArray(slides) && slides[currentSlideIndex]) || { id: 'fallback', title: '', elements: [] }, [slides, currentSlideIndex]);
    const selectedElement = useMemo(() => (Array.isArray(currentSlide?.elements) ? currentSlide.elements.find(e => e.id === selectedElementId) : null), [currentSlide, selectedElementId]);

    const updateElement = (elementId: string, updates: Partial<SlideElement>) => {
        setSlides(prevSlides => {
            const newSlides = [...prevSlides];
            const slide = { ...newSlides[currentSlideIndex] };
            slide.elements = (Array.isArray(slide.elements) ? slide.elements.map(el => el.id === elementId ? { ...el, ...updates } : el) : []);
            newSlides[currentSlideIndex] = slide;
            return newSlides;
        });
    };

    const updateElementStyle = (elementId: string, styleUpdates: Partial<SlideElement['styles']>) => {
        setSlides(prevSlides => {
            const newSlides = [...prevSlides];
            const slide = { ...newSlides[currentSlideIndex] };
            slide.elements = (Array.isArray(slide.elements) ? slide.elements.map(el => el.id === elementId ? { ...el, styles: { ...el.styles, ...styleUpdates } } : el) : []);
            newSlides[currentSlideIndex] = slide;
            return newSlides;
        });
    };

    const calculateGuides = (newX: number, newY: number, newW: number, newH: number) => {
        const threshold = 1.0; 
        let guideX: number | null = null, guideY: number | null = null, snappedX = newX, snappedY = newY;
        const xPoints = [0, 50 - newW / 2, 100 - newW], yPoints = [0, 50 - newH / 2, 100 - newH];
        for (const py of yPoints) { if (Math.abs(newY - py) < threshold) { snappedY = py; guideY = py + newH / 2; break; } }
        for (const px of xPoints) { if (Math.abs(newX - px) < threshold) { snappedX = px; guideX = px + newW / 2; break; } }
        return { guideX, guideY, snappedX, snappedY };
    };

    const handleGlobalPointerMove = useCallback((e: PointerEvent) => {
        if (interactionMode === 'none' || !selectedElementId || !canvasRef.current || !initialDragState.current || !selectedElement) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const currentMouseX = ((e.clientX - rect.left) / rect.width) * 100, currentMouseY = ((e.clientY - rect.top) / rect.height) * 100;
        const deltaX = currentMouseX - initialDragState.current.x, deltaY = currentMouseY - initialDragState.current.y;

        if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
            hasDraggedRef.current = true;
        }

        if (interactionMode === 'drag') {
            const rawX = initialDragState.current.elX + deltaX, rawY = initialDragState.current.elY + deltaY;
            const { guideX, guideY, snappedX, snappedY } = calculateGuides(rawX, rawY, initialDragState.current.elW, initialDragState.current.elH);
            setGuides({ x: guideX, y: guideY });
            updateElement(selectedElementId, { x: snappedX, y: snappedY });
        } else if (interactionMode === 'resize' && activeResizeHandle) {
            let { elX, elY, elW, elH, startFontSize } = initialDragState.current;
            if (activeResizeHandle.includes('r')) elW = Math.max(1, initialDragState.current.elW + deltaX);
            if (activeResizeHandle.includes('l')) { elX = initialDragState.current.elX + deltaX; elW = Math.max(1, initialDragState.current.elW - deltaX); }
            if (activeResizeHandle.includes('b')) elH = Math.max(1, initialDragState.current.elH + deltaY);
            if (activeResizeHandle.includes('t')) { elY = initialDragState.current.elY + deltaY; elH = Math.max(1, initialDragState.current.elH - deltaY); }
            if (selectedElement?.type === 'text' && ['tl', 'tr', 'bl', 'br'].includes(activeResizeHandle)) {
                updateElementStyle(selectedElementId, { fontSize: Math.max(8, Math.round(startFontSize * (elH / initialDragState.current.elH))) });
            }
            updateElement(selectedElementId, { x: elX, y: elY, width: elW, height: elH });
        } else if (interactionMode === 'rotate') {
            const centerX = selectedElement.x + selectedElement.width / 2, centerY = selectedElement.y + selectedElement.height / 2;
            let angleDeg = (Math.atan2(currentMouseY - centerY, currentMouseX - centerX) * 180) / Math.PI + 90;
            if (Math.abs(angleDeg - Math.round(angleDeg / 45) * 45) < 5) angleDeg = Math.round(angleDeg / 45) * 45;
            updateElementStyle(selectedElementId, { rotation: angleDeg });
        }
    }, [interactionMode, selectedElementId, activeResizeHandle, currentSlideIndex, selectedElement]);

    const handleGlobalPointerUp = useCallback(() => {
        setInteractionMode('none'); setActiveResizeHandle(null); setGuides({ x: null, y: null });
        initialDragState.current = null;
    }, []);

    useEffect(() => {
        if (interactionMode !== 'none') {
            window.addEventListener('pointermove', handleGlobalPointerMove, { passive: false });
            window.addEventListener('pointerup', handleGlobalPointerUp);
        }
        return () => { window.removeEventListener('pointermove', handleGlobalPointerMove); window.removeEventListener('pointerup', handleGlobalPointerUp); };
    }, [interactionMode, handleGlobalPointerMove, handleGlobalPointerUp]);

    const onPointerDown = (e: React.PointerEvent, element: SlideElement) => {
        if (isPresenting) return;
        e.stopPropagation(); hasDraggedRef.current = false;
        selectionAtStartOfPointerDown.current = selectedElementId;
        if (selectedElementId !== element.id) { setSelectedElementId(element.id); setIsEditingText(false); }
        if (isEditingText) return;
        const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
        initialDragState.current = { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100, elX: element.x, elY: element.y, elW: element.width, elH: element.height, startFontSize: element.styles.fontSize || 24, startRotation: element.styles.rotation || 0 };
        setInteractionMode('drag');
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handleElementClick = (e: React.MouseEvent, element: SlideElement) => {
        if (isPresenting || hasDraggedRef.current) return;
        if (element.type === 'text' && selectionAtStartOfPointerDown.current === element.id && !isEditingText) {
            e.stopPropagation(); setIsEditingText(true);
            const target = e.currentTarget;
            const editable = target.querySelector('[contenteditable]') as HTMLElement;
            if (editable) {
                editable.setAttribute('contenteditable', 'true');
                editable.focus();
                const selection = window.getSelection(), range = document.createRange();
                range.selectNodeContents(editable); range.collapse(false);
                selection?.removeAllRanges(); selection?.addRange(range);
            }
        }
    };

    const handleResizeStart = (e: React.PointerEvent, handle: ResizeHandle) => {
        if (isPresenting || !selectedElement) return;
        e.stopPropagation(); e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
        initialDragState.current = { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100, elX: selectedElement.x, elY: selectedElement.y, elW: selectedElement.width, elH: selectedElement.height, startFontSize: selectedElement.styles.fontSize || 24, startRotation: selectedElement.styles.rotation || 0 };
        setInteractionMode('resize'); setActiveResizeHandle(handle);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handleRotateHandleStart = (e: React.PointerEvent) => {
        if (isPresenting || !selectedElement) return;
        e.stopPropagation(); e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
        initialDragState.current = { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100, elX: selectedElement.x, elY: selectedElement.y, elW: selectedElement.width, elH: selectedElement.height, startFontSize: selectedElement.styles.fontSize || 24, startRotation: selectedElement.styles.rotation || 0 };
        setInteractionMode('rotate'); (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const addElement = (type: SlideElement['type'], extra?: any) => {
        const newElement: SlideElement = {
            id: 'e' + Math.random().toString(36).substr(2, 9),
            type, x: 40, y: 40,
            width: (type === 'line') ? 20 : (type === 'text' ? 30 : 20),
            height: (type === 'line') ? 1 : 15,
            content: type === 'text' ? 'Neuer Text' : (['image', 'video'].includes(type) ? extra?.url : undefined),
            iconName: type === 'icon' ? extra?.iconName : undefined,
            styles: {
                backgroundColor: (['text', 'image', 'video', 'icon'].includes(type)) ? 'transparent' : '#3b82f6',
                color: (type === 'text' || type === 'icon') ? '#000000' : undefined,
                fontSize: type === 'icon' ? 60 : 24,
                fontFamily: 'var(--font-pt-sans), sans-serif',
                textAlign: 'center',
                zIndex: (Array.isArray(currentSlide?.elements) ? currentSlide.elements.length : 0) + 1,
                borderWidth: type === 'line' ? 4 : (['rect', 'circle', 'image', 'text'].includes(type) ? 0 : 2),
                borderColor: '#000000', borderRadius: type === 'circle' ? 9999 : (type === 'image' ? 12 : 0),
                opacity: 1, rotation: 0
            }
        };
        const newSlides = [...slides];
        if (!Array.isArray(newSlides[currentSlideIndex].elements)) newSlides[currentSlideIndex].elements = [];
        newSlides[currentSlideIndex].elements.push(newElement);
        setSlides(newSlides); setSelectedElementId(newElement.id); setIsEditingText(false);
        setIsGalleryOpen(false); setIsLibraryOpen(false);
    };

    const duplicateElement = (elId: string) => {
        const el = currentSlide.elements.find(e => e.id === elId); if (!el) return;
        const newEl = { ...JSON.parse(JSON.stringify(el)), id: 'e' + Math.random().toString(36).substr(2, 9), x: el.x + 2, y: el.y + 2 };
        const newSlides = [...slides]; newSlides[currentSlideIndex].elements.push(newEl);
        setSlides(newSlides); setSelectedElementId(newEl.id);
    };

    const deleteElement = (elId: string) => {
        const newSlides = [...slides]; newSlides[currentSlideIndex].elements = (Array.isArray(newSlides[currentSlideIndex].elements) ? newSlides[currentSlideIndex].elements.filter(e => e.id !== elId) : []);
        setSlides(newSlides); setSelectedElementId(null);
    };

    const renderElement = (el: SlideElement, isPreview: boolean = false) => {
        const isSelected = !isPreview && selectedElementId === el.id;
        const isEditing = isSelected && isEditingText;
        const style: React.CSSProperties = {
            position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`, height: el.type === 'line' ? 'auto' : `${el.height}%`, zIndex: el.styles.zIndex,
            backgroundColor: (el.type === 'line' || ['triangle', 'star', 'arrow', 'diamond', 'image', 'video', 'icon'].includes(el.type)) ? 'transparent' : el.styles.backgroundColor,
            borderColor: el.styles.borderColor, borderWidth: (el.type === 'line' || ['triangle', 'star', 'arrow', 'diamond', 'image', 'video', 'icon', 'text'].includes(el.type)) ? 0 : `${el.styles.borderWidth || 0}px`,
            borderRadius: `${el.styles.borderRadius || 0}px`, opacity: el.styles.opacity ?? 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isPreview ? 'default' : (isEditing ? 'text' : 'pointer'),
            boxShadow: isSelected && !['line', 'video'].includes(el.type) ? '0 0 0 2px hsl(var(--primary))' : 'none',
            transform: `rotate(${el.styles.rotation || 0}deg)`, userSelect: isEditing ? 'text' : 'none', touchAction: 'none'
        };

        if (el.type === 'line') {
            const thickness = el.styles.borderWidth || 4;
            style.height = `${thickness}px`; style.backgroundColor = el.styles.borderColor || '#000000';
        }

        const renderShape = () => {
            const strokeProps = { stroke: el.styles.borderColor || '#000', strokeWidth: el.styles.borderWidth || 0, fill: el.styles.backgroundColor || '#3b82f6' };
            switch(el.type) {
                case 'triangle': return <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,5 5,95 95,95" {...strokeProps} /></svg>;
                case 'star': return <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,5 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35" {...strokeProps} /></svg>;
                case 'arrow': return <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="5,30 65,30 65,10 95,50 65,90 65,70 5,70" {...strokeProps} /></svg>;
                case 'icon':
                    const IconComp = ICONS.find(i => i.name === el.iconName)?.icon || StarIcon;
                    return <IconComp style={{ width: '100%', height: '100%', color: el.styles.color }} />;
                case 'image': return <img src={el.content} className="w-full h-full object-cover pointer-events-none" style={{ borderRadius: 'inherit' }} alt="" />;
                case 'video': 
                    if (el.content?.includes('youtube.com') || el.content?.includes('youtu.be')) {
                        return <iframe src={el.content} className="w-full h-full pointer-events-none" frameBorder="0" allowFullScreen />;
                    }
                    return <video src={el.content} className="w-full h-full object-contain pointer-events-none" controls={isPresenting} />;
                default: return null;
            }
        };

        return (
            <div key={el.id} style={style} onPointerDown={(e) => onPointerDown(e, el)} onClick={(e) => handleElementClick(e, el)}>
                {['triangle', 'star', 'arrow', 'icon', 'image', 'video'].includes(el.type) && renderShape()}
                {el.type === 'text' && (
                    <div style={{ fontSize: `${el.styles.fontSize || 24}px`, fontFamily: el.styles.fontFamily || 'inherit', textAlign: el.styles.textAlign || 'center', fontWeight: el.styles.fontWeight === 'bold' ? 'bold' : 'normal', fontStyle: el.styles.fontStyle === 'italic' ? 'italic' : 'normal', color: el.styles.color || '#000000', width: '100%', outline: 'none' }} contentEditable={isEditing} suppressContentEditableWarning onBlur={(e) => { updateElement(el.id, { content: e.currentTarget.innerText }); setIsEditingText(false); }}>{el.content}</div>
                )}
                {isSelected && !isPreview && !isEditingText && (
                    <>
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-[100]" onPointerDown={handleRotateHandleStart}><div className="w-8 h-8 bg-white border-2 border-primary rounded-full shadow-xl flex items-center justify-center hover:bg-primary hover:text-white transition-colors"><RotateCcw className="w-4 h-4" /></div><div className="w-0.5 h-4 bg-primary" /></div>
                        <div className="absolute -top-1.5 -left-1.5 w-6 h-6 bg-white border-2 border-primary rounded-full cursor-nwse-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'tl')} />
                        <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-white border-2 border-primary rounded-full cursor-nesw-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'tr')} />
                        <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 bg-white border-2 border-primary rounded-full cursor-nesw-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'bl')} />
                        <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-white border-2 border-primary rounded-full cursor-nwse-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'br')} />
                    </>
                )}
            </div>
        );
    };

    if (isUserLoading || (isLoadingPres && !isNewPres)) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

    return (
        <div className="flex flex-col h-screen bg-background overflow-hidden fixed inset-0">
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Dancing+Script:wght@400;700&family=Fira+Code:wght@400;700&family=Montserrat:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap');
                body { overflow: hidden !important; touch-action: none; overscroll-behavior: none; user-select: none; }
            `}</style>

            <div className="bg-background border-b p-2 flex items-center justify-between sticky top-0 z-30 shadow-sm gap-4">
                <div className="flex items-center gap-3 shrink-0 px-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => router.push('/workspace')}><ArrowLeft className="h-4 w-4" /></Button>
                    <div className="flex flex-col">
                        <Input value={title} placeholder="Titel..." onChange={e => setTitle(e.target.value)} className="h-6 text-sm font-black border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent w-32 md:w-48" />
                        <div className="flex items-center gap-1.5 opacity-40 text-[9px] font-black uppercase"><span>Folie {currentSlideIndex + 1}/{slides.length}</span><span>• {saveStatus === 'saving' ? 'Speichert...' : 'Gespeichert'}</span></div>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-secondary/20 p-1 rounded-full shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-primary/10 text-primary"><Plus className="h-6 w-6" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 p-2 rounded-2xl">
                            <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Basics</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => addElement('text')} className="gap-2"><Type className="h-4 w-4"/> Textfeld</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Formen</DropdownMenuLabel>
                            <div className="grid grid-cols-3 gap-1">
                                <DropdownMenuItem onClick={() => addElement('rect')} className="justify-center p-2"><Square className="h-5 w-5"/></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addElement('circle')} className="justify-center p-2"><Circle className="h-5 w-5"/></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addElement('triangle')} className="justify-center p-2"><Triangle className="h-5 w-5"/></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addElement('star')} className="justify-center p-2"><StarIcon className="h-5 w-5"/></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addElement('arrow')} className="justify-center p-2"><MoveRight className="h-5 w-5"/></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addElement('line')} className="justify-center p-2"><Minus className="h-5 w-5"/></DropdownMenuItem>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-primary/10 text-primary" onClick={() => setIsGalleryOpen(true)}><ImageIcon className="h-6 w-6" /></Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-primary/10 text-primary" onClick={() => setIsLibraryOpen(true)}><Library className="h-6 w-6" /></Button>

                    {selectedElement && (
                        <div className="flex items-center gap-1 border-l pl-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            {selectedElement.type === 'text' && (
                                <>
                                    <Select value={selectedElement.styles.fontFamily} onValueChange={(v) => updateElementStyle(selectedElement.id, { fontFamily: v })}><SelectTrigger className="h-8 w-24 text-[10px]"><SelectValue /></SelectTrigger><SelectContent>{FONTS.map(f => <SelectItem key={f.name} value={f.family} style={{fontFamily: f.family}}>{f.name}</SelectItem>)}</SelectContent></Select>
                                    <div className="flex items-center gap-1 ml-1"><span className="text-[10px] font-black opacity-30 px-1">PX</span><Input type="number" value={selectedElement.styles.fontSize || 24} onChange={e => updateElementStyle(selectedElement.id, { fontSize: Number(e.target.value) })} className="h-8 w-12 text-[10px] p-1 text-center bg-background border-none rounded-md" /></div>
                                    <Button variant={selectedElement.styles.fontWeight === 'bold' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => updateElementStyle(selectedElement.id, { fontWeight: selectedElement.styles.fontWeight === 'bold' ? 'normal' : 'bold' })}><Bold className="h-4 w-4" /></Button>
                                    <Button variant={selectedElement.styles.fontStyle === 'italic' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => updateElementStyle(selectedElement.id, { fontStyle: selectedElement.styles.fontStyle === 'italic' ? 'normal' : 'italic' })}><Italic className="h-4 w-4" /></Button>
                                </>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="outline" className="w-7 h-7 rounded-full p-0 border-2" style={{backgroundColor: (['text', 'line', 'icon'].includes(selectedElement.type)) ? (selectedElement.styles.color || selectedElement.styles.borderColor || '#000') : (selectedElement.styles.backgroundColor || '#3b82f6')}} /></DropdownMenuTrigger>
                                <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2">{COLORS.map(c => (<button key={c} className="w-6 h-6 rounded-full border" style={{backgroundColor: c}} onClick={() => updateElementStyle(selectedElement.id, (['text', 'icon'].includes(selectedElement.type)) ? { color: c } : (selectedElement.type === 'line' ? { borderColor: c } : { backgroundColor: c }))} />))}</DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateElement(selectedElement.id)}><Copy className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteElement(selectedElement.id)}><Trash2 className="h-4 w-4"/></Button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 shrink-0 px-2">
                    <Button size="sm" onClick={() => { setIsPresenting(true); setCurrentSlideIndex(0); }} className="font-black gap-2 h-9 rounded-full bg-primary hover:bg-primary/90 text-xs px-5"><Play className="h-4 w-4 fill-current" /> Präsentieren</Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Präsentation löschen</DropdownMenuItem></DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <main className="flex-1 flex overflow-hidden bg-secondary/10">
                <aside className="w-48 border-r bg-background flex flex-col shrink-0">
                    <ScrollArea className="flex-1 p-3">
                        <div className="space-y-3">
                            {Array.isArray(slides) && slides.map((slide, idx) => (
                                <div key={slide.id} className="relative group">
                                    <div className={cn("aspect-video border-2 rounded-lg cursor-pointer transition-all overflow-hidden bg-card relative shadow-sm", currentSlideIndex === idx ? "border-primary ring-2 ring-primary/10" : "hover:border-primary/40 border-muted")} onClick={() => { setCurrentSlideIndex(idx); setSelectedElementId(null); setIsEditingText(false); }}>
                                        <div className="absolute inset-0 scale-[0.25] origin-top-left pointer-events-none w-[400%] h-[400%]">{Array.isArray(slide.elements) && slide.elements.map(el => renderElement(el, true))}</div>
                                    </div>
                                    <Button variant="destructive" size="icon" className="absolute -top-1 -right-1 h-5 w-5 rounded-full scale-0 group-hover:scale-100 transition-transform shadow-lg" onClick={(e) => { e.stopPropagation(); if(slides.length > 1) { setSlides(slides.filter(s => s.id !== slide.id)); if(currentSlideIndex >= slides.length - 1) setCurrentSlideIndex(slides.length - 2); } }}><X className="h-3 w-3" /></Button>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <div className="p-3 border-t bg-background shrink-0 pb-10">
                        <Button variant="outline" className="w-full h-14 border-dashed border-2 rounded-xl font-bold gap-2" onClick={() => { setSlides([...slides, { id: Math.random().toString(36).substr(2, 9), title: 'Neue Folie', elements: [] }]); setCurrentSlideIndex(slides.length); }}><Plus className="h-5 w-5" /> Folie</Button>
                    </div>
                </aside>

                <section className="flex-1 overflow-hidden p-4 md:p-8 flex items-center justify-center relative" onPointerDown={() => { setSelectedElementId(null); setIsEditingText(false); }}>
                    <div ref={canvasRef} className="aspect-video w-full max-w-5xl bg-white shadow-2xl rounded-2xl relative overflow-hidden border-4 border-white touch-none" style={{ height: 'fit-content' }}>
                        {activeGuides.x !== null && <div className="absolute top-0 bottom-0 w-[1.5px] bg-purple-500 z-[100] pointer-events-none" style={{ left: `${activeGuides.x}%` }} />}
                        {activeGuides.y !== null && <div className="absolute left-0 right-0 h-[1.5px] bg-purple-500 z-[100] pointer-events-none" style={{ top: `${activeGuides.y}%` }} />}
                        {Array.isArray(currentSlide?.elements) && currentSlide.elements.map(el => renderElement(el))}
                    </div>
                </section>
            </main>

            <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
                <DialogContent className="max-w-none w-screen h-screen p-0 border-0 rounded-none bg-background flex flex-col">
                    <DialogHeader className="p-6 border-b flex flex-row justify-between items-center space-y-0">
                        <div>
                            <DialogTitle className="text-3xl font-black">Deine Galerie</DialogTitle>
                            <DialogDescription>Wähle ein Bild oder Video aus deinen Uploads aus.</DialogDescription>
                        </div>
                        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsGalleryOpen(false)}><X className="h-6 w-6"/></Button>
                    </DialogHeader>
                    <ScrollArea className="flex-1 p-8 bg-secondary/10">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 max-w-7xl mx-auto">
                            {Array.isArray(userMedia) && userMedia.length > 0 ? userMedia.map((media: any) => (
                                <Card key={media.id} className="cursor-pointer hover:ring-4 hover:ring-primary/40 transition-all rounded-2xl overflow-hidden group shadow-sm bg-card" onClick={() => addElement(media.type, { url: media.url })}>
                                    <div className="aspect-video relative bg-muted">
                                        {media.type === 'image' ? <img src={media.url} className="w-full h-full object-cover" alt="" /> : <video src={media.url} className="w-full h-full object-cover" />}
                                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Plus className="h-8 w-8 text-white drop-shadow-md" /></div>
                                    </div>
                                    <div className="p-3 text-[10px] font-black uppercase tracking-tight text-center truncate bg-background border-t">{media.name}</div>
                                </Card>
                            )) : (
                                <div className="col-span-full py-20 text-center text-muted-foreground"><ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-20" /><p>Noch keine Medien hochgeladen.</p></div>
                            )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
                <DialogContent className="max-w-none w-screen h-screen p-0 border-0 rounded-none bg-background flex flex-col">
                    <DialogHeader className="p-6 border-b flex flex-row justify-between items-center space-y-0">
                        <div>
                            <DialogTitle className="text-3xl font-black">Bibliothek</DialogTitle>
                            <DialogDescription>Entdecke Symbole und fortgeschrittene Elemente.</DialogDescription>
                        </div>
                        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsLibraryOpen(false)}><X className="h-6 w-6"/></Button>
                    </DialogHeader>
                    <ScrollArea className="flex-1 p-8 bg-secondary/10">
                        <div className="max-w-5xl mx-auto space-y-12">
                            <section>
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Zap className="text-primary h-5 w-5" /> Icons & Symbole</h3>
                                <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-4">
                                    {ICONS.map(icon => (
                                        <button key={icon.name} className="flex flex-col items-center gap-3 p-6 bg-card border rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group" onClick={() => addElement('icon', { iconName: icon.name })}>
                                            <icon.icon className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{icon.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                            <section>
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><LayoutGrid className="text-primary h-5 w-5" /> Layout-Elemente</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <Card className="p-8 cursor-pointer hover:bg-primary/5 transition-all text-center space-y-4" onClick={() => addElement('rect', { styles: { backgroundColor: '#f4f4f5', borderRadius: 24, zIndex: 0 } })}>
                                        <div className="w-20 h-20 bg-secondary rounded-2xl mx-auto border-2 border-dashed flex items-center justify-center"><Square className="h-8 w-8 text-muted-foreground" /></div>
                                        <p className="font-bold">Info-Box Hintergrund</p>
                                    </Card>
                                    <Card className="p-8 cursor-pointer hover:bg-primary/5 transition-all text-center space-y-4" onClick={() => addElement('line', { styles: { borderWidth: 8, borderColor: '#3b82f6', zIndex: 1 } })}>
                                        <div className="w-20 h-4 bg-primary rounded-full mx-auto" />
                                        <p className="font-bold">Markante Trennlinie</p>
                                    </Card>
                                </div>
                            </section>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <Dialog open={isPresenting} onOpenChange={setIsPresenting}>
                <DialogContent className="max-w-none w-screen h-screen p-0 border-0 rounded-none bg-black">
                    <DialogTitle className="sr-only">Präsentation: {title}</DialogTitle>
                    <DialogDescription className="sr-only">Vollbild-Präsentationsmodus</DialogDescription>
                    <div className="w-full h-full flex items-center justify-center relative bg-white">
                        <Button variant="ghost" size="icon" className="absolute top-6 right-6 rounded-full h-10 w-10 z-50 mix-blend-difference text-white" onClick={() => setIsPresenting(false)}><X className="h-6 w-6" /></Button>
                        <div className="w-full aspect-video relative overflow-hidden">{Array.isArray(currentSlide?.elements) && currentSlide.elements.map(el => renderElement(el, true))}</div>
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/10 backdrop-blur-md px-6 py-2 rounded-full opacity-0 hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" disabled={currentSlideIndex === 0} onClick={() => setCurrentSlideIndex(p => p - 1)}><ChevronLeft/></Button>
                            <span className="text-[10px] font-black uppercase tracking-widest">{currentSlideIndex + 1} / {slides.length}</span>
                            <Button variant="ghost" size="icon" disabled={currentSlideIndex === slides.length - 1} onClick={() => setCurrentSlideIndex(p + 1)}><ChevronRight/></Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Präsentation löschen?</AlertDialogTitle>
                        <AlertDialogDescription>Möchtest du "{title}" wirklich löschen?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => { if (docRef) { await deleteDoc(docRef); router.push('/workspace'); } }} className="bg-destructive text-white">Löschen</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
