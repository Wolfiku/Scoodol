
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Globe, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type TextDocument = {
  title: string;
  content: string;
  authorName?: string;
  isPublished?: boolean;
  updatedAt: any;
};

export default function PublicDocumentPage() {
    const params = useParams();
    const { userId, docId } = params;
    const firestore = useFirestore();
    const router = useRouter();

    const docRef = useMemoFirebase(() => 
        (userId && docId) ? doc(firestore, `users/${userId}/documents`, docId as string) : null
    , [firestore, userId, docId]);

    const { data: documentData, isLoading } = useDoc<TextDocument>(docRef);

    if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
    if (!documentData || !documentData.isPublished) return <div className="flex items-center justify-center h-screen text-muted-foreground">Dieses Dokument ist nicht verfügbar oder existiert nicht.</div>;

    return (
        <div className="min-h-screen bg-background">
            <header className="bg-background border-b sticky top-0 z-10 p-4">
                <div className="container mx-auto max-w-4xl flex items-center justify-between">
                    <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Zurück</Button>
                    <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-green-600" /><span className="text-xs font-bold uppercase text-green-600">Öffentliche Ansicht</span></div>
                </div>
            </header>

            <main className="container mx-auto max-w-4xl p-6 py-12 md:p-12">
                <div className="mb-12 space-y-4">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight">{documentData.title}</h1>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5"><User className="h-4 w-4" /> <span>{documentData.authorName || 'Unbekannt'}</span></div>
                        <div className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> <span>Zuletzt geändert am {documentData.updatedAt ? format(new Date(documentData.updatedAt.seconds * 1000), 'PPP', { locale: de }) : 'Unbekannt'}</span></div>
                    </div>
                </div>
                
                <div 
                    className="prose dark:prose-invert max-w-none text-lg leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: documentData.content }}
                />
            </main>

            <footer className="border-t p-8 mt-12 bg-secondary/10">
                <div className="container mx-auto max-w-4xl text-center">
                    <p className="text-sm text-muted-foreground font-bold italic">Erstellt mit Scoodol</p>
                </div>
            </footer>
        </div>
    );
}
