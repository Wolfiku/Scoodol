
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { searchElement } from '@/app/actions';
import type { FindElementOutput } from '@/ai/flows/find-element';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

export default function PeriodicTableSearch() {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<FindElementOutput | null>(null);
    const { toast } = useToast();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            toast({
                variant: 'destructive',
                title: 'Offline',
                description: 'Diese Funktion benötigt eine Internetverbindung.',
            });
            return;
        }

        setIsLoading(true);
        setResult(null);
        const searchResult = await searchElement(query);
        setResult(searchResult);
        setIsLoading(false);
    }

    const renderProperty = (label: string, value?: string) => {
        if (!value) return null;
        return (
            <div className="flex justify-between text-sm py-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
            </div>
        )
    }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Periodensystem-Suche</CardTitle>
        <CardDescription>Suche nach einem chemischen Element oder einer Verbindung (z.B. "H2O", "Eisen").</CardDescription>
      </CardHeader>
      <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input 
                type="text"
                placeholder="Element oder Verbindung eingeben..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : 'Suchen'}
            </Button>
          </form>

            {isLoading && (
                <div className="mt-6 p-4 bg-secondary rounded-lg text-center text-muted-foreground flex justify-center items-center">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <p className="ml-3">KI durchsucht das Periodensystem...</p>
                </div>
            )}
            
            {result && (
                 <div className="mt-6">
                    {result.element && (
                        <Card className="bg-secondary">
                            <CardHeader>
                                <CardTitle className="flex justify-between items-baseline">
                                    <span>{result.element.name} ({result.element.symbol})</span>
                                    <span className="text-sm font-normal text-muted-foreground">Ordnungszahl: {result.element.atomicNumber}</span>
                                </CardTitle>
                                <CardDescription>Atommasse: {result.element.atomicMass}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="mb-4">{result.element.description}</p>
                                <Separator className="my-2" />
                                {renderProperty("Schmelzpunkt", result.element.meltingPoint)}
                                <Separator className="my-0 h-[0.5px]" />
                                {renderProperty("Siedepunkt", result.element.boilingPoint)}
                                <Separator className="my-0 h-[0.5px]" />
                                {renderProperty("Dichte", result.element.density)}
                            </CardContent>
                        </Card>
                    )}
                    {result.compound && (
                        <Card className="bg-secondary">
                             <CardHeader>
                                <CardTitle className="flex justify-between items-baseline">
                                    <span>{result.compound.name}</span>
                                    <span className="text-lg font-mono">{result.compound.formula}</span>
                                </CardTitle>
                                <CardDescription>Molare Masse: {result.compound.molarMass}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="mb-4">{result.compound.description}</p>
                                <Separator className="my-2" />
                                {renderProperty("Schmelzpunkt", result.compound.meltingPoint)}
                                 <Separator className="my-0 h-[0.5px]" />
                                {renderProperty("Siedepunkt", result.compound.boilingPoint)}
                                 <Separator className="my-0 h-[0.5px]" />
                                {renderProperty("Dichte", result.compound.density)}
                            </CardContent>
                        </Card>
                    )}
                    {result.error && <p className="text-destructive text-center p-4">{result.error}</p>}
                    {!result.element && !result.compound && !result.error && (
                        <p className="text-muted-foreground text-center p-4">Die KI konnte leider keine passenden Informationen finden.</p>
                    )}
                </div>
            )}
      </CardContent>
    </Card>
  );
}

    