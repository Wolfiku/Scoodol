
"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

/**
 * Debug-Seite um Admin-Rechte anzufordern.
 * Funktioniert laut Security Rules nur, wenn der Nutzer das einzige Mitglied ist.
 */
export default function MakeMeAdminPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params?.groupId as string;
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isProcessing, setIsProcessing] = useState(false);

  const groupRef = useMemoFirebase(() => 
    typeof groupId === 'string' ? doc(firestore, 'groups', groupId) : null
  , [firestore, groupId]);

  const { data: group, isLoading: isLoadingGroup } = useDoc<any>(groupRef);

  const handleMakeAdmin = async () => {
    if (!user || !group || !groupRef) return;
    setIsProcessing(true);

    try {
      // Sicherheits-Check: Ist der Nutzer überhaupt in der Liste?
      if (!group.members?.includes(user.uid)) {
          toast({ variant: 'destructive', title: 'Fehler', description: 'Du bist kein Mitglied dieser Gruppe.' });
          setIsProcessing(false);
          return;
      }

      // Rollen-Update durchführen
      await updateDoc(groupRef, {
        [`roles.${user.uid}`]: 'admin'
      });

      toast({ title: 'Erfolg!', description: 'Du bist jetzt der Administrator dieser Gruppe.' });
      router.push(`/groups/${groupId}`);
    } catch (e: any) {
      console.error(e);
      toast({ 
        variant: 'destructive', 
        title: 'Zugriff verweigert', 
        description: 'Du kannst nur Admin werden, wenn du das einzige Mitglied bist oder bereits Admin-Rechte hast.' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isUserLoading || isLoadingGroup) {
      return (
        <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="animate-spin text-primary w-12 h-12" />
        </div>
      );
  }

  return (
    <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
      <Button variant="ghost" onClick={() => router.back()} className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
      </Button>

      <Card className="max-w-md w-full shadow-xl border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-black">
            <ShieldAlert className="text-primary h-6 w-6" />
            Admin Debug
          </CardTitle>
          <CardDescription>
              Nutze dieses Tool, um Admin-Rechte für die Gruppe <strong>"{group?.name}"</strong> zu erhalten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-secondary/50 rounded-lg text-sm">
            <p className="font-bold mb-2">Voraussetzungen:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Du musst bereits Mitglied der Gruppe sein.</li>
                <li>Du musst das **einzige Mitglied** sein (laut deiner Anforderung).</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground italic text-center">
              Hinweis: Dieses Tool dient zur Wiederherstellung des Zugriffs.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={handleMakeAdmin} disabled={isProcessing} className="w-full h-12 font-bold text-lg">
            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : 'Jetzt zum Admin machen'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
