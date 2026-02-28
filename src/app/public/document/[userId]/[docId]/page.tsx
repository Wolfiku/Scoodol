
'use client';

import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

type TextDocument = {
  title: string;
  content: string;
  isPublished?: boolean;
  ownerId: string;
  updatedAt?: any;
};

export default function PublicDocumentPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const docId = params?.docId as string;
  const firestore = useFirestore();

  const docRef = useMemoFirebase(() => 
    userId && docId ? doc(firestore, `users/${userId}/documents`, docId) : null
  , [firestore, userId, docId]);

  const { data: document, isLoading } = useDoc<TextDocument>(docRef);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (!document || !document.isPublished) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background p-6 text-center">
        <Globe className="w-16 h-16 text-muted-foreground mb-4 opacity-20" />
        <h1 className="text-2xl font-bold mb-2">Dokument nicht verfügbar</h1>
        <p className="text-muted-foreground">Dieses Dokument ist entweder privat oder existiert nicht.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&family=Inter:wght@400;700&family=Lora:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700;900&family=Open+Sans:wght@400;700&family=Roboto:wght@400;700&family=Playfair+Display:wght@400;700;900&family=Ubuntu:wght@400;700&display=swap');
        table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
        table td, table th { min-width: 50px; border: 1px solid #ddd; padding: 12px; }
        .table-container { overflow-x: auto; border-radius: 8px; border: 1px solid #eee; }
        img { max-width: 100%; height: auto; border-radius: 12px; }
        .video-wrapper { position: relative; padding-bottom: 56.25%; height: 0; margin: 2em 0; border-radius: 16px; overflow: hidden; }
        .video-wrapper iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
      `}</style>

      <header className="border-b bg-card py-12">
        <div className="max-w-4xl mx-auto px-6">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">{document.title}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Globe className="w-3 h-3" />
                Öffentliches Dokument
            </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-12 px-6">
        <div 
          className="prose dark:prose-invert max-w-none text-lg leading-relaxed"
          dangerouslySetInnerHTML={{ __html: document.content }}
        />
      </main>
    </div>
  );
}
