
"use client";

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft, Calendar, User, Globe, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function PublicDocumentPage() {
    const params = useParams();
    const { userId, docId } = params;
    const firestore = useFirestore();
    const router = useRouter();

    const docRef = useMemoFirebase(() => 
        userId && docId ? doc(firestore, `users/${userId}/documents/${docId}`) : null
    , [firestore, userId, docId]);

    const { data: documentData, isLoading } = useDoc<any>(docRef);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!documentData || (!documentData.isPublished && documentData.ownerId !== userId)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background p-4">
                <Card className="max-w-md w-full text-center p-8">
                    <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                    <CardTitle className="text-2xl font-bold">Dokument nicht verfügbar</CardTitle>
                    <CardDescription className="mt-2">Dieses Dokument existiert nicht oder wurde privat geschaltet.</CardDescription>
                    <Button onClick={() => router.push('/')} className="mt-6 w-full">Zur Startseite</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="bg-background border-b p-4 sticky top-0 z-10">
                <div className="container mx-auto max-w-4xl flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/')}><ArrowLeft className="h-5 w-5" /></Button>
                    <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-black uppercase text-green-600 tracking-widest">Öffentliches Dokument</span>
                    </div>
                </div>
            </header>

            <main className="container mx-auto max-w-4xl p-6 md:p-12">
                <header className="mb-10 space-y-6">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">{documentData.title}</h1>
                    <div className="flex flex-wrap gap-6 text-sm text-muted-foreground border-y py-4">
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span className="font-bold">Autor: {documentData.authorName || 'Anonym'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Veröffentlicht am {documentData.createdAt ? format(new Date(documentData.createdAt.seconds * 1000), 'PPP', { locale: de }) : 'Unbekannt'}</span>
                        </div>
                    </div>
                </header>

                <div 
                    className="prose dark:prose-invert max-w-none text-xl leading-relaxed selection:bg-primary/20"
                    dangerouslySetInnerHTML={{ __html: documentData.content }}
                />
            </main>

            <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t text-center text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black">
                Gelesen auf Scoodol • Erstellt von {documentData.authorName || 'Anonym'}
            </footer>

            <style jsx global>{`
                .prose h1 { font-weight: 900; letter-spacing: -0.05em; font-size: 2.5rem; margin-top: 2rem; margin-bottom: 1rem; }
                .prose h2 { font-weight: 900; letter-spacing: -0.03em; font-size: 1.8rem; margin-top: 1.5rem; margin-bottom: 0.75rem; }
                .prose p { margin-bottom: 1.5rem; }
                .prose table { border-collapse: collapse; width: 100%; margin: 2rem 0; border: 2px solid hsl(var(--border)); }
                .prose td, .prose th { border: 1px solid hsl(var(--border)); padding: 1rem; }
                .prose th { background: hsl(var(--secondary)); font-weight: bold; }
                .prose img { border-radius: 1rem; box-shadow: 0 10px 30px rgba(0,0,0,0.1); margin: 2rem auto; display: block; }
                .special-block-wrapper { margin: 2rem 0; }
                .remove-block-btn { display: none !important; }
                .hw-template { border: 2px dashed hsl(var(--accent)); padding: 1.5rem; border-radius: 1.5rem; background: hsl(var(--secondary)/0.5); }
                .add-hw-btn { display: none !important; }
                .ext-link-card { border: 1px solid hsl(var(--border)); background: hsl(var(--secondary)); padding: 1rem; border-radius: 1rem; }
            `}</style>
        </div>
    );
}
