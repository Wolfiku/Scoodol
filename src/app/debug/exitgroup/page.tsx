
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

/**
 * Notfall-Seite zum Verlassen einer Gruppe.
 * Setzt die groupId im Nutzerprofil zurück, auch wenn das Gruppendokument nicht mehr existiert.
 */
export default function ExitGroupDebugPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleResetGroup = async () => {
    if (!user || !firestore) return;
    setIsProcessing(true);

    try {
      const userRef = doc(firestore, 'users', user.uid);
      
      // Wir setzen die groupId und die zugehörigen Einstellungen direkt im Nutzerdokument zurück
      await updateDoc(userRef, {
        groupId: null,
        groupSettings: {
          syncTimetable: false,
          showInGroup: false,
          shareHomework: false
        }
      });

      toast({ 
        title: 'Erfolg!', 
        description: 'Deine Gruppen-Verknüpfung wurde erfolgreich zurückgesetzt.' 
      });
      
      // Zurück zur Startseite
      router.push('/');
    } catch (e: any) {
      console.error(e);
      toast({ 
        variant: 'destructive', 
        title: 'Fehler', 
        description: 'Die Verknüpfung konnte nicht gelöscht werden: ' + e.message 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isUserLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="animate-spin text-primary w-12 h-12" />
        </div>
      );
  }

  if (!user || user.isAnonymous) {
      return (
        <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
            <p>Bitte melde dich zuerst an.</p>
            <Button onClick={() => router.push('/login')} className="mt-4">Zum Login</Button>
        </div>
      );
  }

  return (
    <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
      <Button variant="ghost" onClick={() => router.back()} className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
      </Button>

      <Card className="max-w-md w-full shadow-2xl border-t-4 border-t-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-black text-destructive">
            <AlertTriangle className="h-6 w-6" />
            Gruppe manuell verlassen
          </CardTitle>
          <CardDescription>
              Nutze dieses Tool nur, wenn du deine Gruppe über die normalen Einstellungen nicht verlassen kannst (z.B. weil die Gruppe gelöscht wurde).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-destructive/10 rounded-lg text-sm text-destructive border border-destructive/20">
            <p className="font-bold mb-1">Achtung:</p>
            <p>Diese Aktion entfernt die Gruppen-ID sofort aus deinem Profil. Dein persönlicher Stundenplan bleibt erhalten, wird aber nicht mehr synchronisiert.</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            variant="destructive"
            onClick={handleResetGroup} 
            disabled={isProcessing} 
            className="w-full h-12 font-bold text-lg gap-2"
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : <LogOut className="h-5 w-5" />}
            Verknüpfung jetzt lösen
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
