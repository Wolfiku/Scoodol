
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useStorage } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc, updateDoc, increment } from 'firebase/firestore';
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
    ArrowUp, ArrowDown, MoveUp, MoveDown,
    Triangle, Star as StarIcon, MoveRight, Diamond,
    ImageIcon, Video, Ghost, Lightbulb, AlertTriangle, CheckCircle2, Info, GraduationCap, BookOpen, Search, Upload, HardDrive
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    DropdownMenuGroup
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
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';

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

const STORAGE_LIMIT_BYTES = 3 * 1024 * 1024 * 1024; // 3GB

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
];

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | 'line-start' | 'line-end';

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
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, open: boolean, elId: string | null }>({ x: 0, y: 0, open: false, elId: null });
    
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploadType, setUploadType] = useState<'image' | 'video' | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canvasRef = useRef<HTMLDivElement>(null);
    const hasDraggedRef = useRef(false);
    const selectionAtStartOfPointerDown = useRef<string | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const initialDragState = useRef<{ 
        x: number, y: number, 
        elX: number, elY: number, 
        elW: number, elH: number, 
        startFontSize: number, startRotation: number,
        p1?: {x: number, y: number}, p2?: {x: number, y: number}
    } | null>(null);

    const docRef = useMemoFirebase(() => 
        !isNewPres && user && typeof presId === 'string'
            ? doc(firestore, `users/${user.uid}/presentations`, presId)
            : null
    , [firestore, user, presId, isNewPres]);

    const { data: presentationData, isLoading: isLoadingPres } = useDoc<PresentationDoc>(docRef);
    
    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile } = useDoc<any>(userDocRef);

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
            slide.elements = (slide.elements || []).map(el => el.id === elementId ? { ...el, ...updates } : el);
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
            slide.elements = (slide.elements || []).map(el => el.id === elementId ? { ...el, styles: { ...el.styles, ...styleUpdates } } : el);
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
            xPoints.push(e.x, e.x + (e.width - newW) / 2, e.x + e.width - newW);
            yPoints.push(e.y, e.y + (e.height - newH) / 2, e.y + e.height - newH);
        });
        for (const py of yPoints) { if (Math.abs(newY - py) < threshold) { snappedY = py; guideY = py + newH / 2; break; } }
        for (const px of xPoints) { if (Math.abs(newX - px) < threshold) { snappedX = px; guideX = px + newW / 2; break; } }
        return { guideX, guideY, snappedX, snappedY };
    };

    const handleGlobalPointerMove = useCallback((e: PointerEvent) => {
        if (interactionMode === 'none' || !selectedElementId || !canvasRef.current || !initialDragState.current || !selectedElement) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const currentMouseX = ((e.clientX - rect.left) / rect.width) * 100;
        const currentMouseY = ((e.clientY - rect.top) / rect.height) * 100;
        const deltaX = currentMouseX - initialDragState.current.x;
        const deltaY = currentMouseY - initialDragState.current.y;

        if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
            hasDraggedRef.current = true;
            if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
        }

        if (interactionMode === 'drag') {
            const rawX = initialDragState.current.elX + deltaX;
            const rawY = initialDragState.current.elY + deltaY;
            const { guideX, guideY, snappedX, snappedY } = calculateGuides(selectedElementId, rawX, rawY, initialDragState.current.elW, initialDragState.current.elH);
            setGuides({ x: guideX, y: guideY });
            updateElement(selectedElementId, { x: snappedX, y: snappedY });
        } else if (interactionMode === 'resize' && activeResizeHandle) {
            if (selectedElement.type === 'line' && initialDragState.current.p1 && initialDragState.current.p2) {
                let p1 = { ...initialDragState.current.p1 }, p2 = { ...initialDragState.current.p2 };
                if (activeResizeHandle === 'line-start') { p1.x = currentMouseX; p1.y = currentMouseY; } else { p2.x = currentMouseX; p2.y = currentMouseY; }
                const dx = p2.x - p1.x, dy = p2.y - p1.y;
                const newWidth = Math.sqrt(dx * dx + dy * dy);
                let newRot = Math.atan2(dy, dx) * 180 / Math.PI;
                if (Math.abs(newRot - Math.round(newRot / 45) * 45) < 5) newRot = Math.round(newRot / 45) * 45;
                updateElement(selectedElementId, { x: (p1.x + p2.x) / 2 - newWidth / 2, y: (p1.y + p2.y) / 2 - (selectedElement.styles.borderWidth || 4) / 2 / (rect.height / 100), width: newWidth });
                updateElementStyle(selectedElementId, { rotation: newRot });
            } else {
                let { elX, elY, elW, elH, startFontSize } = initialDragState.current;
                if (activeResizeHandle.includes('r')) elW = Math.max(1, initialDragState.current.elW + deltaX);
                if (activeResizeHandle.includes('l')) { elX = initialDragState.current.elX + deltaX; elW = Math.max(1, initialDragState.current.elW - deltaX); }
                if (activeResizeHandle.includes('b')) elH = Math.max(1, initialDragState.current.elH + deltaY);
                if (activeResizeHandle.includes('t')) { elY = initialDragState.current.elY + deltaY; elH = Math.max(1, initialDragState.current.elH - deltaY); }
                if (selectedElement?.type === 'text' && ['tl', 'tr', 'bl', 'br'].includes(activeResizeHandle)) {
                    updateElementStyle(selectedElementId, { fontSize: Math.max(8, Math.round(startFontSize * (elH / initialDragState.current.elH))) });
                }
                updateElement(selectedElementId, { x: elX, y: elY, width: elW, height: elH });
            }
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
        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
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
        e.stopPropagation(); setContextMenu({ ...contextMenu, open: false }); hasDraggedRef.current = false;
        selectionAtStartOfPointerDown.current = selectedElementId;
        if (selectedElementId !== element.id) { setSelectedElementId(element.id); setIsEditingText(false); }
        if (isEditingText) return;
        const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
        const mouseX = e.clientX, mouseY = e.clientY;
        longPressTimer.current = setTimeout(() => { setContextMenu({ x: mouseX, y: mouseY, open: true, elId: element.id }); }, 500);
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
        const currentX = ((e.clientX - rect.left) / rect.width) * 100, currentY = ((e.clientY - rect.top) / rect.height) * 100;
        let p1, p2;
        if (selectedElement.type === 'line') {
            const angleRad = (selectedElement.styles.rotation || 0) * Math.PI / 180;
            const cos = Math.cos(angleRad), sin = Math.sin(angleRad), centerX = selectedElement.x + selectedElement.width / 2, centerY = selectedElement.y + selectedElement.height / 2, halfW = selectedElement.width / 2;
            p1 = { x: centerX - halfW * cos, y: centerY - halfW * sin }; p2 = { x: centerX + halfW * cos, y: centerY + halfW * sin };
        }
        initialDragState.current = { x: currentX, y: currentY, elX: selectedElement.x, elY: selectedElement.y, elW: selectedElement.width, elH: selectedElement.height, startFontSize: selectedElement.styles.fontSize || 24, startRotation: selectedElement.styles.rotation || 0, p1, p2 };
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

    const handleContextMenu = (e: React.MouseEvent, element: SlideElement) => { e.preventDefault(); e.stopPropagation(); setSelectedElementId(element.id); setContextMenu({ x: e.clientX, y: e.clientY, open: true, elId: element.id }); };

    const duplicateElement = (elId: string) => {
        const el = currentSlide.elements.find(e => e.id === elId); if (!el) return;
        const newEl = { ...JSON.parse(JSON.stringify(el)), id: 'e' + Math.random().toString(36).substr(2, 9), x: el.x + 2, y: el.y + 2 };
        const newSlides = [...slides]; newSlides[currentSlideIndex].elements.push(newEl);
        setSlides(newSlides); setSelectedElementId(newEl.id); triggerAutoSave();
    };

    const deleteElement = (elId: string) => {
        const newSlides = [...slides]; newSlides[currentSlideIndex].elements = (newSlides[currentSlideIndex].elements || []).filter(e => e.id !== elId);
        setSlides(newSlides); setSelectedElementId(null); triggerAutoSave();
    };

    const changeZIndex = (elId: string, action: 'front' | 'back' | 'forward' | 'backward') => {
        const elements = [...slides[currentSlideIndex].elements]; const elIndex = elements.findIndex(e => e.id === elId); if (elIndex === -1) return;
        const maxZ = Math.max(...elements.map(e => e.styles.zIndex || 0), 0), minZ = Math.min(...elements.map(e => e.styles.zIndex || 0), 0);
        if (action === 'front') elements[elIndex].styles.zIndex = maxZ + 1;
        else if (action === 'back') elements[elIndex].styles.zIndex = Math.max(0, minZ - 1);
        else if (action === 'forward') elements[elIndex].styles.zIndex += 1;
        else if (action === 'backward') elements[elIndex].styles.zIndex = Math.max(0, elements[elIndex].styles.zIndex - 1);
        const newSlides = [...slides]; newSlides[currentSlideIndex].elements = elements; setSlides(newSlides); triggerAutoSave();
    };

    const addElement = (type: SlideElement['type'], extra?: any) => {
        const newElement: SlideElement = {
            id: 'e' + Math.random().toString(36).substr(2, 9),
            type, x: 40, y: 40,
            width: (type === 'line' || type === 'arrow') ? 20 : (type === 'text' ? 30 : 20),
            height: (type === 'line') ? 1 : 15,
            content: type === 'text' ? 'Neuer Text' : (type === 'image' ? (extra?.url || 'https://picsum.photos/seed/1/600/400') : (type === 'video' ? (extra?.url || 'https://www.youtube.com/embed/dQw4w9WgXcQ') : undefined)),
            iconName: type === 'icon' ? extra?.iconName || 'Star' : undefined,
            styles: {
                backgroundColor: (type === 'text' || type === 'image' || type === 'video') ? 'transparent' : (type === 'icon' ? 'transparent' : '#3b82f6'),
                color: (type === 'text' || type === 'icon') ? '#000000' : undefined,
                fontSize: type === 'icon' ? 60 : 24,
                fontFamily: 'var(--font-pt-sans), sans-serif',
                textAlign: 'center',
                zIndex: (currentSlide.elements?.length || 0) + 1,
                borderWidth: type === 'line' ? 4 : (type === 'rect' || type === 'circle' || type === 'image' ? 0 : 2),
                borderColor: '#000000', borderRadius: type === 'circle' ? 9999 : (type === 'image' ? 12 : 0),
                opacity: 1, rotation: 0
            }
        };
        const newSlides = [...slides]; if (!newSlides[currentSlideIndex].elements) newSlides[currentSlideIndex].elements = [];
        newSlides[currentSlideIndex].elements.push(newElement); setSlides(newSlides); setSelectedElementId(newElement.id); setIsEditingText(false); triggerAutoSave();
    };

    const handleFileSelect = (type: 'image' | 'video') => {
        setUploadType(type);
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 50);
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user || !userDocRef) return;

        // Check 3GB limit
        const currentUsage = userProfile?.storageUsage || 0;
        if (currentUsage + file.size > STORAGE_LIMIT_BYTES) {
            toast({ variant: 'destructive', title: 'Speicher voll', description: 'Du hast dein Limit von 3 GB erreicht.' });
            return;
        }

        const type = uploadType;
        const storageRefPath = `users/${user.uid}/media/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, storageRefPath);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            }, 
            (error) => {
                console.error("Upload failed:", error);
                toast({ variant: 'destructive', title: 'Upload fehlgeschlagen', description: error.message });
                setUploadProgress(null);
            }, 
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await updateDoc(userDocRef, { storageUsage: increment(file.size) });
                
                if (type === 'image') addElement('image', { url: downloadURL });
                else if (type === 'video') addElement('video', { url: downloadURL });
                
                setUploadProgress(null);
                toast({ title: 'Datei hochgeladen!' });
            }
        );
        
        event.target.value = ''; // Reset input
    };

    const renderElement = (el: SlideElement, isPreview: boolean = false) => {
        const isSelected = !isPreview && selectedElementId === el.id;
        const isEditing = isSelected && isEditingText;
        const style: React.CSSProperties = {
            position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`, height: el.type === 'line' ? 'auto' : `${el.height}%`, zIndex: el.styles.zIndex,
            backgroundColor: (el.type === 'line' || ['triangle', 'star', 'arrow', 'diamond', 'image', 'video', 'icon'].includes(el.type)) ? 'transparent' : el.styles.backgroundColor,
            borderColor: el.styles.borderColor, borderWidth: (el.type === 'line' || ['triangle', 'star', 'arrow', 'diamond', 'image', 'video', 'icon', 'text'].includes(el.type)) ? 0 : `${el.styles.borderWidth || 0}px`,
            borderStyle: el.styles.borderWidth ? 'solid' : 'none', borderRadius: `${el.styles.borderRadius || 0}px`, opacity: el.styles.opacity ?? 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isPreview ? 'default' : (isEditing ? 'text' : 'pointer'),
            boxShadow: isSelected && !['line', 'video'].includes(el.type) ? '0 0 0 2px hsl(var(--primary))' : 'none',
            transform: `rotate(${el.styles.rotation || 0}deg)`, userSelect: isEditing ? 'text' : 'none', touchAction: 'none'
        };

        if (el.type === 'line') {
            const thickness = el.styles.borderWidth || 4; const hitboxPadding = 15;
            style.height = `${thickness + (hitboxPadding * 2)}px`; style.backgroundColor = el.styles.borderColor || '#000000';
            style.borderTop = `${hitboxPadding}px solid transparent`; style.borderBottom = `${hitboxPadding}px solid transparent`;
            style.backgroundClip = 'padding-box'; style.marginTop = `-${hitboxPadding}px`;
            if (isSelected) style.boxShadow = '0 0 10px hsla(var(--primary), 0.5)';
        }

        const renderShape = () => {
            const strokeProps = { stroke: el.styles.borderColor || '#000', strokeWidth: el.styles.borderWidth || 0, fill: el.styles.backgroundColor || '#3b82f6' };
            switch(el.type) {
                case 'triangle': return <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,5 5,95 95,95" {...strokeProps} /></svg>;
                case 'star': return <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,5 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35" {...strokeProps} /></svg>;
                case 'arrow': return <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="5,30 65,30 65,10 95,50 65,90 65,70 5,70" {...strokeProps} /></svg>;
                case 'diamond': return <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,5 95,50 50,95 5,50" {...strokeProps} /></svg>;
                case 'icon':
                    const IconComp = ICONS.find(i => i.name === el.iconName)?.icon || StarIcon;
                    return <IconComp style={{ width: '100%', height: '100%', color: el.styles.color }} />;
                case 'image': return <img src={el.content} className="w-full h-full object-cover pointer-events-none" style={{ borderRadius: 'inherit' }} alt="Slide Element" />;
                case 'video': 
                    if (el.content?.includes('youtube.com') || el.content?.includes('youtu.be')) {
                        return <iframe src={el.content} className="w-full h-full pointer-events-none" frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen />;
                    }
                    return <video src={el.content} className="w-full h-full object-contain pointer-events-none" controls={isPresenting} />;
                default: return null;
            }
        };

        return (
            <div key={el.id} style={style} onPointerDown={(e) => onPointerDown(e, el)} onClick={(e) => handleElementClick(e, el)} onContextMenu={(e) => handleContextMenu(e, el)}>
                {['triangle', 'star', 'arrow', 'diamond', 'icon', 'image', 'video'].includes(el.type) && renderShape()}
                {el.type === 'text' && (
                    <div style={{ fontSize: `${el.styles.fontSize || 24}px`, fontFamily: el.styles.fontFamily || 'inherit', textAlign: el.styles.textAlign || 'center', fontWeight: el.styles.fontWeight === 'bold' ? 'bold' : 'normal', fontStyle: el.styles.fontStyle === 'italic' ? 'italic' : 'normal', color: el.styles.color || '#000000', width: '100%', outline: 'none', userSelect: isEditing ? 'text' : 'none' }} contentEditable={isEditing} suppressContentEditableWarning onPointerDown={(e) => { if (isEditing) e.stopPropagation(); }} onBlur={(e) => { updateElement(el.id, { content: e.currentTarget.innerText }); setIsEditingText(false); }}>{el.content}</div>
                )}
                {isSelected && !isPreview && !isEditingText && (
                    <>
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0 cursor-grab active:cursor-grabbing z-[100]" onPointerDown={handleRotateHandleStart}><div className="w-8 h-8 bg-white border-2 border-primary rounded-full shadow-xl flex items-center justify-center hover:bg-primary hover:text-white transition-colors"><RotateCcw className="w-4 h-4" /></div><div className="w-0.5 h-4 bg-primary" /></div>
                        {el.type === 'line' ? (
                            <><div className="absolute top-1/2 -left-3 -translate-y-1/2 w-8 h-8 bg-white border-2 border-primary rounded-full cursor-crosshair z-50 shadow-lg flex items-center justify-center" onPointerDown={(e) => handleResizeStart(e, 'line-start')}><div className="w-2 h-2 bg-primary rounded-full" /></div><div className="absolute top-1/2 -right-3 -translate-y-1/2 w-8 h-8 bg-white border-2 border-primary rounded-full cursor-crosshair z-50 shadow-lg flex items-center justify-center" onPointerDown={(e) => handleResizeStart(e, 'line-end')}><div className="w-2 h-2 bg-primary rounded-full" /></div></>
                        ) : (
                            <><div className="absolute -top-1.5 -left-1.5 w-6 h-6 bg-white border-2 border-primary rounded-full cursor-nwse-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'tl')} /><div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-white border-2 border-primary rounded-full cursor-nesw-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'tr')} /><div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 bg-white border-2 border-primary rounded-full cursor-nesw-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'bl')} /><div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-white border-2 border-primary rounded-full cursor-nwse-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'br')} /><div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-7 bg-white border border-primary rounded cursor-ew-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'l')} /><div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-7 bg-white border border-primary rounded cursor-ew-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'r')} /><div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-7 h-3 bg-white border border-primary rounded cursor-ns-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 't')} /><div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-7 h-3 bg-white border border-primary rounded cursor-ns-resize z-50 shadow-sm" onPointerDown={(e) => handleResizeStart(e, 'b')} /></>
                        )}
                    </>
                )}
            </div>
        );
    };

    if (isUserLoading || (isLoadingPres && !isNewPres)) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

    const usedStorageMB = Math.round((userProfile?.storageUsage || 0) / 1024 / 1024);
    const limitMB = Math.round(STORAGE_LIMIT_BYTES / 1024 / 1024);

    return (
        <div className="flex flex-col h-screen bg-background overflow-hidden" style={{ position: 'fixed', inset: 0 }}>
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Dancing+Script:wght@400;700&family=Fira+Code:wght@400;700&family=Montserrat:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap');
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                body { overflow: hidden !important; touch-action: none; overscroll-behavior: none; user-select: none; }
                .canvas-area { touch-action: none; }
                [contenteditable="true"] { user-select: text !important; cursor: text !important; }
            `}</style>

            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept={uploadType === 'image' ? "image/*" : "video/*"} />

            <div className="bg-background border-b p-2 flex items-center justify-between sticky top-0 z-30 shadow-sm overflow-x-auto no-scrollbar gap-4">
                <div className="flex items-center gap-3 shrink-0 px-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => router.push('/workspace')}><ArrowLeft className="h-4 w-4" /></Button>
                    <div className="flex flex-col">
                        <Input value={title} placeholder="Titel..." onChange={e => { setTitle(e.target.value); triggerAutoSave(); }} className="h-6 text-sm font-black border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent w-32 md:w-48" />
                        <div className="flex items-center gap-1.5 opacity-40 text-[9px] font-black uppercase"><span>Folie {currentSlideIndex + 1}/{slides.length}</span><span>• {saveStatus === 'saving' ? 'Speichert' : 'Gespeichert'}</span></div>
                    </div>
                </div>

                <div className="flex items-center gap-1 bg-secondary/20 p-1 rounded-full shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 font-black gap-2 rounded-full px-3 text-[11px]"><Plus className="h-3.5 w-3.5" /> Element</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 p-2 rounded-2xl">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Text</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => addElement('text')} className="gap-2"><Type className="h-4 w-4"/> Textfeld</DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Formen</DropdownMenuLabel>
                                <div className="grid grid-cols-3 gap-1">
                                    <DropdownMenuItem onClick={() => addElement('rect')} className="justify-center p-2"><Square className="h-5 w-5"/></DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addElement('circle')} className="justify-center p-2"><Circle className="h-5 w-5"/></DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addElement('triangle')} className="justify-center p-2"><Triangle className="h-5 w-5"/></DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addElement('star')} className="justify-center p-2"><StarIcon className="h-5 w-5"/></DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addElement('arrow')} className="justify-center p-2"><MoveRight className="h-5 w-5"/></DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addElement('line')} className="justify-center p-2"><Minus className="h-5 w-5"/></DropdownMenuItem>
                                </div>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Medien</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleFileSelect('image')} className="gap-2"><Upload className="h-4 w-4"/> Bild hochladen</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleFileSelect('video')} className="gap-2"><Upload className="h-4 w-4"/> Video hochladen</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => addElement('image')} className="gap-2 opacity-50"><ImageIcon className="h-4 w-4"/> Bild von URL</DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Symbole</DropdownMenuLabel>
                                <div className="grid grid-cols-3 gap-1">
                                    {ICONS.map(icon => (
                                        <DropdownMenuItem key={icon.name} onClick={() => addElement('icon', { iconName: icon.name })} className="justify-center p-2"><icon.icon className="h-5 w-5"/></DropdownMenuItem>
                                    ))}
                                </div>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {selectedElement && (
                        <div className="flex items-center gap-1 border-l pl-1 animate-in fade-in slide-in-from-top-1 duration-200">
                            {(selectedElement.type === 'image' || selectedElement.type === 'video') && (
                                <div className="flex items-center gap-1">
                                    <Input value={selectedElement.content || ''} placeholder="URL..." onChange={e => updateElement(selectedElement.id, { content: e.target.value })} className="h-7 w-32 md:w-48 text-[10px] bg-background border-none focus-visible:ring-1" />
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleFileSelect(selectedElement.type as any)} title="Datei ersetzen"><Upload className="h-3 w-3"/></Button>
                                </div>
                            )}
                            {selectedElement.type === 'text' && (
                                <>
                                    <Select value={selectedElement.styles.fontFamily} onValueChange={(v) => updateElementStyle(selectedElement.id, { fontFamily: v })}><SelectTrigger className="h-7 w-24 text-[10px]"><SelectValue /></SelectTrigger><SelectContent>{FONTS.map(f => <SelectItem key={f.name} value={f.family} style={{fontFamily: f.family}}>{f.name}</SelectItem>)}</SelectContent></Select>
                                    <div className="flex items-center gap-1 ml-1"><span className="text-[10px] font-black opacity-30 px-1">PX</span><Input type="number" value={selectedElement.styles.fontSize || 24} onChange={e => updateElementStyle(selectedElement.id, { fontSize: Number(e.target.value) })} className="h-7 w-12 text-[10px] p-1 text-center bg-background border-none rounded-md focus-visible:ring-1" /></div>
                                    <Button variant={selectedElement.styles.fontWeight === 'bold' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => updateElementStyle(selectedElement.id, { fontWeight: selectedElement.styles.fontWeight === 'bold' ? 'normal' : 'bold' })}><Bold className="h-3 w-3" /></Button>
                                    <Button variant={selectedElement.styles.fontStyle === 'italic' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => updateElementStyle(selectedElement.id, { fontStyle: selectedElement.styles.fontStyle === 'italic' ? 'normal' : 'italic' })}><Italic className="h-3 w-3" /></Button>
                                </>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="outline" className="w-6 h-6 rounded-full p-0 border-2" style={{backgroundColor: (selectedElement.type === 'text' || selectedElement.type === 'line' || selectedElement.type === 'icon') ? (selectedElement.styles.color || selectedElement.styles.borderColor || '#000') : (selectedElement.styles.backgroundColor || '#3b82f6')}} /></DropdownMenuTrigger>
                                <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2">{COLORS.map(c => (<button key={c} className="w-6 h-6 rounded-full border" style={{backgroundColor: c}} onClick={() => updateElementStyle(selectedElement.id, (selectedElement.type === 'text' || selectedElement.type === 'icon') ? { color: c } : (selectedElement.type === 'line' ? { borderColor: c } : { backgroundColor: c }))} />))}</DropdownMenuContent>
                            </DropdownMenu>
                            <div className="flex items-center gap-2 px-2 border-l border-r"><Label className="text-[10px] font-black uppercase opacity-50"><Palette className="h-3 w-3"/></Label><Slider className="w-20" min={0} max={1} step={0.1} value={[selectedElement.styles.opacity ?? 1]} onValueChange={([v]) => updateElementStyle(selectedElement.id, { opacity: v })} /></div>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateElement(selectedElement.id)}><Copy className="h-3 w-3"/></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteElement(selectedElement.id)}><Trash2 className="h-3 w-3"/></Button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 shrink-0 px-2">
                    {uploadProgress !== null && (
                        <div className="w-32 flex flex-col gap-1">
                            <span className="text-[8px] font-black uppercase text-primary animate-pulse">Upload: {Math.round(uploadProgress)}%</span>
                            <Progress value={uploadProgress} className="h-1" />
                        </div>
                    )}
                    <div className="flex flex-col items-end gap-0.5 border-r pr-4">
                        <div className="flex items-center gap-1 text-[8px] font-black text-muted-foreground uppercase"><HardDrive className="h-2.5 w-2.5" /> Speicher</div>
                        <span className="text-[9px] font-bold text-primary">{usedStorageMB} MB / {limitMB} MB</span>
                    </div>
                    <Button size="sm" onClick={() => { setIsPresenting(true); setCurrentSlideIndex(0); }} className="font-black gap-2 h-8 rounded-full bg-primary hover:bg-primary/90 text-xs"><Play className="h-3 w-3 fill-current" /> Präsentieren</Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Löschen</DropdownMenuItem></DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <main className="flex-1 flex overflow-hidden bg-secondary/10">
                <aside className="w-48 border-r bg-background flex flex-col shrink-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                        {slides.map((slide, idx) => (
                            <div key={slide.id} className="relative group">
                                <div className={cn("aspect-video border-2 rounded-lg cursor-pointer transition-all overflow-hidden bg-card relative shadow-sm", currentSlideIndex === idx ? "border-primary ring-2 ring-primary/10" : "hover:border-primary/40 border-muted")} onClick={() => { setCurrentSlideIndex(idx); setSelectedElementId(null); setIsEditingText(false); }}>
                                    <div className="absolute inset-0 scale-[0.25] origin-top-left pointer-events-none w-[400%] h-[400%]">{(slide.elements || []).map(el => renderElement(el, true))}</div>
                                </div>
                                <Button variant="destructive" size="icon" className="absolute -top-1 -right-1 h-5 w-5 rounded-full scale-0 group-hover:scale-100 transition-transform shadow-lg" onClick={(e) => { e.stopPropagation(); if(slides.length > 1) { setSlides(slides.filter(s => s.id !== slide.id)); if(currentSlideIndex >= slides.length - 1) setCurrentSlideIndex(slides.length - 2); triggerAutoSave(); } }}><X className="h-3 w-3" /></Button>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 border-t bg-background shrink-0 pb-10">
                        <button className="w-full h-20 border-2 border-dashed border-muted-foreground/30 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-secondary/50 transition-colors group" onClick={() => { const newSlide: Slide = { id: Math.random().toString(36).substr(2, 9), title: 'Neue Folie', elements: [] }; setSlides([...slides, newSlide]); setCurrentSlideIndex(slides.length); triggerAutoSave(); }}><Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" /><span className="text-[10px] font-black uppercase text-muted-foreground group-hover:text-primary">Neue Folie</span></button>
                    </div>
                </aside>

                <section className="flex-1 overflow-hidden p-4 md:p-8 flex items-center justify-center relative touch-none canvas-area" onPointerDown={() => { setSelectedElementId(null); setIsEditingText(false); setContextMenu({ ...contextMenu, open: false }); }}>
                    <div ref={canvasRef} className="aspect-video w-full max-w-5xl bg-white shadow-2xl rounded-2xl relative overflow-hidden border-4 border-white touch-none" style={{ height: 'fit-content' }} onClick={(e) => e.stopPropagation()}>
                        {activeGuides.x !== null && <div className="absolute top-0 bottom-0 w-[1.5px] bg-purple-500 z-[100] pointer-events-none" style={{ left: `${activeGuides.x}%` }} />}
                        {activeGuides.y !== null && <div className="absolute left-0 right-0 h-[1.5px] bg-purple-500 z-[100] pointer-events-none" style={{ top: `${activeGuides.y}%` }} />}
                        {(currentSlide.elements || []).map(el => renderElement(el))}
                    </div>
                </section>
            </main>

            {contextMenu.open && contextMenu.elId && (
                <div className="fixed z-[1000] bg-popover border rounded-xl shadow-2xl p-1 w-56 animate-in fade-in zoom-in-95 duration-150" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
                    <div className="px-3 py-2 text-[10px] font-black uppercase text-muted-foreground border-b mb-1">Objekt-Optionen</div>
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-secondary rounded-lg flex items-center gap-2" onClick={() => { duplicateElement(contextMenu.elId!); setContextMenu({ ...contextMenu, open: false }); }}><Copy className="h-4 w-4" /> Duplizieren</button>
                    <Separator className="my-1" /><button className="w-full text-left px-3 py-2 text-sm hover:bg-secondary rounded-lg flex items-center gap-2" onClick={() => { changeZIndex(contextMenu.elId!, 'front'); setContextMenu({ ...contextMenu, open: false }); }}><MoveUp className="h-4 w-4" /> Ganz nach vorne</button><button className="w-full text-left px-3 py-2 text-sm hover:bg-secondary rounded-lg flex items-center gap-2" onClick={() => { changeZIndex(contextMenu.elId!, 'forward'); setContextMenu({ ...contextMenu, open: false }); }}><ArrowUp className="h-4 w-4" /> Ebene nach vorne</button><button className="w-full text-left px-3 py-2 text-sm hover:bg-secondary rounded-lg flex items-center gap-2" onClick={() => { changeZIndex(contextMenu.elId!, 'backward'); setContextMenu({ ...contextMenu, open: false }); }}><ArrowDown className="h-4 w-4" /> Ebene nach hinten</button><button className="w-full text-left px-3 py-2 text-sm hover:bg-secondary rounded-lg flex items-center gap-2" onClick={() => { changeZIndex(contextMenu.elId!, 'back'); setContextMenu({ ...contextMenu, open: false }); }}><MoveDown className="h-4 w-4" /> Ganz nach hinten</button>
                    <Separator className="my-1" /><button className="w-full text-left px-3 py-2 text-sm hover:bg-destructive/10 text-destructive rounded-lg flex items-center gap-2" onClick={() => { deleteElement(contextMenu.elId!); setContextMenu({ ...contextMenu, open: false }); }}><Trash2 className="h-4 w-4" /> Löschen</button>
                </div>
            )}

            <Dialog open={isPresenting} onOpenChange={setIsPresenting}>
                <DialogContent className="max-w-none w-screen h-screen p-0 border-0 rounded-none bg-black"><DialogHeader className="sr-only"><DialogTitle>Präsentation Vollbild</DialogTitle></DialogHeader><div className="w-full h-full flex items-center justify-center relative bg-white"><Button variant="ghost" size="icon" className="absolute top-6 right-6 rounded-full h-10 w-10 z-50 mix-blend-difference text-white" onClick={() => setIsPresenting(false)}><X className="h-6 w-6" /></Button><div className="w-full aspect-video relative overflow-hidden">{(currentSlide.elements || []).map(el => renderElement(el, true))}</div><div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/10 backdrop-blur-md px-6 py-2 rounded-full opacity-0 hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" disabled={currentSlideIndex === 0} onClick={() => setCurrentSlideIndex(p => p - 1)}><ChevronLeft/></Button><span className="text-[10px] font-black uppercase tracking-widest">{currentSlideIndex + 1} / {slides.length}</span><Button variant="ghost" size="icon" disabled={currentSlideIndex === slides.length - 1} onClick={() => setCurrentSlideIndex(p => p + 1)}><ChevronRight/></Button></div></div></DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Präsentation löschen?</AlertDialogTitle><AlertDialogDescription>Möchtest du "{title}" wirklich löschen?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction onClick={async () => { if (docRef) { await deleteDoc(docRef); router.push('/workspace'); } }} className="bg-destructive text-white">Löschen</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

const Separator = ({ className }: { className?: string }) => <div className={cn("h-px bg-border", className)} />;
