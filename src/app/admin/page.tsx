
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useForm as useRoleForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, getDocs, collection, query, where, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { sendPasswordResetEmailForUser } from '../actions';
import { Separator } from '@/components/ui/separator';

type UserProfile = {
  role?: string;
  email?: string;
}

const passwordResetSchema = z.object({
  email: z.string().email({ message: "Bitte gib eine gültige E-Mail-Adresse ein." }),
});

const roleManagementSchema = z.object({
    email: z.string().email({ message: "Bitte gib eine gültige E-Mail-Adresse ein." }),
});


export default function AdminPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isRoleLoading, setIsRoleLoading] = useState(false);

    const userDocRef = useMemoFirebase(() => 
        user ? doc(firestore, 'users', user.uid) : null
    , [firestore, user]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    const passwordForm = useForm<z.infer<typeof passwordResetSchema>>({
        resolver: zodResolver(passwordResetSchema),
        defaultValues: { email: "" },
    });
    
    const roleForm = useForm<z.infer<typeof roleManagementSchema>>({
        resolver: zodResolver(roleManagementSchema),
        defaultValues: { email: "" },
    });
    
    useEffect(() => {
        if (!isUserLoading && !isProfileLoading) {
            if (!user || user.isAnonymous || userProfile?.role !== 'admin') {
                toast({
                    variant: 'destructive',
                    title: 'Zugriff verweigert',
                    description: 'Du hast keine Berechtigung, auf diese Seite zuzugreifen.',
                });
                router.push('/');
            }
        }
    }, [user, isUserLoading, userProfile, isProfileLoading, router, toast]);

    const handlePasswordReset = async (values: z.infer<typeof passwordResetSchema>) => {
        setIsLoading(true);
        const result = await sendPasswordResetEmailForUser(values.email);
        if (result.success) {
            toast({
                title: 'E-Mail gesendet',
                description: `Eine E-Mail zum Zurücksetzen des Passworts wurde an ${values.email} gesendet.`,
            });
            passwordForm.reset();
        } else {
            toast({
                variant: 'destructive',
                title: 'Fehler',
                description: result.error,
            });
        }
        setIsLoading(false);
    }
    
    const handleRoleUpdate = async (values: z.infer<typeof roleManagementSchema>, action: 'grant' | 'revoke') => {
        if (!firestore) return;
        setIsRoleLoading(true);
        try {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where("settings.email", "==", values.email));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ variant: 'destructive', title: 'Benutzer nicht gefunden' });
                setIsRoleLoading(false);
                return;
            }
            
            const batch = writeBatch(firestore);
            querySnapshot.forEach(userDoc => {
                const newRole = action === 'grant' ? 'workspace_plus_user' : 'user';
                batch.update(userDoc.ref, { role: newRole });
            });
            await batch.commit();
            
            toast({
                title: 'Zugriff aktualisiert!',
                description: `Der Nutzer ${values.email} hat jetzt die Rolle: ${action === 'grant' ? 'Workspace+' : 'Standard'}`,
            });
            roleForm.reset();

        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Fehler',
                description: "Die Rolle konnte nicht aktualisiert werden."
            });
        }
        setIsRoleLoading(false);
    }

    if (isUserLoading || isProfileLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-primary" />
            </div>
        );
    }

    if (userProfile?.role !== 'admin') {
        return null;
    }

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Admin-Dashboard</h1>
            <div className="grid gap-8 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Passwort zurücksetzen</CardTitle>
                        <CardDescription>
                            Sende eine E-Mail zum Zurücksetzen des Passworts an einen Benutzer.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Form {...passwordForm}>
                            <form onSubmit={passwordForm.handleSubmit(handlePasswordReset)} className="space-y-4">
                                 <FormField
                                    control={passwordForm.control}
                                    name="email"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>E-Mail des Benutzers</FormLabel>
                                        <FormControl>
                                        <Input placeholder="user@example.com" {...field} disabled={isLoading} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="animate-spin" /> : 'Passwort-Reset senden'}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Workspace+ Zugriff verwalten</CardTitle>
                        <CardDescription>
                            Gib Nutzern erweiterten Zugriff auf KI-Funktionen.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Form {...roleForm}>
                            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                                 <FormField
                                    control={roleForm.control}
                                    name="email"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>E-Mail des Benutzers</FormLabel>
                                        <FormControl>
                                        <Input placeholder="user@example.com" {...field} disabled={isRoleLoading} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <div className="flex gap-2">
                                     <Button onClick={roleForm.handleSubmit(v => handleRoleUpdate(v, 'grant'))} disabled={isRoleLoading}>
                                        {isRoleLoading ? <Loader2 className="animate-spin" /> : 'Zugriff gewähren'}
                                    </Button>
                                    <Button variant="destructive" onClick={roleForm.handleSubmit(v => handleRoleUpdate(v, 'revoke'))} disabled={isRoleLoading}>
                                        {isRoleLoading ? <Loader2 className="animate-spin" /> : 'Zugriff entziehen'}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
