'use client';

import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import React from 'react';

/**
 * @fileOverview Öffentliche Ansicht für geteilte Text-Dokumente.
 * Zeigt ausschließlich das Dokument im Vollbild-Modus an, ohne weitere App-UI.
 */
export default function PublicDocumentPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const docId = params?.docId as string;
  const firestore = useFirestore();

  // Stabile Referenz für das Firestore-Dokument erstellen
  const docRef = useMemoFirebase(() => 
    userId && docId ? doc(firestore, `users/${userId}/documents`, docId) : null
  , [firestore, userId, docId]);

  // Echtzeit-Abonnement des Dokuments
  const { data: documentData, isLoading } = useDoc(docRef);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="animate-spin text-primary/30 w-8 h-8" />
      </div>
    );
  }

  // Sicherheitsprüfung: Nur anzeigen, wenn das Dokument existiert und veröffentlicht ist
  if (!documentData || !documentData.isPublished) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground/40 font-bold uppercase tracking-widest text-xs">
        404 • Nicht gefunden oder nicht veröffentlicht
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background selection:bg-primary/30 antialiased">
      {/* Inline-Styles für Schriftarten und Dokument-Formatierung (Tabellen, Bilder, etc.) */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Caveat:wght@400;700&family=Comfortaa:wght@400;700&family=Dancing+Script:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,700;1,400&family=Fira+Code:wght@400;700&family=Inconsolata:wght@400;700&family=Inter:wght@400;700&family=Lora:ital,wght@0,400;0,700;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700;900&family=Open+Sans:wght@400;700&family=Oswald:wght@400;700&family=Pacifico&family=Playfair+Display:wght@400;700;900&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Raleway:ital,wght@0,400;0,700;1,400&family=Roboto:wght@400;700&family=Source+Code+Pro:ital,wght@0,400;0,700;1,400&family=Ubuntu:wght@400;700&display=swap');
        
        table { border-collapse: collapse; width: 100%; margin: 2em 0; border: 1px solid hsl(var(--border)); }
        table td, table th { min-width: 50px; border: 1px solid hsl(var(--border)); padding: 14px; }
        .table-container { overflow-x: auto; margin: 2em 0; border-radius: 8px; border: 1px solid hsl(var(--border)); }
        img { max-width: 100%; height: auto; border-radius: 12px; margin: 2.5em auto; display: block; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
        .video-wrapper { position: relative; padding-bottom: 56.25%; height: 0; border-radius: 20px; overflow: hidden; margin: 2.5em 0; box-shadow: 0 15px 45px rgba(0,0,0,0.15); }
        .video-wrapper iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
        
        /* Editor-UI Elemente in der öffentlichen Ansicht ausblenden */
        .remove-block-btn, .add-hw-btn { display: none !important; }
        
        /* Layout-Container für echte Vollbild-Optik */
        .public-doc-view { padding: 4rem 1.5rem; margin: 0 auto; max-width: 900px; }
        @media (min-width: 768px) { .public-doc-view { padding: 8rem 4rem; } }
      `}</style>
      
      <div className="public-doc-view animate-in fade-in duration-1000">
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-foreground mb-4 leading-none">
          {documentData.title}
        </h1>
        <div className="h-1.5 w-20 bg-primary mb-16 rounded-full" />
        
        <article 
          className="prose dark:prose-invert max-w-none text-lg md:text-xl leading-relaxed text-foreground/90"
          dangerouslySetInnerHTML={{ __html: documentData.content }}
        />
      </div>
    </main>
  );
}
