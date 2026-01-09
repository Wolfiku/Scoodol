
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, StickyNote, FileText, BarChart3, MoreHorizontal, Loader2, Edit, Share2, Trash2 } from 'lucide-react';
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { useRouter } from 'next/navigation';
import { doc, collection, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';


type UserProfile = {
  role?: 'user' | 'admin' | 'workspace_plus_user';
}

type QuickNote = {
  id: string;
  title: string;
  updatedAt: {
    seconds: number;
    nanoseconds: number;
  }
}


export default function WorkspacePage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();

    const userDocRef = useMemoFirebase(() => 
        user ? doc(firestore, 'users', user.uid) : null
    , [firestore, user]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    const notesQuery = useMemoFirebase(() =>
      user ? query(collection(firestore, `users/${user.uid}/quickNotes`), orderBy('updatedAt', 'desc'), limit(5)) : null
    , [firestore, user]);

    const { data: recentNotes, isLoading: isLoadingNotes } = useCollection<QuickNote>(notesQuery);
    
    useEffect(() => {
      if (isUserLoading || isProfileLoading) return;
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

    if (!user || user.isAnonymous) {
        return null;
    }

    const formatRelativeTime = (timestamp: QuickNote['updatedAt']) => {
      if (!timestamp) return '';
      const date = new Date(timestamp.seconds * 1000);
      return formatDistanceToNow(date, { addSuffix: true, locale: de });
    }

    const handleDeleteNote = async (noteId: string, noteTitle: string) => {
      if (!user) return;
      const noteDocRef = doc(firestore, `users/${user.uid}/quickNotes`, noteId);
      await deleteDoc(noteDocRef);
      toast({
        title: "Notiz gelöscht!",
        description: `Die Notiz "${noteTitle}" wurde endgültig gelöscht.`
      });
    }


    return (
        <div className="container mx-auto p-4 md:p-8">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Scoodol Workspace</h1>
                <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button>
                              <Plus className="mr-2" />
                              Neu
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56" align="end">
                        <DropdownMenuLabel>Erstellen</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/workspace/notes/new">
                            <StickyNote className="mr-2 h-4 w-4" />
                            <span>Quick Note</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          <FileText className="mr-2 h-4 w-4" />
                          <span>Dokument</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          <BarChart3 className="mr-2 h-4 w-4" />
                          <span>Stats</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/workspace/explore">
                            <MoreHorizontal className="mr-2 h-4 w-4" />
                            <span>Weiteres ...</span>
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <div>
                <h2 className="text-xl font-semibold mb-4">Zuletzt geöffnet</h2>
                {isLoadingNotes ? (
                    <div className="p-8 text-center text-muted-foreground bg-secondary rounded-lg">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </div>
                ) : recentNotes && recentNotes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recentNotes.map(note => (
                        <Card key={note.id} className="hover:shadow-md transition-shadow flex flex-col">
                           <div className="p-4 flex-1">
                              <div className="flex justify-between items-start mb-2">
                                <h3 className="font-semibold truncate pr-4">{note.title}</h3>
                                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full whitespace-nowrap">Quick Note</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Bearbeitet {formatRelativeTime(note.updatedAt)}
                              </p>
                           </div>
                           <div className="p-2 border-t flex justify-end items-center gap-1">
                                <Button asChild variant="ghost" size="icon">
                                  <Link href={`/workspace/notes/${note.id}`} >
                                    <Edit className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button variant="ghost" size="icon" disabled>
                                    <Share2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteNote(note.id, note.title)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                           </div>
                        </Card>
                      ))}
                    </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground bg-secondary rounded-lg">
                      <p>Noch keine Notizen vorhanden. Erstelle deine erste!</p>
                  </div>
                )}
            </div>
        </div>
    );
}
