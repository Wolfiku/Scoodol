
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, ArrowLeft, Plus } from 'lucide-react';

const groupSchema = z.object({
  name: z.string().min(3, { message: "Name muss mindestens 3 Zeichen lang sein." }),
  schoolName: z.string().min(3, { message: "Schulname muss mindestens 3 Zeichen lang sein." }),
  motto: z.string().optional(),
});

export default function GroupsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);

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
            roles: {
              [user.uid]: 'admin'
            },
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
        router.push(`/groups/${groupDocRef.id}`);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Fehler', description: 'Die Gruppe konnte nicht erstellt werden.' });
        setIsLoading(false);
    }
  }


  return (
    <div className="container mx-auto p-4 md:p-8 max-w-lg">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurück zu den Einstellungen
      </Button>
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
                    <Button type="submit" disabled={isLoading} className="w-full">
                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Plus className="mr-2" />}
                        Gruppe erstellen & Einladungslink erhalten
                    </Button>
                </form>
            </Form>
          </CardContent>
        </Card>
    </div>
  );
}
