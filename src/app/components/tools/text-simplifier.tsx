
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSimplifiedText } from '@/app/actions';
import { useTheme } from '@/hooks/use-theme';

export default function TextSimplifier() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { aiLanguage } = useTheme();
    const [textToSimplify, setTextToSimplify] = useState('');
    const [simplifiedText, setSimplifiedText] = useState('');

    const handleSimplify = async () => {
        const trimmedText = textToSimplify.trim();
        if (!trimmedText || isLoading) return;

        setIsLoading(true);
        setSimplifiedText('');
        const result = await getSimplifiedText(trimmedText, aiLanguage);

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
        <CardTitle>Text-Vereinfacher</CardTitle>
        <CardDescription>Lässt komplizierte Texte oder Aufgabenstellungen von der KI umschreiben.</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
