'use client';

import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Loader2, User, Calendar, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export default function PublicDocumentPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const docId = params?.docId as string;
  
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const docRef = useMemoFirebase(() => 
    userId && docId ? doc(firestore, `users/${userId}/documents`, docId) : null
  , [firestore, userId, docId]);

  const { data: documentData, isLoading } = useDoc(docRef);

  useEffect(() => {
    const handleClick = async (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const hwBtn = target.closest('.add-hw-btn') as HTMLButtonElement;
        
        if (hwBtn && user) {
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
        } else if (hwBtn && !user) {
            toast({ variant: 'destructive', title: "Anmeldung erforderlich", description: "Melde dich an, um Hausaufgaben einzuplanen." });
        }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [user, firestore, toast]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  if (!documentData || !documentData.isPublished) {
    return (
        <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
            <h1 className="text-2xl font-bold mb-2">Dokument nicht verfügbar</h1>
            <p className="text-muted-foreground mb-6">Dieses Dokument existiert nicht oder ist nicht für die Öffentlichkeit freigegeben.</p>
            <Button onClick={() => router.push('/')}>Zur Startseite</Button>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/')}><ArrowLeft className="h-5 w-5" /></Button>
                <h1 className="font-black text-xl truncate max-w-[200px] md:max-w-md">{documentData.title}</h1>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground font-medium">
                <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {documentData.authorName || 'Anonym'}</div>
                <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {documentData.updatedAt ? format(new Date(documentData.updatedAt.seconds * 1000), 'PP', { locale: de }) : '...'}</div>
            </div>
        </div>
      </header>

      <main className="container mx-auto p-6 md:p-12 max-w-5xl">
        <div className="sm:hidden mb-8 p-4 bg-secondary/30 rounded-xl flex flex-col gap-2 text-xs text-muted-foreground font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2"><User className="w-3.5 h-3.5" /> {documentData.authorName || 'Anonym'}</div>
            <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {documentData.updatedAt ? format(new Date(documentData.updatedAt.seconds * 1000), 'PPP', { locale: de }) : '...'}</div>
        </div>

        <div 
            className="prose dark:prose-invert max-w-none text-lg leading-relaxed public-view" 
            dangerouslySetInnerHTML={{ __html: documentData.content }} 
        />
      </main>

      <footer className="border-t p-8 mt-12 bg-secondary/10">
          <div className="container mx-auto text-center text-sm text-muted-foreground">
              <p>Erstellt mit Scoodol – Deinem smarten Schulbegleiter.</p>
          </div>
      </footer>

      <style jsx global>{`
        table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
        table td, table th { min-width: 50px; border: 1px solid #ddd; padding: 12px; }
        .table-container { overflow-x: auto; border-radius: 8px; border: 1px solid #eee; }
        .special-block-wrapper { position: relative; }
        .remove-block-btn { display: none !important; }
        .ext-link-card:hover { transform: translateY(-2px); transition: all 0.2s; }
        pre { background-color: #121212; color: #e0e0e0; padding: 1.5rem; border-radius: 0.75rem; font-family: monospace; overflow-x: auto; white-space: pre-wrap; }
      `}</style>
    </div>
  );
}
