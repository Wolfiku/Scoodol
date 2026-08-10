
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

const { firestore } = initializeFirebase();

export default function PublicDocumentPage() {
  const params = useParams();
  const { userId, docId } = params;
  const router = useRouter();
  
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDoc() {
      if (!userId || !docId) return;
      const docRef = doc(firestore, `users/${userId}/documents`, docId as string);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().isPublished) {
        setDocument(snap.data());
      }
      setLoading(false);
    }
    fetchDoc();
  }, [userId, docId]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary" /></div>;

  if (!document) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full text-center py-12">
          <CardHeader><CardTitle className="text-3xl font-black">Nicht gefunden</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Dieses Dokument existiert nicht oder ist nicht öffentlich zugänglich.</p></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 border-b bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
           <h1 className="text-xl font-bold truncate pr-4">{document.title}</h1>
           <Button variant="outline" size="sm" onClick={() => router.push('/')}>Zu Scoodol</Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-12">
        <div className="mb-10 flex flex-wrap gap-6 text-sm text-muted-foreground border-b pb-6">
            <div className="flex items-center gap-2"><User className="w-4 h-4" /><span>{document.authorName || 'Unbekannter Autor'}</span></div>
            <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span>{document.createdAt ? format(new Date(document.createdAt.seconds * 1000), 'PPP', { locale: de }) : 'Unbekanntes Datum'}</span></div>
        </div>

        <article 
          className="prose dark:prose-invert max-w-none text-lg leading-relaxed"
          dangerouslySetInnerHTML={{ __html: document.content }}
        />
        
        <footer className="mt-20 pt-10 border-t text-center text-muted-foreground text-xs uppercase tracking-widest font-bold">
            Bereitgestellt von Scoodol
        </footer>
      </main>
    </div>
  );
}
