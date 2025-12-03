
"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, Send, MessageSquare, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getTutorChatReply } from '@/app/actions';
import { ScrollArea } from '@/components/ui/scroll-area';

type Message = {
    role: 'user' | 'model';
    content: { text: string }[];
};

const DAILY_MESSAGE_LIMIT = 5;

const getTodaysMessageCount = () => {
    if (typeof window === 'undefined') return 0;
    const today = new Date().toISOString().split('T')[0];
    const data = JSON.parse(localStorage.getItem('aiTutorUsage') || '{}');
    if (data.date === today) {
        return data.count || 0;
    }
    return 0;
}

const incrementMessageCount = () => {
    if (typeof window === 'undefined') return 0;
    const today = new Date().toISOString().split('T')[0];
    const count = getTodaysMessageCount() + 1;
    localStorage.setItem('aiTutorUsage', JSON.stringify({ date: today, count }));
    return count;
}

export default function AiTutor() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const [chatHistory, setChatHistory] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState('');
    const [messageCount, setMessageCount] = useState(0);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMessageCount(getTodaysMessageCount());
    }, []);
    
    useEffect(() => {
        if(scrollAreaRef.current?.lastElementChild) {
            const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if(viewport) {
                 viewport.scrollTop = viewport.scrollHeight;
            }
        }
    }, [chatHistory]);

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedInput = userInput.trim();
        if (!trimmedInput || isLoading) return;

        if (messageCount >= DAILY_MESSAGE_LIMIT) {
            toast({
                variant: 'destructive',
                title: 'Tageslimit erreicht',
                description: `Du hast dein Limit von ${DAILY_MESSAGE_LIMIT} Nachrichten für heute erreicht.`,
            });
            return;
        }

        setIsLoading(true);
        const newUserMessage: Message = { role: 'user', content: [{ text: userInput }] };
        const newHistory = [...chatHistory, newUserMessage];
        setChatHistory(newHistory);
        setUserInput('');

        const result = await getTutorChatReply({ history: newHistory });
        
        if (result.error || !result.reply) {
            toast({
                variant: 'destructive',
                title: 'Fehler',
                description: result.error || 'Die KI hat nicht geantwortet.',
            });
             setChatHistory(prev => prev.slice(0, -1));
        } else {
            const newModelMessage: Message = { role: 'model', content: [{ text: result.reply }] };
            setChatHistory(prev => [...prev, newModelMessage]);
            setMessageCount(incrementMessageCount());
        }

        setIsLoading(false);
    };

  return (
    <div className="flex flex-col h-full p-6 pt-0">
        <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Beta-Funktion</AlertTitle>
            <AlertDescription>
              Die Antworten der KI können ungenau oder falsch sein. Überprüfe wichtige Informationen immer.
            </AlertDescription>
        </Alert>
        <ScrollArea className="flex-1 my-4 p-4 border rounded-lg" ref={scrollAreaRef}>
            {chatHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mb-2" />
                    <p>Stell mir eine Frage!</p>
                     <p className="text-xs">z.B. "Was ist der Satz des Pythagoras?"</p>
                </div>
            )}
            {chatHistory.map((msg, index) => (
                <div key={index} className={`flex my-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-3 rounded-lg max-w-[80%] whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                        {msg.content[0].text}
                    </div>
                </div>
            ))}
            {isLoading && (
                 <div className="flex justify-start">
                     <div className="p-3 rounded-lg bg-secondary">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                </div>
            )}
        </ScrollArea>
        <form onSubmit={handleChatSubmit} className="flex gap-2">
            <Input 
                placeholder={messageCount >= DAILY_MESSAGE_LIMIT ? "Tageslimit erreicht" : "Stell eine Frage..."}
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                disabled={isLoading || messageCount >= DAILY_MESSAGE_LIMIT}
            />
            <Button type="submit" disabled={isLoading || !userInput.trim() || messageCount >= DAILY_MESSAGE_LIMIT}>
                 {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-2">
            {DAILY_MESSAGE_LIMIT - messageCount} / {DAILY_MESSAGE_LIMIT} Nachrichten für heute übrig.
        </p>
    </div>
  );
}
