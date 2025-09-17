
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PeriodicTableSearch() {
    const [query, setQuery] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Periodensystem-Suche</CardTitle>
        <CardDescription>Suche nach einem chemischen Element oder einer Verbindung (z.B. "H2O", "Eisen").</CardDescription>
      </CardHeader>
      <CardContent>
          <div className="flex gap-2">
            <Input 
                type="text"
                placeholder="Element oder Verbindung eingeben..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <Button disabled>Suchen</Button>
          </div>
          <div className="mt-6 p-4 bg-secondary rounded-lg text-center text-muted-foreground">
            <p>Die KI-gestützte Suche wird in Kürze verfügbar sein.</p>
        </div>
      </CardContent>
    </Card>
  );
}
