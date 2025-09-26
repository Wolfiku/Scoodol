
"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, Send, Wand2, MessageSquare, BookOpen, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getTutorChatReply, getSimplifiedText } from '@/app/actions';
import { ScrollArea } from '@/components/ui/scroll-area';

type Message = {
    role: 'user' | 'model';
    content: { text: string }[];
};

const DAILY_MESSAGE_LIMIT = 5;

const getTodaysMessageCount = () => {
    const today = new Date().toISOString().split('T')[0];
    const data = JSON.parse(localStorage.getItem('aiTutorUsage') || '{}');
    if (data.date === today) {
        return data.count || 0;
    }
    return 0;
}

const incrementMessageCount = () => {
    const today = new Date().toISOString().split('T')[0];
    const count = getTodaysMessageCount() + 1;
    localStorage.setItem('aiTutorUsage', JSON.stringify({ date: today, count }));
    return count;
}


export default function AiTutor() {
    const [mode, setMode] = useState<'chat' | 'simplify'>('chat');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // Chat state
    const [chatHistory, setChatHistory] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState('');
    const [messageCount, setMessageCount] = useState(0);

    // Simplify state
    const [textToSimplify, setTextToSimplify] = useState('');
    const [simplifiedText, setSimplifiedText] = useState('');
    
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMessageCount(getTodaysMessageCount());
    }, []);
    
    useEffect(() => {
        if(scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
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

        const result = await getTutorChatReply(newHistory);
        
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

    const handleSimplify = async () => {
        const trimmedText = textToSimplify.trim();
        if (!trimmedText || isLoading) return;

        setIsLoading(true);
        setSimplifiedText('');
        const result = await getSimplifiedText(trimmedText);

        if (result.error || !result.simplifiedText) {
             toast({
                variant: 'destructive',
                title: 'Fehler',
                description: result.error || 'Text konnte nicht vereinfacht werden.',
            });
        } else {
            setSimplifiedText(result.simplifiedText);
        }

        setIsLoading(false);
    };


  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Tutor</CardTitle>
        <CardDescription>Nutze künstliche Intelligenz, um dir bei deinen Aufgaben zu helfen.</CardDescription>
        <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Beta-Funktion</AlertTitle>
            <AlertDescription>
              Dieses Tool ist experimentell. Die Antworten der KI können ungenau oder falsch sein. Überprüfe wichtige Informationen immer.
            </AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent>
          <div className="flex items-center space-x-2 mb-6 justify-center">
            <MessageSquare />
            <Label htmlFor="mode-switch">Chat</Label>
            <Switch
                id="mode-switch"
                checked={mode === 'simplify'}
                onCheckedChange={(checked) => setMode(checked ? 'simplify' : 'chat')}
            />
            <Label htmlFor="mode-switch">Text vereinfachen</Label>
            <BookOpen />
        </div>

        {mode === 'chat' && (
            <div className="flex flex-col h-[60vh]">
                <ScrollArea className="flex-1 space-y-4 p-4 border rounded-lg" ref={scrollAreaRef}>
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
                <form onSubmit={handleChatSubmit} className="mt-4 flex gap-2">
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
        )}

        {mode === 'simplify' && (
            <div className="space-y-4">
                <div>
                    <Label htmlFor="text-to-simplify">Originaltext</Label>
                    <Textarea 
                        id="text-to-simplify"
                        placeholder="Füge hier eine komplizierte Aufgabenstellung oder einen Text ein..."
                        value={textToSimplify}
                        onChange={e => setTextToSimplify(e.target.value)}
                        rows={6}
                    />
                </div>
                 <Button onClick={handleSimplify} disabled={isLoading || !textToSimplify.trim()}>
                    {isLoading ? <Loader2 className="animate-spin" /> : <Wand2 className="mr-2" />}
                    Jetzt vereinfachen
                </Button>
                {simplifiedText && (
                     <div>
                        <Label>Vereinfachte Version</Label>
                        <Card className="bg-secondary p-4">
                            <p className="whitespace-pre-wrap">{simplifiedText}</p>
                        </Card>
                    </div>
                )}
            </div>
        )}

      </CardContent>
    </Card>
  );
}
