'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Loader2, Calendar, User, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

type TextDocument = {
  title: string;
  content: string;
  authorName?: string;
  ownerId: string;
  isPublished?: boolean;
  createdAt: any;
  updatedAt: any;
};

export default function PublicDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const userId = params?.userId as string;
  const docId = params?.docId as string;

  const docRef = useMemoFirebase(() => 
    userId && docId ? doc(firestore, `users/${userId}/documents`, docId) : null
  , [firestore, userId, docId]);

  const { data: documentData, isLoading } = useDoc<TextDocument>(docRef);

  useEffect(() => {
    const handleClick = async (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const hwBtn = target.closest('.add-hw-btn') as HTMLButtonElement;
        
        if (hwBtn && user && !user.isAnonymous) {
            const container = hwBtn.closest('.hw-template') as HTMLElement;
            if (container) {
                const subject = container.dataset.subject || 'Allgemein';
                const task = container.dataset.task || 'Aufgabe';
                const hwRef = collection(firestore, `users/${user.uid}/homeworks`);
                await addDocumentNonBlocking(hwRef, {
                    subject,
                    task,
                    done: false,
                    dueDate: '',
                    createdAt: Date.now()
                });
                toast({ title: "Hausaufgabe hinzugefügt!", description: task });
            }
        } else if (hwBtn) {
            toast({ variant: 'destructive', title: 'Anmeldung erforderlich', description: 'Bitte melde dich an, um Hausaufgaben einzuplanen.' });
        }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [user, firestore, toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-background">
        <Loader2 className="animate-spin text-primary w-10 h-10" />
        <p className="text-muted-foreground animate-pulse font-medium">Dokument wird geladen...</p>
      </div>
    );
  }

  if (!documentData || !documentData.isPublished) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-background">
        <div className="bg-secondary/50 p-8 rounded-3xl border-2 border-dashed max-w-md">
            <h1 className="text-2xl font-black mb-2">Nicht verfügbar</h1>
            <p className="text-muted-foreground mb-6">Dieses Dokument existiert nicht oder ist nicht (mehr) öffentlich.</p>
            <Button onClick={() => router.push('/')} className="w-full">Zurück zur Startseite</Button>
        </div>
      </div>
    );
  }

  const date = documentData.updatedAt ? new Date(documentData.updatedAt.seconds * 1000) : new Date();

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 public-view">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Caveat:wght@400;700&family=Comfortaa:wght@400;700&family=Dancing+Script:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,700;1,400&family=Fira+Code:wght@400;700&family=Inconsolata:wght@400;700&family=Inter:wght@400;700&family=Lora:ital,wght@0,400;0,700;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700;900&family=Open+Sans:wght@400;700&family=Oswald:wght@400;700&family=Pacifico&family=Playfair+Display:wght@400;700;900&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Raleway:ital,wght@0,400;0,700;1,400&family=Roboto:wght@400;700&family=Source+Code+Pro:ital,wght@0,400;0,700;1,400&family=Ubuntu:wght@400;700&display=swap');
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        table td, table th { min-width: 50px; border: 1px solid #ddd; padding: 12px; }
        .table-container { overflow-x: auto; border-radius: 8px; border: 1px solid #eee; }
        pre { white-space: pre-wrap !important; word-break: break-all; }
        .ext-link-card:hover { transform: translateY(-2px); transition: all 0.2s; }
        .video-wrapper { position: relative; padding-bottom: 56.25%; height: 0; border-radius: 16px; overflow: hidden; margin: 1.5rem 0; }
        .video-wrapper iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
        .remove-block-btn { display: none !important; }
      `}</style>

      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="h-8 w-px bg-border hidden sm:block" />
                <span className="text-sm font-black tracking-tighter uppercase hidden sm:block">Scoodol</span>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Öffentlich
            </Badge>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-12">
        <header className="mb-12 space-y-6">
            <h1 className="text-5xl font-black tracking-tight leading-tight">
                {documentData.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-full border">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-bold text-foreground">
                        {documentData.authorName || 'Unbekannter Autor'}
                    </span>
                </div>
                <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-full border">
                    <Calendar className="h-4 w-4" />
                    <span>
                        Aktualisiert: {format(date, 'PPP', { locale: de })}
                    </span>
                </div>
            </div>
        </header>

        <article 
            className="prose dark:prose-invert max-w-none text-lg leading-relaxed"
            dangerouslySetInnerHTML={{ __html: documentData.content }}
        />
      </main>
    </div>
  );
}
