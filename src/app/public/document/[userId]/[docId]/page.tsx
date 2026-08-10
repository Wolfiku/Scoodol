'use client';

import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function PublicDocumentPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const docId = params?.docId as string;
  const firestore = useFirestore();

  const docRef = useMemoFirebase(() => 
    userId && docId ? doc(firestore, 'users', userId, 'documents', docId) : null
  , [firestore, userId, docId]);

  const { data: document, isLoading } = useDoc(docRef);

  if (isLoading || !document || !document.isPublished) {
    return null;
  }

  return (
    <main className="w-full min-h-screen bg-background p-6 md:p-12">
      <div 
        className="prose dark:prose-invert max-w-none w-full"
        dangerouslySetInnerHTML={{ __html: document.content }}
      />
      <style jsx global>{`
        /* Stile für den Inhalt, der aus dem Editor kommt */
        table { border-collapse: collapse; width: 100%; margin: 1.5em 0; }
        table td, table th { min-width: 50px; border: 1px solid #ddd; padding: 12px; text-align: left; }
        .table-container { overflow-x: auto; border-radius: 8px; border: 1px solid #eee; margin: 1.5em 0; }
        img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 1.5em auto; }
        .video-wrapper { position: relative; padding-bottom: 56.25%; height: 0; border-radius: 16px; overflow: hidden; margin: 2rem 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .video-wrapper iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
        .special-block-wrapper { position: relative; margin: 1.5rem 0; }
        /* Entferne Editor-spezifische Schaltflächen in der öffentlichen Ansicht */
        .remove-block-btn { display: none !important; }
        pre { background-color: #121212; color: #e0e0e0; padding: 1.5rem; border-radius: 0.75rem; font-family: monospace; overflow-x: auto; border: 1px solid #333; }
        .ext-link-card { border: 1px solid hsl(var(--border)); background: hsl(var(--secondary)); padding: 1rem; border-radius: 0.75rem; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 1rem; border-left: 4px solid hsl(var(--primary)); }
        .hw-template { border: 2px dashed hsla(var(--accent), 0.3); background: hsl(var(--secondary)); padding: 1rem; border-radius: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
      `}</style>
    </main>
  );
}
