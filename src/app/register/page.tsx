
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, writeBatch } from 'firebase/firestore';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

const registerSchema = z.object({
  email: z.string().email({ message: "Ungültige E-Mail-Adresse." }),
  password: z.string().min(6, { message: "Passwort muss mindestens 6 Zeichen lang sein." }),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwörter stimmen nicht überein.",
  path: ["confirmPassword"],
});

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof registerSchema>) => {
    if (!auth || !firestore) return;
    setIsLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      toast({
        title: "Account wird erstellt...",
        description: "Einen Moment, deine Daten werden übertragen.",
      });

      // Migrate data from localStorage
      const timetable = localStorage.getItem('timetable');
      const timetableSettings = localStorage.getItem('timetableSettings');
      const homeworks = localStorage.getItem('homeworks');
      const theme = localStorage.getItem('theme');
      const startView = localStorage.getItem('startView');
      const aiLanguage = localStorage.getItem('aiLanguage');
      const betaFeaturesEnabled = localStorage.getItem('betaFeaturesEnabled') === 'true';
      const profilePicture = localStorage.getItem('profilePicture');

      const batch = writeBatch(firestore);

      const userDocRef = doc(firestore, 'users', user.uid);
      
      const userData = {
          role: 'user', // Set default role
          shareId: user.uid, // Set shareId
          settings: {
              email: user.email, // Save email in settings for easier querying
              theme: theme || 'light',
              startView: startView || 'daily',
              aiLanguage: aiLanguage || 'German',
              betaFeaturesEnabled: betaFeaturesEnabled || false,
              profilePicture: profilePicture || null,
          },
          timetable: timetable ? JSON.parse(timetable) : {},
          timetableSettings: timetableSettings ? JSON.parse(timetableSettings) : {},
          chatIds: [], // Initialize with empty chatIds
      };

      batch.set(userDocRef, userData);

      if (homeworks) {
          const parsedHomeworks = JSON.parse(homeworks);
          const homeworksColRef = collection(firestore, 'users', user.uid, 'homeworks');
          parsedHomeworks.forEach((hw: any) => {
              const newHwRef = doc(homeworksColRef);
              // remove id from old data if it exists
              const { id, ...rest } = hw; 
              batch.set(newHwRef, rest);
          });
      }

      await batch.commit();

      // Clear local storage after successful migration
      localStorage.removeItem('timetable');
      localStorage.removeItem('timetableSettings');
      localStorage.removeItem('homeworks');
      localStorage.removeItem('isSetupComplete');
      // Keep theme settings for a smoother visual transition
      // localStorage.removeItem('theme'); 
      // localStorage.removeItem('startView');
      // localStorage.removeItem('aiLanguage');
      // localStorage.removeItem('betaFeaturesEnabled');
      // localStorage.removeItem('profilePicture');

      toast({
        title: "Registrierung erfolgreich!",
        description: "Dein Account wurde erstellt und deine Daten wurden übernommen.",
      });
      
      // Redirect to home, which will now show the authenticated state
      router.push('/');

    } catch (error: any) {
       let description = "Ein unbekannter Fehler ist aufgetreten.";
       if (error.code === 'auth/email-already-in-use') {
           description = "Diese E-Mail-Adresse wird bereits verwendet.";
       }
      toast({
        variant: "destructive",
        title: "Registrierung fehlgeschlagen",
        description,
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Account erstellen</CardTitle>
          <CardDescription>Erstelle einen neuen Scoodol Account, um deine Daten zu sichern.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-Mail</FormLabel>
                    <FormControl>
                      <Input placeholder="deine@email.de" {...field} disabled={isLoading}/>
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
                      <Input type="password" placeholder="******" {...field} disabled={isLoading}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passwort bestätigen</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="******" {...field} disabled={isLoading}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : 'Registrieren & Daten übertragen'}
              </Button>
            </form>
          </Form>
           <div className="mt-4 text-center text-sm">
            Schon einen Account?{" "}
             <Button variant="link" asChild className="p-0 h-auto">
                <Link href="/login">Hier anmelden</Link>
            </Button>
          </div>
           <div className="mt-6 text-center">
             <Button variant="ghost" asChild>
                <Link href="/">Zurück zur App</Link>
            </Button>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}

    
