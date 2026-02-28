'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc } from 'firebase/firestore';
import { useUser } from '@/firebase';
import { Loader2, FileText, Calendar, User, ArrowLeft, BookmarkPlus } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

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
  const userId = params?.userId as string;
  const docId = params?.docId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const docRef = useMemoFirebase(() => 
    userId && docId ? doc(firestore, `users/${userId}/documents`, docId) : null
  , [firestore, userId, docId]);

  const { data, isLoading } = useDoc<TextDocument>(docRef);

  useEffect(() => {
    const handleAddHw = async (e: MouseEvent) => {
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
            toast({ 
                variant: 'destructive', 
                title: 'Anmeldung erforderlich', 
                description: 'Bitte melde dich an, um Hausaufgaben einplanen zu können.' 
            });
        }
    };
    document.addEventListener('click', handleAddHw);
    return () => document.removeEventListener('click', handleAddHw);
  }, [user, firestore, toast]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  if (!data || data.isPublished === false) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-4">
        <h1 className="text-2xl font-bold mb-2">Dokument nicht verfügbar</h1>
        <p className="text-muted-foreground mb-6">Dieses Dokument existiert nicht oder ist nicht öffentlich zugänglich.</p>
        <Button onClick={() => router.push('/')}><ArrowLeft className="mr-2 h-4 w-4" /> Zurück zur App</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><FileText className="h-5 w-5" /></div>
                <span className="font-black text-xl tracking-tighter">Scoodol</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/')}>App öffnen</Button>
        </div>
      </header>

      <main className="container mx-auto p-6 md:p-12 max-w-4xl">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground border-b pb-4 mb-10 overflow-hidden">
            <span className="font-bold text-foreground truncate max-w-[250px]">{data.title}</span>
            <span>•</span>
            <span className="flex items-center gap-1 shrink-0"><User className="h-3 w-3" /> {data.authorName || 'Anonym'}</span>
            <span>•</span>
            <span className="flex items-center gap-1 shrink-0"><Calendar className="h-3 w-3" /> {data.createdAt ? format(new Date(data.createdAt.seconds * 1000), 'PPP', { locale: de }) : 'Datum unbekannt'}</span>
        </div>

        <article 
          className="prose dark:prose-invert max-w-none text-lg leading-relaxed public-view"
          dangerouslySetInnerHTML={{ __html: data.content }}
        />
      </main>
    </div>
  );
}
