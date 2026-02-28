'use client';

import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function PublicDocumentPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const docId = params?.docId as string;
  const firestore = useFirestore();

  const docRef = useMemoFirebase(() => 
    userId && docId ? doc(firestore, `users/${userId}/documents`, docId) : null
  , [firestore, userId, docId]);

  const { data: documentData, isLoading: isLoadingDoc } = useDoc(docRef);

  const authorRef = useMemoFirebase(() => 
    userId ? doc(firestore, 'users', userId) : null
  , [firestore, userId]);

  const { data: authorData, isLoading: isLoadingAuthor } = useDoc(authorRef);

  if (isLoadingDoc || isLoadingAuthor) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary" /></div>;
  if (!documentData || !documentData.isPublished) return <div className="flex items-center justify-center h-screen text-muted-foreground">Dokument nicht verfügbar.</div>;

  const authorName = authorData?.displayName || authorData?.settings?.email || authorData?.email || 'Ein Nutzer';

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto p-6 md:p-16">
        <header className="mb-12 border-b pb-6">
          <h1 className="text-4xl font-black mb-4">{documentData.title}</h1>
          <div className="flex items-center gap-6 text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">
            <div className="flex items-center gap-2">
              <span className="text-foreground/40">Autor</span>
              <span className="text-foreground">{authorName}</span>
            </div>
            {documentData.updatedAt && (
              <div className="flex items-center gap-2">
                <span className="text-foreground/40">Stand</span>
                <span className="text-foreground">{new Date(documentData.updatedAt.seconds * 1000).toLocaleDateString('de-DE')}</span>
              </div>
            )}
          </div>
        </header>
        
        <article 
          className="prose dark:prose-invert max-w-none text-lg"
          dangerouslySetInnerHTML={{ __html: documentData.content }}
        />
      </main>
    </div>
  );
}
