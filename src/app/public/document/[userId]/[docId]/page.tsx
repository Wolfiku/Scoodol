'use client';

import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Loader2, Globe } from 'lucide-react';

/**
 * @fileOverview Öffentliche Leseansicht für veröffentlichte Dokumente.
 * Konzentriert sich rein auf den Inhalt ohne Werbung oder ablenkende UI.
 */

type TextDocument = {
  title: string;
  content: string;
  ownerId: string;
  isPublished?: boolean;
  updatedAt: any;
};

type UserProfile = {
    displayName?: string;
    settings?: {
        email?: string;
    };
}

export default function PublicDocumentPage() {
    const params = useParams();
    const userId = params?.userId as string;
    const docId = params?.docId as string;
    const firestore = useFirestore();

    // Referenz auf das Dokument im Firestore
    const docRef = useMemoFirebase(() => 
        userId && docId ? doc(firestore, `users/${userId}/documents`, docId) : null
    , [firestore, userId, docId]);

    // Referenz auf das Profil des Autors für den Namen
    const userRef = useMemoFirebase(() => 
        userId ? doc(firestore, 'users', userId) : null
    , [firestore, userId]);

    const { data: document, isLoading: isLoadingDoc } = useDoc<TextDocument>(docRef);
    const { data: profile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userRef);

    if (isLoadingDoc || isLoadingProfile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
                <Loader2 className="animate-spin text-primary w-8 h-8 mb-4" />
                <p className="text-muted-foreground animate-pulse text-xs font-black uppercase tracking-widest">Wird geladen</p>
            </div>
        );
    }

    // Zugriffsschutz: Dokument muss existieren und als veröffentlicht markiert sein
    if (!document || !document.isPublished) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background">
                <Globe className="w-16 h-16 text-muted-foreground/10 mb-6" />
                <h1 className="text-3xl font-black mb-2 tracking-tight">Nicht verfügbar</h1>
                <p className="text-muted-foreground max-w-xs mx-auto text-sm leading-relaxed">
                    Dieses Dokument ist entweder nicht veröffentlicht oder existiert nicht.
                </p>
            </div>
        );
    }

    // Name des Autors aus dem Manifest/Profil ziehen
    const authorName = profile?.displayName || profile?.settings?.email || 'Autor';
    const lastUpdate = document.updatedAt 
        ? format(new Date(document.updatedAt.seconds * 1000), 'PPP', { locale: de }) 
        : 'Unbekannt';

    return (
        <div className="bg-background min-h-screen selection:bg-primary/20">
            {/* Globale Styles für das Rich-Text-Rendering */}
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&family=Inter:wght@400;700&family=Lora:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700;900&family=Open+Sans:wght@400;700&family=Roboto:wght@400;700&family=Playfair+Display:wght@400;700;900&family=Ubuntu:wght@400;700&display=swap');
                
                .public-content {
                    font-family: var(--font-pt-sans), sans-serif;
                }
                .public-content table { border-collapse: collapse; width: 100%; margin: 2em 0; border: 1px solid #e5e7eb; font-size: 0.9em; }
                .public-content table td, .public-content table th { border: 1px solid #e5e7eb; padding: 12px; min-width: 50px; }
                .public-content table th { background-color: #f9fafb; font-weight: bold; text-align: left; }
                .public-content .table-container { overflow-x: auto; margin: 2em 0; border-radius: 8px; border: 1px solid #e5e7eb; }
                .public-content img { max-width: 100%; height: auto; display: block; margin: 2.5em auto; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
                .public-content .video-wrapper { position: relative; padding-bottom: 56.25%; height: 0; margin: 2.5em 0; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
                .public-content .video-wrapper iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
                .public-content p { margin-bottom: 1.25em; line-height: 1.75; }
                .public-content a { color: hsl(var(--primary)); text-decoration: underline; text-underline-offset: 4px; }
                .public-content blockquote { border-left: 4px solid #e5e7eb; padding-left: 1em; font-style: italic; color: #6b7280; margin: 2em 0; }
            `}</style>
            
            <main className="container mx-auto p-6 md:p-20 max-w-4xl animate-in fade-in duration-500">
                <header className="mb-12">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 leading-tight text-foreground">
                        {document.title}
                    </h1>
                    {/* Kompakte Manifest-Infos am Anfang */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground/40 border-t border-border/50 pt-4">
                        <div className="flex items-center gap-1.5">
                            <span className="opacity-50">Autor:</span>
                            <span className="text-foreground/60">{authorName}</span>
                        </div>
                        <span className="hidden md:inline opacity-20">/</span>
                        <div className="flex items-center gap-1.5">
                            <span className="opacity-50">Stand:</span>
                            <span className="text-foreground/60">{lastUpdate}</span>
                        </div>
                    </div>
                </header>

                {/* Eigentlicher Dokumenten-Inhalt */}
                <article 
                    className="public-content prose dark:prose-invert max-w-none text-xl leading-relaxed text-foreground/90"
                    dangerouslySetInnerHTML={{ __html: document.content }}
                />
                
                {/* Dezentrale Verabschiedung ohne Branding */}
                <footer className="mt-24 pb-12 border-t border-border/10 pt-8 text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground/20 text-center">
                    Ende der Aufzeichnung
                </footer>
            </main>
        </div>
    );
}
