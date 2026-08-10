
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore, initiateEmailSignUp } from '@/firebase';
import { Loader2, ArrowLeft, Mail, Lock, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { doc, writeBatch } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';

const registerSchema = z.object({
  displayName: z.string().min(2, { message: "Der Name muss mindestens 2 Zeichen lang sein." }),
  email: z.string().email({ message: "Bitte gib eine gültige E-Mail-Adresse ein." }),
  password: z.string().min(6, { message: "Das Passwort muss mindestens 6 Zeichen lang sein." }),
});

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (values: z.infer<typeof registerSchema>) => {
    if (!auth || !firestore) return;
    setIsLoading(true);

    try {
      const userCredential = await initiateEmailSignUp(auth, values.email, values.password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: values.displayName });

      // Migrate existing local data if present
      const timetable = JSON.parse(localStorage.getItem('timetable') || '{}');
      const timetableSettings = JSON.parse(localStorage.getItem('timetableSettings') || '{}');

      const batch = writeBatch(firestore);
      const userDocRef = doc(firestore, 'users', user.uid);
      
      batch.set(userDocRef, {
        displayName: values.displayName,
        email: values.email,
        timetable: Object.keys(timetable).length > 0 ? timetable : null,
        timetableSettings: Object.keys(timetableSettings).length > 0 ? timetableSettings : null,
        settings: {
            theme: localStorage.getItem('theme') || 'light',
            startView: localStorage.getItem('startView') || 'daily',
            aiLanguage: localStorage.getItem('aiLanguage') || 'German',
        },
        createdAt: new Date().toISOString(),
      }, { merge: true });

      await batch.commit();

      toast({ title: "Account erstellt!", description: "Dein Scoodol-Account ist jetzt bereit." });
      router.push('/');
    } catch (error: any) {
      let message = "Registrierung fehlgeschlagen.";
      if (error.code === 'auth/email-already-in-use') message = "Diese E-Mail wird bereits verwendet.";
      toast({ variant: "destructive", title: "Fehler", description: message });
      setIsLoading(false);
    }
  };

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  return (
    <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
      <Button variant="ghost" asChild className="mb-8 self-start md:self-center">
        <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Zurück</Link>
      </Button>

      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-black">Registrieren</CardTitle>
          <CardDescription>Erstelle einen Account, um deine Daten sicher zu speichern.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
               <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dein Anzeigename</FormLabel>
                    <FormControl>
                        <Input placeholder="Max Mustermann" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-Mail</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="deine@email.de" className="pl-10" {...field} disabled={isLoading} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passwort</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input type="password" placeholder="••••••" className="pl-10" {...field} disabled={isLoading} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : <><UserPlus className="mr-2" /> Account erstellen</>}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 text-center">
          <div className="text-sm text-muted-foreground">
            Du hast schon einen Account?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">Hier anmelden</Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
