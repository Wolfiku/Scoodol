
'use client';

import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type TextDocument = {
  title: string;
  content: string;
  authorName?: string;
  updatedAt: any;
};

export default function PublicDocumentPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const docId = params?.docId as string;
  const firestore = useFirestore();

  const docRef = useMemoFirebase(() => 
    userId && docId ? doc(firestore, `users/${userId}/documents`, docId) : null
  , [firestore, userId, docId]);

  const { data: documentData, isLoading } = useDoc<TextDocument>(docRef);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <h1 className="text-xl font-bold">Dokument nicht gefunden</h1>
        <p className="text-muted-foreground">Dieses Dokument existiert nicht oder ist nicht mehr öffentlich.</p>
      </div>
    );
  }

  const formattedDate = documentData.updatedAt 
    ? format(new Date(documentData.updatedAt.seconds * 1000), 'dd.MM.yyyy', { locale: de }) 
    : '';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-2 text-[13px] text-muted-foreground overflow-hidden whitespace-nowrap">
          <span className="font-bold text-foreground truncate">{documentData.title}</span>
          <span className="shrink-0">•</span>
          <span className="truncate">{documentData.authorName || 'Anonym'}</span>
          <span className="shrink-0">•</span>
          <span className="shrink-0">{formattedDate}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 md:p-12">
        <div 
          className="prose dark:prose-invert max-w-none text-lg leading-relaxed"
          dangerouslySetInnerHTML={{ __html: documentData.content }}
        />
      </main>
    </div>
  );
}
