
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useStorage } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc, query, where, getDocs, increment, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Loader2, ArrowLeft, Bold, Italic, Underline, Link as LinkIcon, 
    Table as TableIcon, ImageIcon, Video, AlignLeft, AlignCenter, AlignRight, 
    List, ListOrdered, Save, Check, MoreHorizontal, Trash2, ChevronDown,
    Strikethrough, Palette, Highlighter, PlusSquare, MinusSquare,
    Indent, Outdent, Type as FontIcon, BookOpen, Edit, FileText, Download, Info, Globe, QrCode, Copy, Send, Eraser, X as XIcon,
    Sparkles, Library, Code, BookmarkPlus, ExternalLink, CornerUpRight, Upload, HardDrive
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import QRCode from 'qrcode';
import { generateAiWritingAssistance } from '@/app/actions';
import { useTheme } from '@/hooks/use-theme';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Progress } from '@/components/ui/progress';

type TextDocument = {
  title: string;
  content: string;
  authorName?: string;
  ownerId: string;
  isLocked?: boolean;
  isPublished?: boolean;
  createdAt: any;
  updatedAt: any;
};

type SaveStatus = 'idle' | 'dirty' | 'saving';

const STORAGE_LIMIT_BYTES = 3 * 1024 * 1024 * 1024; // 3GB

const FONTS = [
    { name: 'Standard (Sans)', family: 'var(--font-pt-sans), sans-serif' },
    { name: 'Inter', family: 'Inter, sans-serif' },
    { name: 'Roboto', family: 'Roboto, sans-serif' },
    { name: 'Open Sans', family: 'Open Sans, sans-serif' },
    { name: 'Montserrat', family: 'Montserrat, sans-serif' },
    { name: 'Ubuntu', family: 'Ubuntu, sans-serif' },
    { name: 'Oswald', family: 'Oswald, sans-serif' },
    { name: 'Raleway', family: 'Raleway, sans-serif' },
    { name: 'Playfair Display', family: 'Playfair Display, serif' },
    { name: 'Lora', family: 'Lora, serif' },
    { name: 'Merriweather', family: 'Merriweather, serif' },
    { name: 'PT Serif', family: 'PT Serif, serif' },
    { name: 'EB Garamond', family: 'EB Garamond, serif' },
    { name: 'Georgia', family: 'Georgia, serif' },
    { name: 'Fira Code', family: 'Fira Code, monospace' },
    { name: 'Source Code Pro', family: 'Source Code Pro, monospace' },
    { name: 'Inconsolata', family: 'Inconsolata, monospace' },
    { name: 'Pacifico', family: 'Pacifico, cursive' },
    { name: 'Dancing Script', family: 'Dancing Script, cursive' },
    { name: 'Caveat', family: 'Caveat, cursive' },
    { name: 'Comfortaa', family: 'Comfortaa, display' },
    { name: 'Bangers', family: 'Bangers, display' },
];

export default function TextDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const docId = params?.docId as string;
  const isNewDoc = docId === 'new';

  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { aiLanguage } = useTheme();
  
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [title, setTitle] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  
  const [isLocked, setIsLocked] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isEditing, setIsEditing] = useState(true); 
  const [isManifestOpen, setIsManifestOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isConfirmLiveUpdateOpen, setIsConfirmLiveUpdateOpen] = useState(false);
  const [isMediaDialogOpen, setIsMediaDialogOpen] = useState<{type: 'image' | 'video' | 'link' | 'ext-link' | 'homework' | 'redirect' | 'upload', open: boolean}>({type: 'link', open: false});
  const [mediaUrl, setMediaUrl] = useState('');
  const [extLinkTitle, setExtLinkTitle] = useState('');
  const [extLinkDesc, setExtLinkDesc] = useState('');
  const [hwSubject, setHwSubject] = useState('');
  const [hwTask, setHwTask] = useState('');
  const [isInTable, setIsInTable] = useState(false);
  const [fontSize, setFontSize] = useState('18');
  
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [publicDocs, setPublicDocs] = useState<{id: string, title: string, type: 'document' | 'quiz'}[]>([]);
  const [selectedRedirect, setSelectedRedirect] = useState<string | null>(null);

  const docRef = useMemoFirebase(() => 
    !isNewDoc && user && typeof docId === 'string'
      ? doc(firestore, `users/${user.uid}/documents`, docId)
      : null
  , [firestore, user, docId, isNewDoc]);

  const { data: documentData, isLoading: isLoadingDoc } = useDoc<TextDocument>(docRef);
  const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userDocRef);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (documentData) {
      setTitle(documentData.title);
      setIsLocked(!!documentData.isLocked);
      setIsPublished(!!documentData.isPublished);
      if (documentData.isLocked) setIsEditing(false);
      if (editorRef.current && editorRef.current.innerHTML !== documentData.content) {
        editorRef.current.innerHTML = documentData.content;
      }
      setSaveStatus('idle');
    }
  }, [documentData]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
      let node = range.startContainer;
      let tableFound = false;
      while (node && node !== editorRef.current) {
        if (node.nodeName === 'TABLE') { tableFound = true; break; }
        node = node.parentNode as Node;
      }
      setIsInTable(tableFound);
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const handleSave = useCallback(async () => {
    if (!firestore || !user || !title.trim() || isLocked) return;
    setSaveStatus('saving');
    const content = editorRef.current?.innerHTML || '';
    const authorName = user.displayName || user.email?.split('@')[0] || 'Anonym';
    try {
      if (isNewDoc) {
        const docsColRef = collection(firestore, `users/${user.uid}/documents`);
        const newDocRef = await addDoc(docsColRef, {
          title, content, authorName, ownerId: user.uid, isLocked: false, isPublished: false,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        router.replace(`/workspace/documents/${newDocRef.id}`);
      } else if (docRef) {
        await setDoc(docRef, { title, content, authorName, updatedAt: serverTimestamp() }, { merge: true });
      }
      setSaveStatus('idle');
      setIsConfirmLiveUpdateOpen(false);
    } catch (error) {
      setSaveStatus('dirty');
    }
  }, [firestore, user, title, isNewDoc, docRef, router, isLocked]);

  const triggerAutoSave = () => {
    if (isLocked) return;
    setSaveStatus('dirty');
    if (isPublished) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(handleSave, 2000);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !userDocRef || !storage) return;
    const currentUsage = userProfile?.storageUsage || 0;
    if (currentUsage + file.size > STORAGE_LIMIT_BYTES) {
        toast({ variant: 'destructive', title: 'Speicher voll', description: 'Du hast dein Limit von 3 GB erreicht.' });
        return;
    }
    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
    if (!type) return;

    const storageRefPath = `users/${user.uid}/media/${Date.now()}_${file.name}`;
    const fileRef = ref(storage, storageRefPath);
    const uploadTask = uploadBytesResumable(fileRef, file);

    setUploadProgress(0);

    uploadTask.on('state_changed', 
        {
            next: (snap) => {
                const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
                setUploadProgress(Math.round(progress));
            },
            error: (err) => {
                console.error("Upload error:", err);
                toast({ variant: 'destructive', title: 'Upload fehlgeschlagen', description: err.message });
                setUploadProgress(null);
            },
            complete: async () => {
                try {
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    await updateDoc(userDocRef, { storageUsage: increment(file.size) });
                    await addDoc(collection(firestore, `users/${user.uid}/media`), {
                        name: file.name, url, type, size: file.size, fullPath: storageRefPath, createdAt: serverTimestamp()
                    });
                    insertMediaBlock(type, url);
                    setUploadProgress(null);
                    toast({ title: 'Datei hochgeladen!' });
                } catch (err: any) {
                    console.error("Finalization error:", err);
                    setUploadProgress(null);
                }
            }
        }
    );
  };

  const insertMediaBlock = (type: 'image' | 'video', url: string) => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (!selection) return;
    if (savedRange.current) { selection.removeAllRanges(); selection.addRange(savedRange.current); }
    const range = selection.getRangeAt(0);
    let content = '';
    if (type === 'image') content = `<div style="text-align: center;"><img src="${url}" style="max-width: 100%; border-radius: 8px;" alt="Bild" /></div>`;
    else content = `<div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; border-radius: 16px; overflow: hidden;"><iframe src="${url}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe></div>`;
    const html = `<div class="special-block-wrapper" style="position: relative; margin: 1.5rem 0;"><button class="remove-block-btn" contenteditable="false">✕</button>${content}</div><p><br></p>`;
    const fragment = range.createContextualFragment(html);
    range.insertNode(fragment);
    range.collapse(false);
    triggerAutoSave();
  };

  const execCommand = (command: string, value: string = '') => {
    if (!isEditing || isLocked) return;
    editorRef.current?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    triggerAutoSave();
  };

  const applyStyle = (styleKey: 'fontSize' | 'fontFamily', value: string) => {
    if (!isEditing || isLocked) return;
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    document.execCommand('styleWithCSS', false, 'true');
    if (range.collapsed) {
        const span = document.createElement('span');
        if (styleKey === 'fontFamily') span.style.fontFamily = value;
        if (styleKey === 'fontSize') { span.style.fontSize = `${value}px`; setFontSize(value); }
        span.appendChild(document.createTextNode('\u200B'));
        range.insertNode(span);
        range.setStart(span.firstChild!, 1); range.setEnd(span.firstChild!, 1);
        selection.removeAllRanges(); selection.addRange(range);
    } else {
        if (styleKey === 'fontFamily') document.execCommand('fontName', false, value);
        else if (styleKey === 'fontSize') {
            document.execCommand('fontSize', false, '7'); 
            editorRef.current?.querySelectorAll('font[size="7"]').forEach(f => {
                const s = document.createElement('span');
                s.style.fontSize = `${value}px`; s.innerHTML = f.innerHTML;
                f.parentNode?.replaceChild(s, f);
            });
            setFontSize(value);
        }
    }
    triggerAutoSave();
  };

  const insertTable = () => {
    const tableHtml = `<div class="table-container special-block-wrapper" style="margin: 1.5em 0; position: relative;"><button class="remove-block-btn" contenteditable="false">✕</button><table style="width: 100%; border: 2px solid #ddd; border-radius: 8px;"><thead><tr style="background-color: #f4f4f5;"><th style="border: 1px solid #ddd; padding: 12px;">Spalte 1</th><th style="border: 1px solid #ddd; padding: 12px;">Spalte 2</th></tr></thead><tbody><tr><td style="border: 1px solid #ddd; padding: 12px;">...</td><td style="border: 1px solid #ddd; padding: 12px;">...</td></tr></tbody></table></div><p><br></p>`;
    execCommand('insertHTML', tableHtml);
  };

  const openMediaDialog = (type: any) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) savedRange.current = selection.getRangeAt(0).cloneRange();
    setIsMediaDialogOpen({ type, open: true });
  };

  if (isUserLoading || (isLoadingDoc && !isNewDoc)) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Caveat:wght@400;700&family=Comfortaa:wght@400;700&family=Dancing+Script:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,700;1,400&family=Fira+Code:wght@400;700&family=Inconsolata:wght@400;700&family=Inter:wght@400;700&family=Lora:ital,wght@0,400;0,700;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700;900&family=Open+Sans:wght@400;700&family=Oswald:wght@400;700&family=Pacifico&family=Playfair+Display:wght@400;700;900&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Raleway:ital,wght@0,400;0,700;1,400&family=Roboto:wght@400;700&family=Source+Code+Pro:ital,wght@0,400;0,700;1,400&family=Ubuntu:wght@400;700&display=swap');
        [contenteditable]:empty:before { content: 'Schreib etwas...'; color: #a1a1aa; font-style: italic; }
        .remove-block-btn { position: absolute; right: -10px; top: -10px; background: red; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: none; align-items: center; justify-content: center; z-index: 40; }
        .special-block-wrapper:hover .remove-block-btn { display: flex; }
      `}</style>

      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,video/*" />

      <header className="bg-background border-b sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between p-3 px-4">
            <div className="flex items-center gap-3 flex-1">
                <Button variant="ghost" size="icon" onClick={() => router.push('/workspace')}><ArrowLeft className="h-4 w-4" /></Button>
                <Input placeholder="Titel..." className="text-lg font-black border-0 shadow-none p-0 bg-transparent flex-1" value={title} onChange={e => { setTitle(e.target.value); triggerAutoSave(); }} />
            </div>
            <div className="flex items-center gap-2">
                {uploadProgress !== null && (
                    <div className="w-24 flex flex-col gap-1 mr-2">
                        <span className="text-[8px] font-black uppercase text-primary text-center">Upload {uploadProgress}%</span>
                        <Progress value={uploadProgress} className="h-1" />
                    </div>
                )}
                <Badge variant="outline" className="text-[9px] uppercase font-black">{saveStatus === 'saving' ? 'Auto-Save' : 'Gespeichert'}</Badge>
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title="Upload"><Upload className="h-4 w-4" /></Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setIsEditing(!isEditing)}>{isEditing ? 'Lesemodus' : 'Bearbeiten'}</DropdownMenuItem>
                        <DropdownMenuItem onClick={insertTable}>Tabelle einfügen</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        {isEditing && (
            <div className="flex items-center gap-1 p-1 bg-secondary/10 border-t overflow-x-auto">
                <Button variant="ghost" size="icon" onClick={() => execCommand('bold')}><Bold className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" onClick={() => execCommand('italic')}><Italic className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" onClick={() => execCommand('underline')}><Underline className="h-3.5 w-3.5" /></Button>
                <Separator orientation="vertical" className="h-4 mx-1" />
                <Button variant="ghost" size="icon" onClick={() => execCommand('insertUnorderedList')}><List className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" onClick={() => execCommand('insertOrderedList')}><ListOrdered className="h-3.5 w-3.5" /></Button>
            </div>
        )}
      </header>

      <main className={cn("flex-1 overflow-auto p-6 md:p-12 max-w-5xl mx-auto w-full")}>
        <div ref={editorRef} contentEditable={isEditing && !isLocked} className="outline-none prose max-w-none text-lg leading-relaxed" onInput={triggerAutoSave} spellCheck="false" />
      </main>
    </div>
  );
}
