
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Loader2, ArrowLeft, Bold, Italic, Underline, Link as LinkIcon, 
    Table as TableIcon, Image as ImageIcon, Video, AlignLeft, AlignCenter, AlignRight, 
    List, ListOrdered, Save, Check, MoreHorizontal, Trash2, ChevronDown,
    Strikethrough, Palette, Highlighter, PlusSquare, MinusSquare,
    Indent, Outdent, Type as FontIcon, BookOpen, Edit, Lock, Unlock, FileText, Download, Info, Globe, QrCode, Copy, Send, Eraser, X as XIcon
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
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import QRCode from 'qrcode';

type TextDocument = {
  title: string;
  content: string;
  ownerId: string;
  isLocked?: boolean;
  isPublished?: boolean;
  createdAt: any;
  updatedAt: any;
};

type SaveStatus = 'idle' | 'dirty' | 'saving';

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
  const [isMediaDialogOpen, setIsMediaDialogOpen] = useState<{type: 'image' | 'video' | 'link', open: boolean}>({type: 'link', open: false});
  const [mediaUrl, setMediaUrl] = useState('');
  const [isInTable, setIsInTable] = useState(false);
  const [fontSize, setFontSize] = useState('18');
  
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

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
      setIsLocked(!!documentData.isLocked);
      setIsPublished(!!documentData.isPublished);
      if (documentData.isLocked) {
          setIsEditing(false);
      }
      
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
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
          savedRange.current = range.cloneRange();
      }

      let node = range.startContainer;
      let tableFound = false;
      while (node && node !== editorRef.current) {
        if (node.nodeName === 'TABLE') {
          tableFound = true;
          break;
        }
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

    try {
      if (isNewDoc) {
        const docsColRef = collection(firestore, `users/${user.uid}/documents`);
        const newDocRef = await addDoc(docsColRef, {
          title,
          content,
          ownerId: user.uid,
          isLocked: false,
          isPublished: false,
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
      setIsConfirmLiveUpdateOpen(false);
    } catch (error) {
      setSaveStatus('dirty');
    }
  }, [firestore, user, title, isNewDoc, docRef, router, isLocked]);

  const triggerAutoSave = () => {
    if (isLocked) return;
    setSaveStatus('dirty');
    
    // Wenn das Dokument veröffentlicht ist, erzwingen wir eine manuelle Bestätigung
    if (isPublished) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(handleSave, 2000);
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
    if (!selection) return;

    if (savedRange.current && !editorRef.current?.contains(selection.anchorNode)) {
        selection.removeAllRanges();
        selection.addRange(savedRange.current);
    }

    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);

    document.execCommand('styleWithCSS', false, 'true');

    if (range.collapsed) {
        const span = document.createElement('span');
        if (styleKey === 'fontFamily') span.style.fontFamily = value;
        if (styleKey === 'fontSize') {
            span.style.fontSize = `${value}px`;
            setFontSize(value);
        }
        span.appendChild(document.createTextNode('\u200B'));
        range.insertNode(span);
        range.setStart(span.firstChild!, 1);
        range.setEnd(span.firstChild!, 1);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        if (styleKey === 'fontFamily') {
            document.execCommand('fontName', false, value);
            const fonts = editorRef.current?.querySelectorAll('font[face]');
            fonts?.forEach(f => {
                const s = document.createElement('span');
                s.style.fontFamily = f.getAttribute('face') || '';
                s.innerHTML = f.innerHTML;
                f.parentNode?.replaceChild(s, f);
            });
        } else if (styleKey === 'fontSize') {
            document.execCommand('fontSize', false, '7'); 
            const fonts = editorRef.current?.querySelectorAll('font[size="7"]');
            fonts?.forEach(f => {
                const s = document.createElement('span');
                s.style.fontSize = `${value}px`;
                s.innerHTML = f.innerHTML;
                f.parentNode?.replaceChild(s, f);
            });
            setFontSize(value);
        }
    }
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
    let container = table.parentElement;
    while (container && container !== editorRef.current && !container.classList.contains('table-container')) {
        container = container.parentElement;
    }
    if (container && container.classList.contains('table-container')) container.remove();
    else table.remove();
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
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (!selection) return;
    
    if (savedRange.current) {
        selection.removeAllRanges();
        selection.addRange(savedRange.current);
    }
    
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    let htmlToInsert = '';
    
    if (isMediaDialogOpen.type === 'link') {
        document.execCommand('createLink', false, mediaUrl);
    } else if (isMediaDialogOpen.type === 'image') {
        htmlToInsert = `<div style="text-align: center; margin: 1.5em 0;"><img src="${mediaUrl}" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" alt="Bild" /></div><p><br></p>`;
    } else if (isMediaDialogOpen.type === 'video') {
        let embedUrl = mediaUrl;
        if (mediaUrl.includes('youtube.com/watch?v=')) embedUrl = mediaUrl.replace('watch?v=', 'embed/');
        else if (mediaUrl.includes('youtu.be/')) embedUrl = mediaUrl.replace('youtu.be/', 'youtube.com/embed/');
        htmlToInsert = `<div class="video-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; margin: 2em 0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.15);"><iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe></div><p><br></p>`;
    }
    
    if (htmlToInsert) {
        const fragment = range.createContextualFragment(htmlToInsert);
        range.insertNode(fragment);
        range.collapse(false);
    }
    
    setMediaUrl('');
    setIsMediaDialogOpen({ ...isMediaDialogOpen, open: false });
    triggerAutoSave();
  };

  const openMediaDialog = (type: 'image' | 'video' | 'link') => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) savedRange.current = selection.getRangeAt(0).cloneRange();
      setIsMediaDialogOpen({ type, open: true });
  }

  const handleDelete = async () => {
    if (isNewDoc || !docRef) return;
    await deleteDoc(docRef);
    toast({ title: 'Dokument gelöscht' });
    router.push('/workspace');
  };

  const toggleLock = async () => {
      if (isNewDoc || !docRef) return;
      const newLockState = !isLocked;
      setIsLocked(newLockState);
      if (newLockState) setIsEditing(false);
      await setDoc(docRef, { isLocked: newLockState }, { merge: true });
      toast({ title: newLockState ? 'Dokument gesperrt' : 'Dokument entsperrt' });
  };

  const togglePublish = async () => {
      if (isNewDoc || !docRef) return;
      const newPublishState = !isPublished;
      setIsPublished(newPublishState);
      await setDoc(docRef, { isPublished: newPublishState }, { merge: true });
      toast({ 
          title: newPublishState ? 'Dokument veröffentlicht!' : 'Dokument privat geschaltet',
          description: newPublishState ? 'Dein Dokument ist nun über den öffentlichen Link erreichbar.' : 'Der öffentliche Zugriff wurde deaktiviert.'
      });
  };

  const publicUrl = useMemo(() => {
    if (typeof window === 'undefined' || !user || !docId) return '';
    return `${window.location.origin}/public/document/${user.uid}/${docId}`;
  }, [user, docId]);

  const copyPublicLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Link kopiert!", description: "Du kannst ihn jetzt teilen." });
  }

  const handleShowQr = async () => {
    try {
        const url = await QRCode.toDataURL(publicUrl, {
            width: 400,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
        });
        setQrCodeUrl(url);
        setIsQrDialogOpen(true);
    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Fehler', description: 'QR-Code konnte nicht generiert werden.' });
    }
  };

  const downloadQr = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `doc-qr-${title.replace(/\s+/g, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAsPDF = () => {
      const content = editorRef.current?.innerHTML || '';
      const printWindow = window.open('', '_blank');
      if (printWindow) {
          printWindow.document.write(`
              <html>
                  <head>
                      <title>${title}</title>
                      <style>
                          body { font-family: sans-serif; padding: 40px; line-height: 1.6; }
                          h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
                          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                          td, th { border: 1px solid #ddd; padding: 12px; text-align: left; }
                          img { max-width: 100%; height: auto; border-radius: 8px; }
                          .video-wrapper { display: none; }
                      </style>
                  </head>
                  <body>
                      <h1>${title}</h1>
                      ${content}
                  </body>
              </html>
          `);
          printWindow.document.close();
          printWindow.print();
      }
  };

  const exportAsDocx = () => {
      const content = editorRef.current?.innerHTML || '';
      const html = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head><meta charset='utf-8'><title>${title}</title></head>
          <body><h1>${title}</h1>${content}</body>
          </html>
      `;
      const url = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(html);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title || 'dokument'}.doc`;
      link.click();
  };

  const preventDefault = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
  };

  if (isUserLoading || (isLoadingDoc && !isNewDoc)) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Caveat:wght@400;700&family=Comfortaa:wght@400;700&family=Dancing+Script:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,700;1,400&family=Fira+Code:wght@400;700&family=Inconsolata:wght@400;700&family=Inter:wght@400;700&family=Lora:ital,wght@0,400;0,700;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700;900&family=Open+Sans:wght@400;700&family=Oswald:wght@400;700&family=Pacifico&family=Playfair+Display:wght@400;700;900&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Raleway:ital,wght@0,400;0,700;1,400&family=Roboto:wght@400;700&family=Source+Code+Pro:ital,wght@0,400;0,700;1,400&family=Ubuntu:wght@400;700&display=swap');
        [contenteditable]:empty:before { content: 'Beginne hier mit deinem Text...'; color: #a1a1aa; cursor: text; font-style: italic; }
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        table td, table th { min-width: 50px; border: 1px solid #ddd; padding: 12px; }
        .table-container { overflow-x: auto; border-radius: 8px; border: 1px solid #eee; }
        ::selection { background-color: hsla(var(--primary), 0.3); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Dokument wirklich löschen?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmLiveUpdateOpen} onOpenChange={setIsConfirmLiveUpdateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Änderungen live schalten?</AlertDialogTitle>
            <AlertDialogDescription>
                Dieses Dokument ist veröffentlicht. Sobald du speicherst, werden die Änderungen für alle Besucher sofort sichtbar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Noch nicht</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} className="bg-green-600 text-white hover:bg-green-700">Änderungen veröffentlichen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isManifestOpen} onOpenChange={setIsManifestOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Dokument-Manifest</DialogTitle>
                  <DialogDescription>Hintergrundinformationen zu dieser Datei.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-muted-foreground">Titel</div><div className="font-bold">{title || 'Unbenannt'}</div>
                      <div className="text-muted-foreground">Autor</div><div className="font-bold">{user?.displayName || user?.email || 'System'}</div>
                      <div className="text-muted-foreground">Erstellt am</div><div className="font-bold">{documentData?.createdAt ? format(new Date(documentData.createdAt.seconds * 1000), 'PPP p', { locale: de }) : 'Gerade eben'}</div>
                      <div className="text-muted-foreground">Letzte Änderung</div><div className="font-bold">{documentData?.updatedAt ? format(new Date(documentData.updatedAt.seconds * 1000), 'PPP p', { locale: de }) : 'Unbekannt'}</div>
                      <div className="text-muted-foreground">Status</div><div className="flex gap-2"><Badge variant={isLocked ? 'destructive' : 'secondary'}>{isLocked ? 'Gesperrt' : 'Offen'}</Badge>{isPublished && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Öffentlich</Badge>}</div>
                  </div>
              </div>
              <DialogFooter><Button onClick={() => setIsManifestOpen(false)}>Schließen</Button></DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>QR-Code für dein Dokument</DialogTitle><DialogDescription>Teile diesen Code, damit andere dein Dokument scannen und lesen können.</DialogDescription></DialogHeader>
            <div className="flex flex-col items-center justify-center p-6 gap-4">{qrCodeUrl && (<div className="bg-white p-4 rounded-lg shadow-sm border"><img src={qrCodeUrl} alt="Doc QR Code" className="w-64 h-64" /></div>)}<Button onClick={downloadQr} className="w-full"><Download className="mr-2 h-4 w-4" /> Herunterladen (.png)</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMediaDialogOpen.open} onOpenChange={(open) => setIsMediaDialogOpen({...isMediaDialogOpen, open})}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>{isMediaDialogOpen.type === 'link' ? 'Link einfügen' : isMediaDialogOpen.type === 'image' ? 'Bild-URL einfügen' : 'Video-URL einfügen'}</DialogTitle>
                <DialogDescription>Gib die URL für dein Medium ein.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4"><div className="space-y-2"><Label htmlFor="url">URL</Label><Input id="url" placeholder="https://..." value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} autoFocus /></div></div>
            <DialogFooter><Button variant="outline" onClick={() => setIsMediaDialogOpen({...isMediaDialogOpen, open: false})}>Abbrechen</Button><Button onClick={handleMediaInsert}>Einfügen</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <header className="bg-background border-b sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between p-3 px-4">
            <div className="flex items-center gap-3 flex-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/workspace')}><ArrowLeft className="h-4 w-4" /></Button>
                <Input 
                    placeholder="Titel..." 
                    className="text-lg font-black border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent flex-1"
                    value={title}
                    onChange={e => { setTitle(e.target.value); triggerAutoSave(); }}
                    readOnly={isLocked}
                />
            </div>
            <div className="flex items-center gap-2">
                {isPublished && (
                    <Button variant="ghost" size="sm" className="text-[9px] uppercase font-black text-green-600 flex items-center gap-1 bg-green-100 px-2 py-0.5 rounded animate-pulse h-6" onClick={handleShowQr}>
                        <Globe className="h-2.5 w-2.5" />
                        Live
                    </Button>
                )}
                
                {isPublished && saveStatus === 'dirty' ? (
                    <Button variant="default" size="sm" className="h-7 text-[10px] font-bold bg-green-600 hover:bg-green-700 animate-in zoom-in duration-300" onClick={() => setIsConfirmLiveUpdateOpen(true)}>
                        <Send className="h-3 w-3 mr-1" />
                        Live schalten
                    </Button>
                ) : (
                    <span className="text-[9px] uppercase font-black text-muted-foreground flex items-center gap-1 bg-secondary/50 px-2 py-0.5 rounded">
                        {saveStatus === 'saving' ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                        {saveStatus === 'saving' ? 'Auto-Save' : 'Gespeichert'}
                    </span>
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Dokument</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setIsEditing(!isEditing)} disabled={isLocked}>
                            {isEditing ? <><BookOpen className="mr-2 h-4 w-4" /> Lesemodus</> : <><Edit className="mr-2 h-4 w-4" /> Bearbeiten</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={togglePublish} disabled={isNewDoc}>
                            {isPublished ? <><Globe className="mr-2 h-4 w-4" /> Privat schalten</> : <><Globe className="mr-2 h-4 w-4" /> Veröffentlichen</>}
                        </DropdownMenuItem>
                        {isPublished && <DropdownMenuItem onClick={handleShowQr}><QrCode className="mr-2 h-4 w-4" /> QR-Code anzeigen</DropdownMenuItem>}
                        {isPublished && <DropdownMenuItem onClick={copyPublicLink}><Copy className="mr-2 h-4 w-4" /> Link kopieren</DropdownMenuItem>}
                        <DropdownMenuItem onClick={toggleLock} disabled={isNewDoc}>
                            {isLocked ? <><Unlock className="mr-2 h-4 w-4" /> Entsperren</> : <><Lock className="mr-2 h-4 w-4" /> Sperren</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Export</DropdownMenuLabel>
                        <DropdownMenuItem onClick={exportAsPDF}><FileText className="mr-2 h-4 w-4" /> Als PDF (Drucken)</DropdownMenuItem>
                        <DropdownMenuItem onClick={exportAsDocx}><Download className="mr-2 h-4 w-4" /> Als Word (.docx)</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsManifestOpen(true)} disabled={isNewDoc}><Info className="mr-2 h-4 w-4" /> Manifest-Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={handleSave} disabled={saveStatus !== 'dirty' || isLocked}><Save className="mr-2 h-4 w-4" /> Jetzt speichern</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} disabled={isNewDoc || isLocked} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Löschen</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        {isEditing && !isLocked && (
            <div className="flex items-center gap-1 p-1 bg-secondary/10 border-t overflow-x-auto no-scrollbar scroll-smooth flex-nowrap">
                <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-[11px] font-bold" onMouseDown={preventDefault}><FontIcon className="h-3.5 w-3.5" /> <ChevronDown className="h-2.5 w-2.5 opacity-50" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-60 overflow-y-auto">
                            {FONTS.map(font => (<DropdownMenuItem key={font.name} onClick={() => applyStyle('fontFamily', font.family)} style={{ fontFamily: font.family }}>{font.name}</DropdownMenuItem>))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="flex items-center gap-1 ml-1"><span className="text-[10px] font-bold opacity-50">PX</span><Input type="number" min="1" max="100" value={fontSize} onChange={e => applyStyle('fontSize', e.target.value)} className="h-7 w-12 text-[11px] p-1 text-center bg-background border-none focus-visible:ring-1" /></div>
                </div>
                <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => execCommand('bold')}><Bold className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => execCommand('italic')}><Italic className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => execCommand('underline')}><Underline className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => execCommand('strikethrough')}><Strikethrough className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Formatierung löschen" onMouseDown={preventDefault} onClick={() => execCommand('removeFormat')}><Eraser className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" title="Farbe" onMouseDown={preventDefault}><Palette className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2">{['#000000', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4', '#10b981'].map(color => (<button key={color} className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: color }} onClick={() => execCommand('foreColor', color)} />))}</DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" title="Marker" onMouseDown={preventDefault}><Highlighter className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2">
                            <button className="w-5 h-5 rounded-full border border-border flex items-center justify-center bg-background" onClick={() => execCommand('hiliteColor', 'transparent')} title="Keine Markierung"><XIcon className="w-3 h-3 text-destructive" /></button>
                            {['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa', '#ccfbf1', '#f3f4f6', '#ffedd5'].map(color => (<button key={color} className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: color }} onClick={() => execCommand('hiliteColor', color)} />))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => execCommand('insertUnorderedList')}><List className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => execCommand('insertOrderedList')}><ListOrdered className="h-3.5 w-3.5" /></Button>
                    <Separator orientation="vertical" className="h-4 mx-1" />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => execCommand('outdent')}><Outdent className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => execCommand('indent')}><Indent className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex items-center gap-0.5 border-r pr-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => execCommand('justifyLeft')}><AlignLeft className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => execCommand('justifyCenter')}><AlignCenter className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => execCommand('justifyRight')}><AlignRight className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 pl-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => openMediaDialog('link')}><LinkIcon className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => openMediaDialog('image')}><ImageIcon className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onMouseDown={preventDefault} onClick={() => openMediaDialog('video')}><Video className="h-3.5 w-3.5" /></Button>
                    <Separator orientation="vertical" className="h-4 mx-1" />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onMouseDown={preventDefault} onClick={insertTable}><TableIcon className="h-3.5 w-3.5" /></Button>
                </div>
            </div>
        )}

        {isInTable && isEditing && !isLocked && (
            <div className="flex items-center gap-2 p-1 px-4 bg-primary/10 border-t animate-in slide-in-from-top-1 duration-200">
                <span className="text-[10px] font-black uppercase text-primary/70 mr-2 flex items-center gap-1"><TableIcon className="h-3 w-3" /> Tabelle</span>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2" onMouseDown={preventDefault} onClick={addRow}><PlusSquare className="h-3 w-3" /> Zeile unten</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2" onMouseDown={preventDefault} onClick={addColumn}><PlusSquare className="h-3 w-3" /> Spalte rechts</Button>
                <Separator orientation="vertical" className="h-4 mx-1" />
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2 text-destructive hover:text-destructive" onMouseDown={preventDefault} onClick={deleteRow}><MinusSquare className="h-3 w-3" /> Zeile löschen</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2 text-destructive font-black hover:text-destructive" onMouseDown={preventDefault} onClick={deleteCurrentTable}><Trash2 className="h-3 w-3" /> Tabelle löschen</Button>
            </div>
        )}
      </header>

      <main className="flex-1 overflow-auto bg-background selection:bg-primary/30">
        <div className="w-full h-full p-6 md:p-12 max-w-5xl mx-auto">
            <div 
                ref={editorRef}
                contentEditable={isEditing && !isLocked}
                className={cn(
                    "w-full min-h-[calc(100vh-200px)] outline-none prose dark:prose-invert max-w-none text-lg leading-relaxed focus:ring-0",
                    !isEditing && "cursor-default"
                )}
                onInput={triggerAutoSave}
                spellCheck="false"
                style={{ fontFamily: 'inherit' }}
            />
        </div>
      </main>
    </div>
  );
}
