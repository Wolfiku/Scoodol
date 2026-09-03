
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, getDocs, collection, query, where, updateDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Search, User as UserIcon, Shield, Save, Key } from 'lucide-react';
import { sendPasswordResetEmailForUser } from '../actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

type UserProfile = {
  id: string;
  role?: string;
  email?: string;
  displayName?: string;
}

const searchSchema = z.object({
  email: z.string().email({ message: "Bitte gib eine gültige E-Mail-Adresse ein." }),
});

export default function AdminPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [foundUser, setFoundUser] = useState<UserProfile | null>(null);

    const userDocRef = useMemoFirebase(() => 
        user ? doc(firestore, 'users', user.uid) : null
    , [firestore, user]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<any>(userDocRef);

    const searchForm = useForm<z.infer<typeof searchSchema>>({
        resolver: zodResolver(searchSchema),
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

    const handleSearchUser = async (values: z.infer<typeof searchSchema>) => {
        if (!firestore) return;
        setIsSearching(true);
        setFoundUser(null);
        
        try {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where("email", "==", values.email));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ variant: 'destructive', title: 'Benutzer nicht gefunden', description: 'Kein Nutzer mit dieser E-Mail registriert.' });
            } else {
                const userDoc = querySnapshot.docs[0];
                setFoundUser({ id: userDoc.id, ...userDoc.data() } as UserProfile);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Fehler bei der Suche' });
        } finally {
            setIsSearching(false);
        }
    }

    const handleUpdateUser = async () => {
        if (!firestore || !foundUser) return;
        setIsSaving(true);
        try {
            const ref = doc(firestore, 'users', foundUser.id);
            await updateDoc(ref, {
                displayName: foundUser.displayName,
                role: foundUser.role,
            });
            toast({ title: 'Benutzer aktualisiert', description: 'Die Änderungen wurden gespeichert.' });
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Fehler beim Speichern' });
        } finally {
            setIsSaving(false);
        }
    }

    const handlePasswordReset = async () => {
        if (!foundUser?.email) return;
        setIsSaving(true);
        const result = await sendPasswordResetEmailForUser(foundUser.email);
        if (result.success) {
            toast({ title: 'E-Mail gesendet', description: 'Passwort-Reset wurde angestoßen.' });
        } else {
            toast({ variant: 'destructive', title: 'Fehler', description: result.error });
        }
        setIsSaving(false);
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
        <div className="container mx-auto p-4 md:p-8 max-w-5xl pb-24">
            <h1 className="text-4xl font-black mb-8 tracking-tight">Admin-Zentrale</h1>
            
            <div className="grid gap-8 lg:grid-cols-12">
                {/* Suche */}
                <Card className="lg:col-span-5 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="w-5 h-5 text-primary" />
                            Nutzer finden
                        </CardTitle>
                        <CardDescription>
                            Suche einen Benutzer anhand seiner E-Mail-Adresse, um ihn zu bearbeiten.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Form {...searchForm}>
                            <form onSubmit={searchForm.handleSubmit(handleSearchUser)} className="space-y-4">
                                 <FormField
                                    control={searchForm.control}
                                    name="email"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>E-Mail-Adresse</FormLabel>
                                        <FormControl>
                                            <Input placeholder="beispiel@email.de" {...field} disabled={isSearching} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full font-bold" disabled={isSearching}>
                                    {isSearching ? <Loader2 className="animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                                    Nutzer suchen
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                {/* Bearbeitungs-Bereich */}
                <div className="lg:col-span-7">
                    {foundUser ? (
                        <Card className="shadow-lg border-primary/20 animate-in fade-in slide-in-from-right-4 duration-300">
                            <CardHeader className="bg-primary/5">
                                <CardTitle className="flex items-center gap-3">
                                    <UserIcon className="w-6 h-6 text-primary" />
                                    Nutzer bearbeiten
                                </CardTitle>
                                <CardDescription>ID: {foundUser.id}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Anzeigename</Label>
                                        <Input 
                                            value={foundUser.displayName || ''} 
                                            onChange={e => setFoundUser({...foundUser, displayName: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Globale Rolle</Label>
                                        <Select 
                                            value={foundUser.role || 'user'} 
                                            onValueChange={v => setFoundUser({...foundUser, role: v})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="user">Standard-Nutzer</SelectItem>
                                                <SelectItem value="workspace_plus_user">Workspace+</SelectItem>
                                                <SelectItem value="admin">System-Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="p-3 bg-secondary/30 rounded-lg flex items-center justify-between">
                                        <div className="text-sm">
                                            <p className="font-bold">E-Mail</p>
                                            <p className="text-muted-foreground">{foundUser.email}</p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={handlePasswordReset} disabled={isSaving}>
                                            <Key className="w-3.5 h-3.5 mr-2" /> Reset-Mail
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-secondary/10 border-t flex justify-end p-4">
                                <Button onClick={handleUpdateUser} disabled={isSaving} className="font-bold">
                                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    Änderungen speichern
                                </Button>
                            </CardFooter>
                        </Card>
                    ) : (
                        <div className="h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl opacity-40 grayscale">
                             <UserIcon className="w-16 h-16 mb-4" />
                             <p className="font-medium">Wähle einen Nutzer aus der Suche.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
