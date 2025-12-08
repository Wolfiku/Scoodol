
"use client";

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon } from 'lucide-react';

type Chat = {
  name?: string;
  type: 'private' | 'group';
  members: string[];
}

type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: any; 
  senderName?: string;
  senderPicture?: string;
}

export default function ChatDetailsPage() {
  const params = useParams();
  const { chatId } = params;
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Memoize document and collection references
  const chatDocRef = useMemoFirebase(() => 
    typeof chatId === 'string' ? doc(firestore, 'chats', chatId) : null
  , [firestore, chatId]);
  
  const messagesColRef = useMemoFirebase(() =>
    typeof chatId === 'string' ? collection(firestore, 'chats', chatId, 'messages') : null
  , [firestore, chatId]);

  const messagesQuery = useMemoFirebase(() => 
    messagesColRef ? query(messagesColRef, orderBy('createdAt', 'asc')) : null
  , [messagesColRef]);

  // Fetch chat details and messages
  const { data: chat, isLoading: isLoadingChat } = useDoc<Chat>(chatDocRef);
  const { data: messages, isLoading: isLoadingMessages } = useCollection<Omit<ChatMessage, 'id'>>(messagesQuery);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !user || !messagesColRef || !chatDocRef) return;

    setIsSending(true);
    try {
      await addDoc(messagesColRef, {
        text: trimmedMessage,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
      // Also update the chat's updatedAt field
      await updateDoc(chatDocRef, {
        lastMessage: trimmedMessage,
        updatedAt: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const isLoading = isUserLoading || isLoadingChat || isLoadingMessages;

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>;
  }
  
  if (!chat) {
    return <div className="text-center p-8">Chat nicht gefunden oder du hast keinen Zugriff.</div>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      <header className="p-4 border-b">
        <h2 className="text-xl font-bold">{chat.name || 'Privater Chat'}</h2>
      </header>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages?.map((msg) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                   <Avatar className="h-8 w-8">
                        <AvatarImage src={msg.senderPicture} />
                        <AvatarFallback><UserIcon className="h-4 w-4"/></AvatarFallback>
                    </Avatar>
                )}
                <div className={`max-w-xs md:max-w-md p-3 rounded-lg ${isMe ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                  <p className="text-sm">{msg.text}</p>
                   <p className={`text-xs mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {msg.createdAt?.toDate().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
      
      <footer className="p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input 
            placeholder="Nachricht schreiben..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={isSending}
          />
          <Button type="submit" disabled={isSending || !newMessage.trim()}>
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </form>
      </footer>
    </div>
  );
}
