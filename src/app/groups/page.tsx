
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, ArrowLeft, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const groupSchema = z.object({
  name: z.string().min(3, { message: "Name muss mindestens 3 Zeichen lang sein." }),
  schoolName: z.string().min(3, { message: "Schulname muss mindestens 3 Zeichen lang sein." }),
  motto: z.string().optional(),
});

type Group = {
  id: string;
  name: string;
  schoolName: string;
  motto?: string;
  admin: string;
}

export default function GroupsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isJoining, setIsJoining] = useState<string | null>(null);

  const groupsRef = useMemoFirebase(() => collection(firestore, 'groups'), [firestore]);
  const { data: groups, isLoading: isLoadingGroups } = useCollection<Group>(groupsRef);

  const form = useForm<z.infer<typeof groupSchema>>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: "", schoolName: "", motto: "" },
  });
  
  if (isUserLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary" /></div>;
  }
  
  if (!user || user.isAnonymous) {
    router.push('/login');
    return null;
  }

  const handleCreateGroup = async (values: z.infer<typeof groupSchema>) => {
    if (!firestore || !user) return;
    setIsLoading(true);

    try {
        const timetable = JSON.parse(localStorage.getItem('timetable') || '{}');
        const timetableSettings = JSON.parse(localStorage.getItem('timetableSettings') || '{}');

        const newGroup = {
            ...values,
            admin: user.uid,
            members: [user.uid],
            timetable,
            timetableSettings
        };

        const groupDocRef = await addDoc(collection(firestore, 'groups'), newGroup);
        const userDocRef = doc(firestore, 'users', user.uid);
        await updateDoc(userDocRef, { 
            groupId: groupDocRef.id,
            groupSettings: {
                syncTimetable: true,
                showInGroup: true,
                shareHomework: false,
            }
        });

        toast({ title: "Gruppe erstellt!", description: "Du bist jetzt der Admin deiner neuen Gruppe." });
        router.push('/');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Fehler', description: 'Die Gruppe konnte nicht erstellt werden.' });
    }
    setIsLoading(false);
  }

  const handleJoinGroup = async (groupId: string) => {
    if (!firestore || !user) return;
    setIsJoining(groupId);

    try {
        const groupDocRef = doc(firestore, 'groups', groupId);
        await updateDoc(groupDocRef, {
            members: arrayUnion(user.uid)
        });

        const userDocRef = doc(firestore, 'users', user.uid);
        await updateDoc(userDocRef, { groupId });

        toast({ title: "Gruppe beigetreten!", description: "Willkommen in der Gruppe!" });
        router.push('/');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Fehler', description: 'Der Gruppe konnte nicht beigetreten werden.' });
    }

    setIsJoining(null);
  }

  const filteredGroups = groups?.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.schoolName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurück zu den Einstellungen
      </Button>
      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gruppe beitreten</CardTitle>
            <CardDescription>Finde eine Gruppe über den Namen oder die Schule.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input 
                placeholder="Suchen..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="mb-4"
            />
            <ScrollArea className="h-72">
                <div className="space-y-2">
                    {isLoadingGroups ? <Loader2 className="animate-spin" /> :
                     filteredGroups && filteredGroups.length > 0 ? filteredGroups.map(group => (
                        <div key={group.id} className="p-3 bg-secondary rounded-md flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{group.name}</p>
                                <p className="text-sm text-muted-foreground">{group.schoolName}</p>
                            </div>
                            <Button size="sm" onClick={() => handleJoinGroup(group.id)} disabled={isJoining === group.id}>
                                {isJoining === group.id ? <Loader2 className="animate-spin w-4 h-4" /> : 'Beitreten'}
                            </Button>
                        </div>
                     )) : <p className="text-center text-muted-foreground p-4">Keine Gruppen gefunden.</p>
                    }
                </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Neue Gruppe erstellen</CardTitle>
            <CardDescription>
              Erstelle deine eigene Klasse oder Gruppe und werde zum Admin. Dein aktueller Stundenplan wird als Vorlage für die Gruppe verwendet.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateGroup)} className="space-y-4">
                     <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Gruppen-/Klassenname</FormLabel>
                            <FormControl><Input placeholder="z.B. 10b" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="schoolName"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name der Schule</FormLabel>
                            <FormControl><Input placeholder="z.B. Muster-Gymnasium" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="motto"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Motto (optional)</FormLabel>
                            <FormControl><Input placeholder="z.B. Per aspera ad astra" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Plus className="mr-2" />}
                        Gruppe erstellen
                    </Button>
                </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
