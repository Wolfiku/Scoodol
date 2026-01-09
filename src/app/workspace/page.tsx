
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare, Loader2, FileText, BarChart3, StickyNote, MoreHorizontal, Search } from 'lucide-react';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { doc } from 'firebase/firestore';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"


type UserProfile = {
  role?: 'user' | 'admin' | 'workspace_plus_user';
}


export default function WorkspacePage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

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
                        <DropdownMenuItem disabled>
                          <StickyNote className="mr-2 h-4 w-4" />
                          <span>Quick Note</span>
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
                <div className="p-8 text-center text-muted-foreground bg-secondary rounded-lg">
                    <p>Hier werden bald deine Dokumente und Chats angezeigt.</p>
                </div>
            </div>

        </div>
    );
}
