'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

/**
 * Öffentliche Ansicht eines Text-Dokuments.
 * Zeigt den Inhalt im Lese-Modus an, ohne Editor-Funktionen oder Branding-Footer.
 */
export default function PublicDocumentPage() {
  const params = useParams();
  const { userId, docId } = params;
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const docRef = useMemoFirebase(() => 
    userId && docId ? doc(firestore, `users/${userId}/documents`, docId as string) : null
  , [firestore, userId, docId]);

  const { data: documentData, isLoading } = useDoc(docRef);

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
                addDocumentNonBlocking(hwRef, {
                    subject,
                    task,
                    done: false,
                    dueDate: '',
                    createdAt: Date.now()
                });
                toast({ title: "Hausaufgabe übernommen!", description: task });
            }
        } else if (hwBtn) {
            toast({ variant: 'destructive', title: "Anmeldung erforderlich", description: "Melde dich an, um Hausaufgaben zu speichern." });
        }
    };
    document.addEventListener('click', handleAddHw);
    return () => document.removeEventListener('click', handleAddHw);
  }, [user, firestore, toast]);

  if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary" /></div>;
  if (!documentData || !documentData.isPublished) return <div className="p-8 text-center bg-secondary/10 min-h-screen flex items-center justify-center flex-col gap-4">
    <p className="text-xl font-bold">Dieses Dokument ist nicht verfügbar.</p>
    <Button variant="outline" onClick={() => router.push('/')}>Zur App</Button>
  </div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto max-w-4xl flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push('/')} className="font-bold text-primary">
            Scoodol
          </Button>
          <div className="text-right">
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">Ein Dokument von</p>
            <p className="font-bold text-sm">{documentData.authorName || 'Anonym'}</p>
          </div>
        </div>
      </header>
      <main className="container mx-auto max-w-4xl p-6 md:p-12 pb-32">
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">{documentData.title}</h1>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-12">
            <span className="bg-secondary px-2 py-1 rounded font-bold">Veröffentlicht</span>
            <span>{documentData.createdAt ? format(new Date(documentData.createdAt.seconds * 1000), 'PPP', { locale: de }) : ''}</span>
        </div>
        <div 
          className="prose dark:prose-invert max-w-none text-lg leading-relaxed public-view"
          dangerouslySetInnerHTML={{ __html: documentData.content }}
        />
      </main>
    </div>
  );
}
