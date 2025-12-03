
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';

type Group = {
  id: string;
  name: string;
  schoolName: string;
}

export default function JoinGroupPage() {
  const router = useRouter();
  const params = useParams();
  const { groupId } = params;
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isJoining, setIsJoining] = useState(false);

  const groupDocRef = useMemoFirebase(() => 
    typeof groupId === 'string' ? doc(firestore, 'groups', groupId) : null
  , [firestore, groupId]);

  const { data: group, isLoading: isLoadingGroup } = useDoc<Group>(groupDocRef);
  
  if (isUserLoading || isLoadingGroup) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary" /></div>;
  }
  
  if (!user) {
    // If not logged in, redirect to login but keep the group ID to return here after
    router.push(`/login?redirect=/groups/join/${groupId}`);
    return null;
  }

  if (user.isAnonymous) {
      toast({
          variant: 'destructive',
          title: 'Account erforderlich',
          description: 'Bitte melde dich an oder registriere dich, um einer Gruppe beizutreten.',
      });
      router.push('/login');
      return null;
  }

  const handleJoinGroup = async () => {
    if (!firestore || !user || typeof groupId !== 'string') return;
    setIsJoining(true);

    try {
        const groupRef = doc(firestore, 'groups', groupId);
        await updateDoc(groupRef, {
            members: arrayUnion(user.uid)
        });

        const userRef = doc(firestore, 'users', user.uid);
        await updateDoc(userRef, { 
            groupId: groupId,
            groupSettings: {
                syncTimetable: true,
                showInGroup: true,
                shareHomework: false,
            }
        });

        toast({ title: "Gruppe beigetreten!", description: `Willkommen in der Gruppe "${group?.name}"!` });
        router.push('/');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Fehler', description: 'Der Gruppe konnte nicht beigetreten werden.' });
        setIsJoining(false);
    }
  }

  if (!group) {
    return (
         <div className="container mx-auto p-4 md:p-8 max-w-lg text-center">
             <Card>
                 <CardHeader><CardTitle>Ungültiger Link</CardTitle></CardHeader>
                 <CardContent>
                     <p>Dieser Einladungslink ist ungültig oder die Gruppe existiert nicht mehr.</p>
                     <Button variant="ghost" onClick={() => router.push('/')} className="mt-4"><ArrowLeft className="mr-2"/>Zurück zur App</Button>
                 </CardContent>
             </Card>
         </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-lg">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Gruppe beitreten</CardTitle>
          <CardDescription>Möchtest du der folgenden Gruppe beitreten?</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-2">
            <p className="text-xl font-bold">{group.name}</p>
            <p className="text-muted-foreground">{group.schoolName}</p>
        </CardContent>
        <CardFooter className="flex-col gap-4">
            <Button className="w-full" onClick={handleJoinGroup} disabled={isJoining}>
                {isJoining ? <Loader2 className="animate-spin"/> : 'Ja, jetzt beitreten'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => router.push('/')}>
                Abbrechen
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
