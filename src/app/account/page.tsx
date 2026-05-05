
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { Loader2, ArrowLeft } from 'lucide-react';
import { updateProfile, updateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const accountSchema = z.object({
  displayName: z.string().min(2, { message: "Name muss mindestens 2 Zeichen lang sein." }).optional(),
  email: z.string().email({ message: "Ungültige E-Mail-Adresse." }),
});

export default function AccountPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isReauthDialogOpen, setIsReauthDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      displayName: "",
      email: "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName || "",
        email: user.email || "",
      });
    }
  }, [user, form]);

  const onSubmit = async (values: z.infer<typeof accountSchema>) => {
    if (!user || !auth || !firestore) return;
    setIsLoading(true);

    const promises = [];
    const { displayName, email } = values;

    if (displayName !== user.displayName) {
      promises.push(updateProfile(user, { displayName }));
      promises.push(updateDoc(doc(firestore, 'users', user.uid), { displayName }));
    }

    if (email !== user.email && email) {
        setNewEmail(email);
        setIsReauthDialogOpen(true);
        setIsLoading(false);
        return;
    }

    try {
      await Promise.all(promises);
      toast({
        title: "Gespeichert",
        description: "Deine Account-Informationen wurden aktualisiert.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleReauthenticate = async () => {
    if (!user || !user.email || !firestore) return;
    setIsLoading(true);

    try {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
        await updateEmail(user, newEmail);
        
        await updateDoc(doc(firestore, 'users', user.uid), { 'settings.email': newEmail });
        
        toast({
            title: "E-Mail aktualisiert!",
            description: "Deine E-Mail-Adresse wurde erfolgreich geändert."
        });

        setIsReauthDialogOpen(false);
        setNewEmail('');
        setPassword('');
        form.reset({ email: newEmail });

    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Authentifizierung fehlgeschlagen",
            description: "Das Passwort ist falsch oder ein anderer Fehler ist aufgetreten."
        });
    } finally {
        setIsLoading(false);
    }
  }

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.isAnonymous) {
      router.push('/login');
      return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl">
      <Dialog open={isReauthDialogOpen} onOpenChange={setIsReauthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bestätige deine Identität</DialogTitle>
            <DialogDescription>
              Um deine E-Mail-Adresse zu ändern, gib bitte dein aktuelles Passwort ein.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              type="password"
              placeholder="Dein aktuelles Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReauthDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleReauthenticate} disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : 'Bestätigen & Ändern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurück
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Account verwalten</CardTitle>
          <CardDescription>Ändere hier deinen Anzeigenamen und deine E-Mail-Adresse.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anzeigename</FormLabel>
                    <FormControl>
                      <Input placeholder="Dein Name" {...field} disabled={isLoading} />
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
                      <Input type="email" placeholder="deine@email.de" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : 'Änderungen speichern'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
