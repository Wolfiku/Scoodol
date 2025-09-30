
"use client";

import { Construction, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function VokabelPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-screen text-center">
        <div className="absolute top-4 left-4">
             <Button variant="ghost" onClick={() => router.push('/')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zur Hauptseite
            </Button>
        </div>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-4 text-3xl">
            <Construction className="w-10 h-10 text-primary" />
            <span>Vokabeltrainer</span>
          </CardTitle>
          <CardDescription>Dieses Feature befindet sich noch im Aufbau.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Hier entsteht bald dein neuer interaktiver Vokabeltrainer. Schau bald wieder vorbei!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
