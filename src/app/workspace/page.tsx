
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare } from 'lucide-react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import AiTutor from '@/app/components/tools/ai-tutor';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function WorkspacePage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const [isChatOpen, setIsChatOpen] = useState(false);

    if (isUserLoading) {
        return <div className="flex justify-center items-center h-screen">Lade...</div>
    }

    if (!user || user.isAnonymous) {
        router.push('/login');
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
