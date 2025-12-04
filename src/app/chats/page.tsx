
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, writeBatch, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, User, Users, Plus, ArrowRight, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import { time } from 'console';

type UserProfile = {
  chatIds?: string[];
  displayName?: string;
  settings?: {
      profilePicture?: string;
  }
}

type Chat = {
  id: string;
  name?: string;
  type: 'private' | 'group';
  members: string[];
  lastMessage?: string;
  updatedAt?: number;
  // For private chats, to show the other user's info
  otherMember?: {
    uid: string;
    displayName: string;
    profilePicture?: string;
  }
}

export default function ChatsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newChatShareId, setNewChatShareId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
        router.push('/login?redirect=/chats');
        return;
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (!userProfile?.chatIds || !firestore || !user) {
        setIsLoadingChats(false);
        setChats([]);
        return;
    };

    const fetchChats = async () => {
        setIsLoadingChats(true);
        try {
            const chatPromises = userProfile.chatIds!.map(id => getDoc(doc(firestore, 'chats', id)));
            const chatDocs = await Promise.all(chatPromises);
            
            const fetchedChats: Chat[] = [];

            for (const chatDoc of chatDocs) {
                if (chatDoc.exists()) {
                    const chatData = chatDoc.data() as Omit<Chat, 'id'>;
                    const newChat: Chat = { ...chatData, id: chatDoc.id };

                    // If it's a private chat, fetch the other user's profile
                    if (newChat.type === 'private') {
                        const otherMemberId = newChat.members.find(id => id !== user.uid);
                        if (otherMemberId) {
                            const memberDoc = await getDoc(doc(firestore, 'users', otherMemberId));
                            if (memberDoc.exists()) {
                                const memberData = memberDoc.data() as UserProfile;
                                newChat.otherMember = {
                                    uid: otherMemberId,
                                    displayName: memberData.displayName || 'Unknown User',
                                    profilePicture: memberData.settings?.profilePicture
                                }
                            }
                        }
                    }
                    fetchedChats.push(newChat);
                }
            }
            
            fetchedChats.sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            setChats(fetchedChats);

        } catch (error) {
            console.error("Error fetching chats:", error);
            toast({ variant: 'destructive', title: "Fehler", description: "Chats konnten nicht geladen werden."});
        }
        setIsLoadingChats(false);
    };

    fetchChats();

  }, [userProfile, firestore, user, toast]);

  const handleStartDirectChat = async () => {
      if (!firestore || !user || !newChatShareId.trim()) return;
      
      const targetUserId = newChatShareId.trim();
      if(targetUserId === user.uid) {
          toast({ variant: 'destructive', title: "Fehler", description: "Du kannst keinen Chat mit dir selbst starten."});
          return;
      }
      setIsCreating(true);

      try {
          // Check if target user exists
          const targetUserDoc = await getDoc(doc(firestore, 'users', targetUserId));
          if (!targetUserDoc.exists()) {
              toast({ variant: 'destructive', title: 'Benutzer nicht gefunden', description: 'Die eingegebene Share ID ist ungültig.' });
              setIsCreating(false);
              return;
          }
          
          const batch = writeBatch(firestore);
          const members = [user.uid, targetUserId];

          // Create new chat document
          const newChatRef = doc(collection(firestore, 'chats'));
          batch.set(newChatRef, {
              type: 'private',
              members: members,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
          });

          // Add chatId to both users' profiles
          members.forEach(memberId => {
              const userRef = doc(firestore, 'users', memberId);
              batch.update(userRef, { chatIds: arrayUnion(newChatRef.id) });
          });

          await batch.commit();

          toast({ title: 'Chat gestartet!' });
          setIsDialogOpen(false);
          setNewChatShareId('');
          router.push(`/chats/${newChatRef.id}`);

      } catch (error) {
          console.error(error);
          toast({ variant: 'destructive', title: 'Fehler', description: 'Der Chat konnte nicht gestartet werden.' });
      }
      setIsCreating(false);
  }

  const handleStartGroupChat = async () => {
    if (!firestore || !user || !newGroupName.trim()) return;
    setIsCreating(true);

    try {
        const batch = writeBatch(firestore);
        
        // Create new chat document
        const newChatRef = doc(collection(firestore, 'chats'));
        batch.set(newChatRef, {
            name: newGroupName,
            type: 'group',
            members: [user.uid],
            admins: [user.uid], // Creator is admin
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        
        // Add chatId to creator's profile
        const userRef = doc(firestore, 'users', user.uid);
        batch.update(userRef, { chatIds: arrayUnion(newChatRef.id) });

        await batch.commit();
        
        toast({ title: 'Gruppe erstellt!' });
        setIsDialogOpen(false);
        setNewGroupName('');
        router.push(`/chats/${newChatRef.id}`);

    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Fehler', description: 'Die Gruppe konnte nicht erstellt werden.' });
    }
    setIsCreating(false);
  }
  
  const isLoading = isUserLoading || isProfileLoading;
  
  if(isLoading) {
      return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary" /></div>;
  }

  if(!user) return null; // Should be redirected by useEffect

  return (
    <div className="container mx-auto p-4 md:p-8">
        <div className="flex flex-row justify-between items-center mb-6">
            <div>
                <h1 className="text-3xl font-bold">Meine Chats</h1>
                <p className="text-muted-foreground">Deine privaten und Gruppen-Konversationen.</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2"/> Neuer Chat
                </Button>
                </DialogTrigger>
                <DialogContent>
                <DialogHeader>
                    <DialogTitle>Neuen Chat starten</DialogTitle>
                    <DialogDescription>
                    Starte einen privaten Chat mit der Share ID oder erstelle eine neue Gruppe.
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="direct" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="direct">Direkt-Chat</TabsTrigger>
                    <TabsTrigger value="group">Gruppe</TabsTrigger>
                    </TabsList>
                    <TabsContent value="direct" className="space-y-4 pt-4">
                    <Input 
                        placeholder="Share ID des Nutzers einfügen"
                        value={newChatShareId}
                        onChange={(e) => setNewChatShareId(e.target.value)}
                    />
                    <Button onClick={handleStartDirectChat} disabled={isCreating} className="w-full">
                        {isCreating ? <Loader2 className="animate-spin" /> : 'Chat starten'}
                    </Button>
                    </TabsContent>
                    <TabsContent value="group" className="space-y-4 pt-4">
                    <Input 
                        placeholder="Gruppenname"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                    />
                    <Button onClick={handleStartGroupChat} disabled={isCreating} className="w-full">
                        {isCreating ? <Loader2 className="animate-spin" /> : 'Gruppe erstellen'}
                    </Button>
                    </TabsContent>
                </Tabs>
                </DialogContent>
            </Dialog>
        </div>

        {isLoadingChats ? (
            <div className="flex justify-center items-center p-8">
            <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        ) : chats.length > 0 ? (
        <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="space-y-2">
                {chats.map(chat => {
                    const avatarSrc = chat.type === 'private' ? chat.otherMember?.profilePicture : undefined;
                    const fallback = chat.type === 'private' 
                        ? (chat.otherMember?.displayName?.charAt(0) || '?') 
                        : (chat.name?.charAt(0) || 'G');

                    const displayName = chat.type === 'private' ? chat.otherMember?.displayName : chat.name;
                    
                    return (
                        <Link href={`/chats/${chat.id}`} key={chat.id}>
                            <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary cursor-pointer transition-colors">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={avatarSrc} />
                                    <AvatarFallback className="text-xl bg-muted-foreground/20">
                                        {chat.type === 'group' ? <Users/> : fallback}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 truncate">
                                    <p className="font-semibold truncate">{displayName || "Unbekannter Chat"}</p>
                                    <p className="text-sm text-muted-foreground truncate">{chat.lastMessage || "Noch keine Nachrichten"}</p>
                                </div>
                                <div className="flex flex-col items-end text-xs text-muted-foreground">
                                    {chat.updatedAt && <span>{new Date(chat.updatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>}
                                    {/* Placeholder for unread count badge */}
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </ScrollArea>
        ) : (
            <div className="text-center p-12 bg-secondary rounded-lg">
            <MessageSquare className="mx-auto w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold">Noch keine Chats</h3>
            <p className="text-muted-foreground mt-1">Starte einen neuen Chat, um loszulegen.</p>
            </div>
        )}
    </div>
  );
}

    