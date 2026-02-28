'use client';

import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function PublicDocumentPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const docId = params?.docId as string;
  const firestore = useFirestore();

  const docRef = useMemoFirebase(() => 
    userId && docId ? doc(firestore, `users/${userId}/documents`, docId) : null
  , [firestore, userId, docId]);

  const authorRef = useMemoFirebase(() => 
    userId ? doc(firestore, `users/${userId}`) : null
  , [firestore, userId]);

  const { data: documentData, isLoading: isLoadingDoc } = useDoc<any>(docRef);
  const { data: authorData, isLoading: isLoadingAuthor } = useDoc<any>(authorRef);

  if (isLoadingDoc || isLoadingAuthor) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  if (!documentData || !documentData.isPublished) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Dokument nicht gefunden</h1>
        <p className="text-muted-foreground">Dieses Dokument existiert nicht oder ist nicht mehr öffentlich.</p>
      </div>
    );
  }

  // Get name from profile document (displayName or email from settings)
  const authorName = authorData?.displayName || authorData?.settings?.email || 'Ein Scoodol Nutzer';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 md:p-12">
        <header className="mb-10 border-b pb-6">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6">{documentData.title}</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] uppercase tracking-widest font-black text-foreground/40">
            <div className="flex items-center gap-1.5">
              <span>Autor</span>
              <span className="text-foreground/80">{authorName}</span>
            </div>
            {documentData.updatedAt && (
              <div className="flex items-center gap-1.5">
                <span>Zuletzt aktualisiert</span>
                <span className="text-foreground/80">
                  {format(new Date(documentData.updatedAt.seconds * 1000), 'PPP', { locale: de })}
                </span>
              </div>
            )}
          </div>
        </header>
        <main 
          className="prose dark:prose-invert max-w-none text-lg leading-relaxed selection:bg-primary/20" 
          dangerouslySetInnerHTML={{ __html: documentData.content }} 
        />
      </div>
    </div>
  );
}
