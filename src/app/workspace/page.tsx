
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare, Loader2 } from 'lucide-react';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import AiTutor from '@/app/components/tools/ai-tutor';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { doc } from 'firebase/firestore';

type UserProfile = {
  role?: 'user' | 'admin' | 'workspace_plus_user';
}


export default function WorkspacePage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const [isChatOpen, setIsChatOpen] = useState(false);

    const userDocRef = useMemoFirebase(() => 
        user ? doc(firestore, 'users', user.uid) : null
    , [firestore, user]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);
    
    useEffect(() => {
      // Don't do anything while data is loading
      if (isUserLoading || isProfileLoading) return;

      // If user is not logged in or is anonymous, redirect to login
      if (!user || user.isAnonymous) {
        router.push('/login');
        return;
      }
    }, [user, isUserLoading, isProfileLoading, router]);

    
    if (isUserLoading || isProfileLoading) {
        return (
             <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        )
    }

    // Render null while redirecting or if user is not authenticated
    if (!user || user.isAnonymous) {
        return null;
    }


    return (
        <div className="container mx-auto p-4 md:p-8">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Scoodol Workspace</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsChatOpen(true)}>
                        <MessageSquare className="mr-2" />
                        Chat
                    </Button>
                    <Button>
                        <Plus className="mr-2" />
                        Neu
                    </Button>
                </div>
            </header>

            <div>
                <h2 className="text-xl font-semibold mb-4">Zuletzt geöffnet</h2>
                <div className="p-8 text-center text-muted-foreground bg-secondary rounded-lg">
                    <p>Hier werden bald deine Dokumente und Chats angezeigt.</p>
                </div>
            </div>

            <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>AI Tutor</DialogTitle>
                        <DialogDescription>
                            Chatte mit Scoody, wenn du bei einem Thema nicht weiterweißt.
                        </DialogDescription>
                    </DialogHeader>
                   <AiTutor />
                </DialogContent>
            </Dialog>
        </div>
    );
}
