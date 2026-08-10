"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Loader2, ArrowLeft, Lock, WifiOff, School, User as UserIcon, Mail, ShieldCheck } from 'lucide-react';
import { updateProfile, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

const accountSchema = z.object({
  displayName: z.string().min(2, { message: "Name muss mindestens 2 Zeichen lang sein." }).optional(),
  email: z.string().email({ message: "Ungültige E-Mail-Adresse." }),
  isOffline: z.boolean().default(false),
  managementId: z.string().optional(),
});

type UserProfile = {
    displayName?: string;
    settings?: {
        isOffline?: boolean;
        managementId?: string;
    }
}

export default function AccountPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isReauthDialogOpen, setIsReauthDialogOpen] = useState(false);
  const [reauthType, setReauthType] = useState<'email' | 'password'>('email');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const userDocRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      displayName: "",
      email: "",
      isOffline: false,
      managementId: "",
    },
  });

  useEffect(() => {
    if (user && userProfile) {
      form.reset({
        displayName: user.displayName || "",
        email: user.email || "",
        isOffline: userProfile.settings?.isOffline || false,
        managementId: userProfile.settings?.managementId || "",
      });
    }
  }, [user, userProfile, form]);

  const onSubmit = async (values: z.infer<typeof accountSchema>) => {
    if (!user || !firestore || !userDocRef) return;
    setIsLoading(true);

    const { displayName, email, isOffline, managementId } = values;

    // Handle profile and settings updates (Firestore)
    try {
        const updates: any = {
            displayName,
            'settings.isOffline': isOffline,
            'settings.managementId': managementId,
        };

        await updateDoc(userDocRef, updates);

        if (displayName !== user.displayName) {
            await updateProfile(user, { displayName });
        }

        // Email change requires re-auth
        if (email !== user.email && email) {
            setNewEmail(email);
            setReauthType('email');
            setIsReauthDialogOpen(true);
            setIsLoading(false);
            return;
        }

        toast({
            title: "Gespeichert",
            description: "Deine Informationen wurden aktualisiert.",
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
    if (!user || !user.email) return;
    setIsLoading(true);

    try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        
        if (reauthType === 'email') {
            await updateEmail(user, newEmail);
            await updateDoc(doc(firestore, 'users', user.uid), { email: newEmail });
            toast({ title: "E-Mail aktualisiert!" });
            form.setValue('email', newEmail);
        } else if (reauthType === 'password') {
            await updatePassword(user, newPassword);
            toast({ title: "Passwort geändert!", description: "Dein neues Passwort ist nun aktiv." });
            setNewPassword('');
            setConfirmPassword('');
        }

        setIsReauthDialogOpen(false);
        setCurrentPassword('');
        setNewEmail('');

    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Fehler",
            description: "Authentifizierung fehlgeschlagen oder Passwort zu schwach."
        });
    } finally {
        setIsLoading(false);
    }
  }

  const openPasswordChange = () => {
      if (newPassword !== confirmPassword) {
          toast({ variant: 'destructive', title: 'Passwort-Fehler', description: 'Die Passwörter stimmen nicht überein.' });
          return;
      }
      if (newPassword.length < 6) {
          toast({ variant: 'destructive', title: 'Sicherheit', description: 'Das Passwort muss mindestens 6 Zeichen lang sein.' });
          return;
      }
      setReauthType('password');
      setIsReauthDialogOpen(true);
  }

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary w-12 h-12" />
      </div>
    );
  }

  if (!user || user.isAnonymous) {
      router.push('/login');
      return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-3xl space-y-8 pb-20">
      <Dialog open={isReauthDialogOpen} onOpenChange={setIsReauthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bestätige deine Identität</DialogTitle>
            <DialogDescription>
              Um sensible Daten zu ändern, gib bitte dein **aktuelles Passwort** ein.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              type="password"
              placeholder="Dein aktuelles Passwort"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReauthDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleReauthenticate} disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : 'Bestätigen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-black">Account verwalten</h1>
      </div>

      <div className="grid gap-6">
        <Card className="border-t-4 border-t-primary">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5 text-primary" />
                    Profil-Details
                </CardTitle>
                <CardDescription>Aktualisiere deinen Namen und deine E-Mail-Adresse.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
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
                        </div>

                        <Separator />

                        <div className="space-y-6">
                            <FormField
                                control={form.control}
                                name="isOffline"
                                render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-secondary/20">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base flex items-center gap-2">
                                            <WifiOff className="h-4 w-4" /> Offline-Modus
                                        </FormLabel>
                                        <FormDescription>
                                            Dein Konto wird auf „Offline“ gestellt (betrifft aktuell noch keine Dokumente).
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="managementId"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <School className="h-4 w-4" /> Verwaltungs-ID / Schul-ID
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="ID eingeben..." {...field} disabled={isLoading} />
                                    </FormControl>
                                    <FormDescription>
                                        Verknüpfe dein Konto mit einer Bildungseinrichtung.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>

                        <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isLoading}>
                            {isLoading ? <Loader2 className="animate-spin mr-2" /> : 'Änderungen speichern'}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    Sicherheit
                </CardTitle>
                <CardDescription>Ändere hier dein Passwort für den Zugang zu Scoodol.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <FormLabel>Neues Passwort</FormLabel>
                        <Input 
                            type="password" 
                            placeholder="••••••" 
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <FormLabel>Passwort bestätigen</FormLabel>
                        <Input 
                            type="password" 
                            placeholder="••••••" 
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                        />
                    </div>
                </div>
                <Button variant="secondary" className="w-full" onClick={openPasswordChange} disabled={isLoading || !newPassword}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Passwort jetzt ändern
                </Button>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
