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
    ChevronLeft, ChevronRight, X, 
    MoreHorizontal,
    Bold, Italic, Square, Circle, Minus, Type, 
    Copy, Palette, RotateCcw
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

interface SlideElement {
    id: string;
    type: 'text' | 'rect' | 'circle' | 'line';
    x: number;
    y: number;
    width: number;
    height: number;
    content?: string;
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

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';

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
    
    const canvasRef = useRef<HTMLDivElement>(null);
    const initialDragState = useRef<{ x: number, y: number, elX: number, elY: number, elW: number, elH: number, startFontSize: number } | null>(null);
    const initialTouchDistance = useRef(0);
    const initialElementSize = useRef<{ w: number, h: number, x: number, y: number, fs: number } | null>(null);

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
            setSaveStatus('idle');
        }
    }, [presentationData]);

    const handleSave = useCallback(async () => {
        if (!firestore || !user || !title.trim()) return;
        setSaveStatus('saving');

        try {
            if (isNewPres) {
                const colRef = collection(firestore, `users/${user.uid}/presentations`);
                const newDoc = await addDoc(colRef, {
                    title,
                    slides,
                    ownerId: user.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                router.replace(`/workspace/presentations/${newDoc.id}`);
            } else if (docRef) {
                await setDoc(docRef, { title, slides, updatedAt: serverTimestamp() }, { merge: true });
            }
            setSaveStatus('idle');
        } catch (error) {
            setSaveStatus('dirty');
        }
    }, [firestore, user, title, slides, isNewPres, docRef, router]);

    const triggerAutoSave = () => {
        setSaveStatus('dirty');
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(handleSave, 2000);
    };

    const currentSlide = useMemo(() => 
        slides[currentSlideIndex] || { id: 'fallback', title: '', elements: [] },
    [slides, currentSlideIndex]);

    const selectedElement = useMemo(() => 
        currentSlide.elements?.find(e => e.id === selectedElementId),
    [currentSlide, selectedElementId]);

    const updateElement = (elementId: string, updates: Partial<SlideElement>) => {
        setSlides(prevSlides => {
            const newSlides = [...prevSlides];
            const slide = { ...newSlides[currentSlideIndex] };
            if (!slide) return prevSlides;
            
            slide.elements = (slide.elements || []).map(el => 
                el.id === elementId ? { ...el, ...updates } : el
            );
            
            newSlides[currentSlideIndex] = slide;
            return newSlides;
        });
        triggerAutoSave();
    };

    const updateElementStyle = (elementId: string, styleUpdates: Partial<SlideElement['styles']>) => {
        setSlides(prevSlides => {
            const newSlides = [...prevSlides];
            const slide = { ...newSlides[currentSlideIndex] };
            if (!slide) return prevSlides;

            slide.elements = (slide.elements || []).map(el => 
                el.id === elementId ? { ...el, styles: { ...el.styles, ...styleUpdates } } : el
            );

            newSlides[currentSlideIndex] = slide;
            return newSlides;
        });
        triggerAutoSave();
    };

    const calculateGuides = (elId: string, newX: number, newY: number, newW: number, newH: number) => {
        const threshold = 1.0; 
        let guideX: number | null = null;
        let guideY: number | null = null;
        let snappedX = newX;
        let snappedY = newY;

        const otherElements = (currentSlide.elements || []).filter(e => e.id !== elId);
        
        const xPoints = [0, 50 - newW / 2, 100 - newW];
        const yPoints = [0, 50 - newH / 2, 100 - newH];

        otherElements.forEach(e => {
            xPoints.push(e.x);
            xPoints.push(e.x + (e.width - newW) / 2);
            xPoints.push(e.x + e.width - newW);
            yPoints.push(e.y);
            yPoints.push(e.y + (e.height - newH) / 2);
            yPoints.push(e.y + e.height - newH);
        });

        for (const py of yPoints) {
            if (Math.abs(newY - py) < threshold) {
                snappedY = py;
                guideY = py + newH / 2;
                break;
            }
        }

        for (const px of xPoints) {
            if (Math.abs(newX - px) < threshold) {
                snappedX = px;
                guideX = px + newW / 2;
                break;
            }
        }

        return { guideX, guideY, snappedX, snappedY };
    };

    const handleGlobalPointerMove = useCallback((e: PointerEvent) => {
        if (interactionMode === 'none' || !selectedElementId || !canvasRef.current || !initialDragState.current || !selectedElement) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const currentMouseX = ((e.clientX - rect.left) / rect.width) * 100;
        const currentMouseY = ((e.clientY - rect.top) / rect.height) * 100;

        const deltaX = currentMouseX - initialDragState.current.x;
        const deltaY = currentMouseY - initialDragState.current.y;

        if (interactionMode === 'drag') {
            const rawX = initialDragState.current.elX + deltaX;
            const rawY = initialDragState.current.elY + deltaY;
            const { guideX, guideY, snappedX, snappedY } = calculateGuides(
                selectedElementId, 
                rawX, 
                rawY, 
                initialDragState.current.elW, 
                initialDragState.current.elH
            );
            setGuides({ x: guideX, y: guideY });
            updateElement(selectedElementId, { x: snappedX, y: snappedY });
        } else if (interactionMode === 'resize' && activeResizeHandle) {
            let { elX, elY, elW, elH, startFontSize } = initialDragState.current;
            
            if (activeResizeHandle.includes('r')) elW = Math.max(1, initialDragState.current.elW + deltaX);
            if (activeResizeHandle.includes('l')) { elX = initialDragState.current.elX + deltaX; elW = Math.max(1, initialDragState.current.elW - deltaX); }
            if (activeResizeHandle.includes('b')) elH = Math.max(1, initialDragState.current.elH + deltaY);
            if (activeResizeHandle.includes('t')) { elY = initialDragState.current.elY + deltaY; elH = Math.max(1, initialDragState.current.elH - deltaY); }

            if (selectedElement?.type === 'text' && ['tl', 'tr', 'bl', 'br'].includes(activeResizeHandle)) {
                const scaleFactor = elH / initialDragState.current.elH;
                const newFontSize = Math.round(startFontSize * scaleFactor);
                updateElementStyle(selectedElementId, { fontSize: Math.max(8, newFontSize) });
            }

            updateElement(selectedElementId, { x: elX, y: elY, width: elW, height: elH });
        } else if (interactionMode === 'rotate') {
            const centerX = selectedElement.x + selectedElement.width / 2;
            const centerY = selectedElement.y + selectedElement.height / 2;
            
            const angleRad = Math.atan2(currentMouseY - centerY, currentMouseX - centerX);
            let angleDeg = (angleRad * 180) / Math.PI;
            angleDeg += 90;

            const snapThreshold = 5;
            const snapInterval = 45;
            const roundedAngle = Math.round(angleDeg / snapInterval) * snapInterval;
            
            if (Math.abs(angleDeg - roundedAngle) < snapThreshold) {
                angleDeg = roundedAngle;
            }
            
            updateElementStyle(selectedElementId, { rotation: angleDeg });
        }
    }, [interactionMode, selectedElementId, activeResizeHandle, currentSlideIndex, selectedElement]);

    const handleGlobalPointerUp = useCallback(() => {
        setInteractionMode('none');
        setActiveResizeHandle(null);
        setGuides({ x: null, y: null });
        initialDragState.current = null;
    }, []);

    useEffect(() => {
        if (interactionMode !== 'none') {
            window.addEventListener('pointermove', handleGlobalPointerMove, { passive: false });
            window.addEventListener('pointerup', handleGlobalPointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handleGlobalPointerMove);
            window.removeEventListener('pointerup', handleGlobalPointerUp);
        };
    }, [interactionMode, handleGlobalPointerMove, handleGlobalPointerUp]);

    const onPointerDown = (e: React.PointerEvent, element: SlideElement) => {
        if (isPresenting) return;
        e.stopPropagation();

        if (selectedElementId !== element.id) {
            setSelectedElementId(element.id);
            setIsEditingText(false);
            return;
        }

        if (isEditingText) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        initialDragState.current = {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
            elX: element.x,
            elY: element.y,
            elW: element.width,
            elH: element.height,
            startFontSize: element.styles.fontSize || 24
        };

        setInteractionMode('drag');
    };

    const handleResizeStart = (e: React.PointerEvent, handle: ResizeHandle) => {
        if (isPresenting || !selectedElement) return;
        e.stopPropagation();
        e.preventDefault();
        
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        initialDragState.current = {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
            elX: selectedElement.x,
            elY: selectedElement.y,
            elW: selectedElement.width,
            elH: selectedElement.height,
            startFontSize: selectedElement.styles.fontSize || 24
        };

        setInteractionMode('resize');
        setActiveResizeHandle(handle);
    };

    const handleRotateHandleStart = (e: React.PointerEvent) => {
        if (isPresenting || !selectedElement) return;
        e.stopPropagation();
        e.preventDefault();
        
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        initialDragState.current = {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
            elX: selectedElement.x,
            elY: selectedElement.y,
            elW: selectedElement.width,
            elH: selectedElement.height,
            startFontSize: selectedElement.styles.fontSize || 24
        };

        setInteractionMode('rotate');
    };

    const getDistance = (t1: React.Touch | Touch, t2: React.Touch | Touch) => {
        return Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (isPresenting) return;
        if (e.touches.length === 2 && selectedElement) {
            initialTouchDistance.current = getDistance(e.touches[0], e.touches[1]);
            initialElementSize.current = {
                w: selectedElement.width,
                h: selectedElement.height,
                x: selectedElement.x,
                y: selectedElement.y,
                fs: selectedElement.styles.fontSize || 24
            };
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (isPresenting) return;
        if (e.touches.length === 2 && selectedElementId && initialElementSize.current) {
            const currentDist = getDistance(e.touches[0], e.touches[1]);
            const ratio = currentDist / initialTouchDistance.current;
            
            const newW = Math.max(1, initialElementSize.current.w * ratio);
            const newH = Math.max(1, initialElementSize.current.h * ratio);
            
            const updates: Partial<SlideElement> = { width: newW, height: newH };
            
            // Adjust position so it scales from center
            updates.x = initialElementSize.current.x - (newW - initialElementSize.current.w) / 2;
            updates.y = initialElementSize.current.y - (newH - initialElementSize.current.h) / 2;

            updateElement(selectedElementId, updates);
            
            if (selectedElement?.type === 'text') {
                const newFS = Math.round(initialElementSize.current.fs * ratio);
                updateElementStyle(selectedElementId, { fontSize: Math.max(8, newFS) });
            }
        }
    };

    const addElement = (type: SlideElement['type']) => {
        const newElement: SlideElement = {
            id: 'e' + Math.random().toString(36).substr(2, 9),
            type,
            x: 40, y: 40,
            width: type === 'line' ? 20 : 20,
            height: type === 'line' ? 1 : 15,
            content: type === 'text' ? 'Neuer Text' : undefined,
            styles: {
                backgroundColor: type === 'text' ? 'transparent' : '#3b82f6',
                color: type === 'text' ? '#000000' : undefined,
                fontSize: 24,
                fontFamily: 'var(--font-pt-sans), sans-serif',
                textAlign: 'center',
                zIndex: (currentSlide.elements?.length || 0) + 1,
                borderWidth: 0,
                borderColor: '#000000',
                borderRadius: type === 'circle' ? 9999 : 0,
                opacity: 1,
                rotation: 0
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
            cursor: isPreview ? 'default' : (isEditing ? 'text' : 'pointer'),
            boxShadow: isSelected ? '0 0 0 2px hsl(var(--primary))' : 'none',
            transform: `rotate(${el.styles.rotation || 0}deg)`,
            userSelect: 'none',
            touchAction: 'none'
        };

        if (el.type === 'line') {
            style.height = `${el.styles.borderWidth || 2}px`;
            style.backgroundColor = el.styles.borderColor || '#000000';
        }

        return (
            <div 
                key={el.id} 
                style={style}
                onPointerDown={(e) => onPointerDown(e, el)}
                onDoubleClick={() => { if(el.type === 'text') setIsEditingText(true); }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
            >
                {el.type === 'text' && (
                    <div 
                        style={{
                            fontSize: `${el.styles.fontSize || 24}px`,
                            fontFamily: el.styles.fontFamily || 'inherit',
                            textAlign: el.styles.textAlign || 'center',
                            fontWeight: el.styles.fontWeight || 'bold' ? 'bold' : 'normal',
                            color: el.styles.color || '#000000',
                            width: '100%',
                            outline: 'none',
                            userSelect: isEditing ? 'text' : 'none'
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

                {isSelected && !isPreview && !isEditingText && (
                    <>
                        {/* Rotation Handle */}
                        <div 
                            className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0 cursor-grab active:cursor-grabbing z-[100]"
                            onPointerDown={handleRotateHandleStart}
                        >
                            <div className="w-8 h-8 bg-white border-2 border-primary rounded-full shadow-xl flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                                <RotateCcw className="w-4 h-4" />
                            </div>
                            <div className="w-0.5 h-4 bg-primary" />
                        </div>

                        {/* Resize Handles */}
                        <div className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nwse-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'tl')} />
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nesw-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'tr')} />
                        <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nesw-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'bl')} />
                        <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-primary rounded-full cursor-nwse-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'br')} />
                        
                        <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-5 bg-white border border-primary rounded cursor-ew-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'l')} />
                        <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-5 bg-white border border-primary rounded cursor-ew-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'r')} />
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-3 bg-white border border-primary rounded cursor-ns-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 't')} />
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-3 bg-white border border-primary rounded cursor-ns-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'b')} />
                    </>
                )}
            </div>
        );
    };

    if (isUserLoading || (isLoadingPres && !isNewPres)) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
    }

    return (
        <div className="flex flex-col h-screen bg-background overflow-hidden" style={{ position: 'fixed', inset: 0 }}>
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Dancing+Script:wght@400;700&family=Fira+Code:wght@400;700&family=Montserrat:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap');
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                body { overflow: hidden !important; touch-action: none; overscroll-behavior: none; }
                .canvas-area { touch-action: none; }
            `}</style>

            <div className="bg-background border-b p-2 flex items-center justify-between sticky top-0 z-30 shadow-sm overflow-x-auto no-scrollbar gap-4">
                <div className="flex items-center gap-3 shrink-0 px-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => router.push('/workspace')}><ArrowLeft className="h-4 w-4" /></Button>
                    <div className="flex flex-col">
                        <Input 
                            value={title} 
                            placeholder="Titel..."
                            onChange={e => { setTitle(e.target.value); triggerAutoSave(); }} 
                            className="h-6 text-sm font-black border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent w-32 md:w-48" 
                        />
                        <div className="flex items-center gap-1.5 opacity-40 text-[9px] font-black uppercase">
                            <span>Folie {currentSlideIndex + 1}/{slides.length}</span>
                            <span>• {saveStatus === 'saving' ? 'Speichert' : 'Gespeichert'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 bg-secondary/20 p-1 rounded-full shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 font-black gap-2 rounded-full px-3 text-[11px]">
                                <Plus className="h-3.5 w-3.5" /> Element
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuItem onClick={() => addElement('text')} className="gap-2"><Type className="h-4 w-4"/> Textfeld</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => addElement('rect')} className="gap-2"><Square className="h-4 w-4"/> Rechteck</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => addElement('circle')} className="gap-2"><Circle className="h-4 w-4"/> Kreis</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => addElement('line')} className="gap-2"><Minus className="h-4 w-4"/> Linie</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {selectedElement && (
                        <div className="flex items-center gap-1 border-l pl-1 animate-in fade-in slide-in-from-top-1 duration-200">
                            {selectedElement.type === 'text' && (
                                <>
                                    <Select value={selectedElement.styles.fontFamily} onValueChange={(v) => updateElementStyle(selectedElement.id, { fontFamily: v })}>
                                        <SelectTrigger className="h-7 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>{FONTS.map(f => <SelectItem key={f.name} value={f.family} style={{fontFamily: f.family}}>{f.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <div className="flex items-center gap-1 ml-1">
                                        <span className="text-[10px] font-black opacity-30 px-1">PX</span>
                                        <Input 
                                            type="number" 
                                            value={selectedElement.styles.fontSize || 24} 
                                            onChange={e => updateElementStyle(selectedElement.id, { fontSize: Number(e.target.value) })}
                                            className="h-7 w-12 text-[10px] p-1 text-center bg-background border-none focus-visible:ring-1"
                                        />
                                    </div>
                                    <Button variant={selectedElement.styles.fontWeight === 'bold' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => updateElementStyle(selectedElement.id, { fontWeight: selectedElement.styles.fontWeight === 'bold' ? 'normal' : 'bold' })}><Bold className="h-3 w-3" /></Button>
                                    <Button variant={selectedElement.styles.fontStyle === 'italic' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => updateElementStyle(selectedElement.id, { fontStyle: selectedElement.styles.fontStyle === 'italic' ? 'normal' : 'italic' })}><Italic className="h-3 w-3" /></Button>
                                </>
                            )}
                            
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-6 h-6 rounded-full p-0 border-2" style={{backgroundColor: selectedElement.type === 'text' ? (selectedElement.styles.color || '#000') : (selectedElement.styles.backgroundColor || '#3b82f6')}} />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2">
                                    {COLORS.map(c => (
                                        <button key={c} className="w-6 h-6 rounded-full border" style={{backgroundColor: c}} onClick={() => updateElementStyle(selectedElement.id, selectedElement.type === 'text' ? { color: c } : { backgroundColor: c })} />
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="flex items-center gap-2 px-2 border-l border-r">
                                <Label className="text-[10px] font-black uppercase opacity-50"><Palette className="h-3 w-3"/></Label>
                                <Slider 
                                    className="w-20"
                                    min={0} max={1} step={0.1}
                                    value={[selectedElement.styles.opacity ?? 1]}
                                    onValueChange={([v]) => updateElementStyle(selectedElement.id, { opacity: v })}
                                />
                            </div>

                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                const newEl = { ...JSON.parse(JSON.stringify(selectedElement)), id: 'e' + Math.random().toString(36).substr(2, 9), x: selectedElement.x + 2, y: selectedElement.y + 2 };
                                const newSlides = [...slides];
                                newSlides[currentSlideIndex].elements.push(newEl);
                                setSlides(newSlides);
                                setSelectedElementId(newEl.id);
                                triggerAutoSave();
                            }}><Copy className="h-3 w-3"/></Button>
                            
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                                const newSlides = [...slides];
                                newSlides[currentSlideIndex].elements = (newSlides[currentSlideIndex].elements || []).filter(e => e.id !== selectedElementId);
                                setSlides(newSlides);
                                setSelectedElementId(null);
                                triggerAutoSave();
                            }}><Trash2 className="h-3 w-3"/></Button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0 px-2">
                    <Button size="sm" onClick={() => { setIsPresenting(true); setCurrentSlideIndex(0); }} className="font-black gap-2 h-8 rounded-full bg-primary hover:bg-primary/90 text-xs">
                        <Play className="h-3 w-3 fill-current" /> Präsentieren
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Löschen</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <main className="flex-1 flex overflow-hidden bg-secondary/10 h-full">
                <aside className="w-48 border-r bg-background flex flex-col shrink-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                        {slides.map((slide, idx) => (
                            <div key={slide.id} className="relative group">
                                <div 
                                    className={cn(
                                        "aspect-video border-2 rounded-lg cursor-pointer transition-all overflow-hidden bg-card relative shadow-sm",
                                        currentSlideIndex === idx ? "border-primary ring-2 ring-primary/10" : "hover:border-primary/40 border-muted"
                                    )}
                                    onClick={() => { setCurrentSlideIndex(idx); setSelectedElementId(null); setIsEditingText(false); }}
                                >
                                    <div className="absolute inset-0 scale-[0.25] origin-top-left pointer-events-none w-[400%] h-[400%]">
                                        {(slide.elements || []).map(el => renderElement(el, true))}
                                    </div>
                                </div>
                                <Button variant="destructive" size="icon" className="absolute -top-1 -right-1 h-5 w-5 rounded-full scale-0 group-hover:scale-100 transition-transform shadow-lg" onClick={(e) => { e.stopPropagation(); if(slides.length > 1) { setSlides(slides.filter(s => s.id !== slide.id)); if(currentSlideIndex >= slides.length - 1) setCurrentSlideIndex(slides.length - 2); triggerAutoSave(); } }}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 border-t bg-background">
                        <Button variant="outline" className="w-full border-dashed py-6 rounded-xl flex flex-col gap-1 text-[10px] font-black uppercase" onClick={() => { setSlides([...slides, { id: Math.random().toString(), title: 'Neue Folie', elements: [] }]); setCurrentSlideIndex(slides.length); triggerAutoSave(); }}>
                            <Plus className="h-4 w-4" /> Neu
                        </Button>
                    </div>
                </aside>

                <section 
                    className="flex-1 overflow-hidden p-4 md:p-8 flex items-center justify-center relative touch-none canvas-area" 
                    onPointerDown={() => { setSelectedElementId(null); setIsEditingText(false); }}
                >
                    <div 
                        ref={canvasRef}
                        className="aspect-video w-full max-w-5xl bg-white shadow-2xl rounded-2xl relative overflow-hidden border-4 border-white touch-none"
                        style={{ height: 'fit-content' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {activeGuides.x !== null && (
                            <div className="absolute top-0 bottom-0 w-[1px] bg-purple-500 z-[100] pointer-events-none" style={{ left: `${activeGuides.x}%` }} />
                        )}
                        {activeGuides.y !== null && (
                            <div className="absolute left-0 right-0 h-[1px] bg-purple-500 z-[100] pointer-events-none" style={{ top: `${activeGuides.y}%` }} />
                        )}

                        {(currentSlide.elements || []).map(el => renderElement(el))}
                    </div>
                </section>
            </main>

            <Dialog open={isPresenting} onOpenChange={setIsPresenting}>
                <DialogContent className="max-w-none w-screen h-screen p-0 border-0 rounded-none bg-black">
                    <DialogHeader className="sr-only"><DialogTitle>Präsentation Vollbild</DialogTitle></DialogHeader>
                    <div className="w-full h-full flex items-center justify-center relative bg-white">
                        <Button variant="ghost" size="icon" className="absolute top-6 right-6 rounded-full h-10 w-10 z-50 mix-blend-difference text-white" onClick={() => setIsPresenting(false)}><X className="h-6 w-6" /></Button>
                        <div className="w-full aspect-video relative overflow-hidden">
                             {(currentSlide.elements || []).map(el => renderElement(el, true))}
                        </div>
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/10 backdrop-blur-md px-6 py-2 rounded-full opacity-0 hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" disabled={currentSlideIndex === 0} onClick={() => setCurrentSlideIndex(p => p - 1)}><ChevronLeft/></Button>
                            <span className="text-[10px] font-black uppercase tracking-widest">{currentSlideIndex + 1} / {slides.length}</span>
                            <Button variant="ghost" size="icon" disabled={currentSlideIndex === slides.length - 1} onClick={() => setCurrentSlideIndex(p => p + 1)}><ChevronRight/></Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Präsentation löschen?</AlertDialogTitle><AlertDialogDescription>Möchtest du "{title}" wirklich löschen?</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => { if (docRef) { await deleteDoc(docRef); router.push('/workspace'); } }} className="bg-destructive text-white">Löschen</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
