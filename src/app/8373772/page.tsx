
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function AdminGrantPage() {
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [status, setStatus] = useState('Prüfe Berechtigung...');

    const userDocRef = useMemoFirebase(() =>
        user && !user.isAnonymous ? doc(firestore, `users/${user.uid}`) : null
    , [firestore, user]);

    useEffect(() => {
        if (isUserLoading) {
            return; // Wait until user object is loaded
        }

        if (!user || user.isAnonymous) {
            toast({
                variant: 'destructive',
                title: 'Fehler',
                description: 'Du musst angemeldet sein, um diese Seite zu nutzen.',
            });
            router.push('/login');
            return;
        }

        if (user.displayName === 'wolfiku') {
            setStatus('Berechtigung erteilt. Weise Admin-Rolle zu...');
            
            if (userDocRef) {
                setDoc(userDocRef, { settings: { role: 'admin' } }, { merge: true })
                    .then(() => {
                        toast({
                            title: 'Glückwunsch!',
                            description: 'Du bist jetzt ein Admin!',
                        });
                        router.push('/');
                    })
                    .catch((error) => {
                        toast({
                            variant: 'destructive',
                            title: 'Fehler beim Zuweisen der Rolle',
                            description: error.message,
                        });
                        setStatus(`Fehler: ${error.message}`);
                    });
            }
        } else {
            toast({
                variant: 'destructive',
                title: 'Kein Zugriff',
                description: 'Diese Seite ist nur für spezielle Nutzer.',
            });
            router.push('/');
        }
    }, [user, isUserLoading, router, toast, userDocRef]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{status}</p>
        </div>
    );
}
