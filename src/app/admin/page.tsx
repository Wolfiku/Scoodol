
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { sendPasswordResetEmailForUser } from '../actions';

type UserProfile = {
  role?: string;
}

const passwordResetSchema = z.object({
  email: z.string().email({ message: "Bitte gib eine gültige E-Mail-Adresse ein." }),
});


export default function AdminPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const userDocRef = useMemoFirebase(() => 
        user ? doc(firestore, 'users', user.uid) : null
    , [firestore, user]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    const form = useForm<z.infer<typeof passwordResetSchema>>({
        resolver: zodResolver(passwordResetSchema),
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
            form.reset();
        } else {
            toast({
                variant: 'destructive',
                title: 'Fehler',
                description: result.error,
            });
        }
        setIsLoading(false);
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
            <Card>
                <CardHeader>
                    <CardTitle>Benutzer verwalten</CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription className="mb-4">
                        Setze das Passwort für einen Benutzer zurück. Der Benutzer erhält eine E-Mail mit Anweisungen.
                    </CardDescription>
                     <Form {...form}>
                        <form onSubmit={form.handleSubmit(handlePasswordReset)} className="space-y-4 max-w-sm">
                             <FormField
                                control={form.control}
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
        </div>
    );
}
