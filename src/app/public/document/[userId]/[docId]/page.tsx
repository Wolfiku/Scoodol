
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2, ArrowLeft, FileText, Globe, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type TextDocument = {
  title: string;
  content: string;
  ownerId: string;
  isPublished?: boolean;
  createdAt: any;
  updatedAt: any;
};

export default function PublicDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.userId as string;
  const docId = params?.docId as string;
  const firestore = useFirestore();

  const docRef = useMemoFirebase(() => 
    userId && docId ? doc(firestore, `users/${userId}/documents`, docId) : null
  , [firestore, userId, docId]);

  const { data: documentData, isLoading } = useDoc<TextDocument>(docRef);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Loader2 className="animate-spin text-primary w-10 h-10" />
        <p className="text-muted-foreground animate-pulse">Dokument wird geladen...</p>
      </div>
    );
  }

  if (!documentData || !documentData.isPublished) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
        <div className="bg-secondary/50 p-6 rounded-full mb-6">
            <Globe className="w-16 h-16 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-black mb-2">Nicht verfügbar</h1>
        <p className="text-muted-foreground max-w-md mb-8">Dieses Dokument ist entweder privat oder existiert nicht mehr.</p>
        <Button onClick={() => router.push('/')} variant="outline">Zurück zu Scoodol</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&family=Inter:wght@400;700&family=Lora:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700;900&family=Open+Sans:wght@400;700&family=Roboto:wght@400;700&family=Playfair+Display:wght@400;700;900&family=Ubuntu:wght@400;700&display=swap');
        table { border-collapse: collapse; width: 100%; margin: 1.5em 0; border: 1px solid #ddd; }
        table td, table th { border: 1px solid #ddd; padding: 12px; }
        .table-container { overflow-x: auto; margin: 1.5em 0; }
        img { max-width: 100%; height: auto; border-radius: 8px; }
        .video-wrapper { position: relative; padding-bottom: 56.25%; height: 0; margin: 2em 0; border-radius: 12px; overflow: hidden; }
        .video-wrapper iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
      `}</style>

      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto max-w-4xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg"><FileText className="w-5 h-5 text-primary" /></div>
                <h1 className="text-lg font-black truncate max-w-[200px] md:max-w-md">{documentData.title}</h1>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1.5 py-1">
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
                Live Ansicht
            </Badge>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl p-6 md:p-12 pb-24">
        <div className="flex flex-wrap gap-4 items-center mb-8 text-sm text-muted-foreground bg-secondary/20 p-4 rounded-xl border">
            <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="font-medium">Geteilt von Scoodol Nutzer</span>
            </div>
            <Separator orientation="vertical" className="h-4 hidden sm:block" />
            <div className="flex items-center gap-2">
                <span>Zuletzt aktualisiert: {documentData.updatedAt ? format(new Date(documentData.updatedAt.seconds * 1000), 'PPP', { locale: de }) : 'Unbekannt'}</span>
            </div>
        </div>

        <div 
            className="prose dark:prose-invert max-w-none text-lg leading-relaxed"
            dangerouslySetInnerHTML={{ __html: documentData.content }}
        />

        <div className="mt-20 pt-12 border-t text-center">
            <p className="text-muted-foreground text-sm mb-4">Erstellt mit Scoodol - Deinem smarten Schulbegleiter.</p>
            <Button onClick={() => router.push('/')} variant="secondary">Jetzt selbst Scoodol nutzen</Button>
        </div>
      </main>
    </div>
  );
}
