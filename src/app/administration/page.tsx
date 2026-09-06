
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Loader2, ArrowLeft, School, ShieldCheck, CheckCircle2, Copy, Info } from 'lucide-react';
import Link from 'next/link';

const schoolSchema = z.object({
  name: z.string().min(3, { message: "Der Schulname muss mindestens 3 Zeichen lang sein." }),
  address: z.string().min(5, { message: "Bitte gib eine vollständige Adresse an." }),
  city: z.string().min(2, { message: "Bitte gib die Stadt an." }),
  zip: z.string().min(5, { message: "Ungültige Postleitzahl." }),
});

export default function AdministrationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [registeredId, setRegisteredId] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(() => 
    user ? doc(firestore, 'users', user.uid) : null
  , [firestore, user]);
  const { data: userProfile } = useDoc<any>(userDocRef);

  const form = useForm<z.infer<typeof schoolSchema>>({
    resolver: zodResolver(schoolSchema),
    defaultValues: { name: "", address: "", city: "", zip: "" },
  });

  const generateManagementId = () => {
    return 'SCOO-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  };

  const onSubmit = async (values: z.infer<typeof schoolSchema>) => {
    if (!firestore || !user) return;
    setIsLoading(true);

    try {
        const managementId = generateManagementId();
        
        // 1. Create School Document
        const schoolData = {
            ...values,
            adminUid: user.uid,
            managementId,
            createdAt: serverTimestamp(),
        };
        const schoolRef = await addDoc(collection(firestore, 'schools'), schoolData);

        // 2. Promote User to school_admin
        if (userDocRef) {
            await updateDoc(userDocRef, {
                role: 'school_admin',
                schoolId: schoolRef.id,
                managementId: managementId // Automatically link the admin to their school
            });
        }

        setRegisteredId(managementId);
        toast({
            title: "Schule erfolgreich registriert!",
            description: "Dein Account wurde zum Schul-Administrator hochgestuft.",
        });
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Fehler",
            description: "Die Registrierung ist fehlgeschlagen: " + error.message,
        });
    } finally {
        setIsLoading(false);
    }
  };

  const copyId = () => {
    if (registeredId) {
        navigator.clipboard.writeText(registeredId);
        toast({ title: "Kopiert!", description: "Die Verwaltungs-ID wurde in die Zwischenablage kopiert." });
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary w-12 h-12" />
      </div>
    );
  }

  if (!user || user.isAnonymous) {
      return (
        <div className="container mx-auto p-4 md:p-8 max-w-lg min-h-screen flex flex-col justify-center">
            <Card className="text-center p-6 border-t-4 border-t-primary">
                <CardHeader>
                    <CardTitle className="text-2xl font-black">Administrator-Login erforderlich</CardTitle>
                    <CardDescription>
                        Um eine Schule zu registrieren oder zu verwalten, musst du angemeldet sein.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">Erstelle zuerst ein Standard-Konto oder melde dich an. Nach der Schulregistrierung wirst du automatisch zum Administrator ernannt.</p>
                    <Button asChild className="w-full h-12 font-bold text-lg">
                        <Link href="/login?redirect=/administration">Jetzt anmelden</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
      );
  }

  if (registeredId) {
      return (
        <div className="container mx-auto p-4 md:p-8 max-w-2xl min-h-screen flex flex-col justify-center">
            <Card className="shadow-2xl border-2 border-green-100 overflow-hidden">
                <div className="bg-green-500 h-2 w-full" />
                <CardHeader className="text-center pt-8">
                    <div className="mx-auto bg-green-100 p-4 rounded-full w-fit mb-4">
                        <CheckCircle2 className="w-12 h-12 text-green-600" />
                    </div>
                    <CardTitle className="text-3xl font-black">Registrierung abgeschlossen!</CardTitle>
                    <CardDescription className="text-lg">Deine Schule ist nun Teil des Scoodol-Netzwerks.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 p-8">
                    <div className="p-6 bg-secondary/50 rounded-2xl border-2 border-dashed text-center space-y-3">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Deine neue Verwaltungs-ID</p>
                        <p className="text-4xl font-mono font-black text-primary">{registeredId}</p>
                        <Button onClick={copyId} variant="outline" className="gap-2">
                            <Copy className="h-4 w-4" /> ID kopieren
                        </Button>
                    </div>
                    <div className="bg-primary/5 p-4 rounded-xl flex gap-4 items-start">
                        <ShieldCheck className="w-6 h-6 text-primary shrink-0" />
                        <div className="text-sm space-y-1">
                            <p className="font-bold text-primary">Administrator-Status aktiv</p>
                            <p className="text-muted-foreground">Du kannst nun die Einstellungen deiner Schule verwalten. Gib die oben stehende ID an deine Schüler weiter, damit diese ihre Accounts verknüpfen können.</p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-secondary/20 p-6">
                    <Button asChild className="w-full h-14 font-black text-xl rounded-xl">
                        <Link href="/">Zum Dashboard</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
      );
  }

  if (userProfile?.role === 'school_admin') {
       return (
        <div className="container mx-auto p-4 md:p-8 max-w-2xl min-h-screen flex flex-col justify-center">
            <Card className="text-center p-8">
                 <CardHeader>
                    <CardTitle className="text-2xl font-black">Du bist bereits Administrator</CardTitle>
                    <CardDescription>Deine Schule ist bereits registriert.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-muted-foreground">Deine Verwaltungs-ID: <span className="font-mono font-bold text-primary">{userProfile.managementId}</span></p>
                    <Button asChild className="w-full font-bold h-12">
                        <Link href="/">Zurück zum Dashboard</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
      );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl min-h-screen flex flex-col justify-center">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-4xl font-black tracking-tight">Schul-Zentrale</h1>
      </div>

      <Card className="shadow-xl border-t-4 border-t-primary">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <School className="w-6 h-6" />
                </div>
                <CardTitle className="text-2xl">Einrichtung registrieren</CardTitle>
            </div>
            <CardDescription>
              Registriere deine Schule als Administrator, um exklusive Funktionen freizuschalten und die Verwaltung zu digitalisieren.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Offizieller Schulname</FormLabel>
                                <FormControl><Input placeholder="z.B. Albert-Einstein-Gymnasium" {...field} disabled={isLoading} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Straße & Hausnummer</FormLabel>
                                <FormControl><Input placeholder="Schulstraße 12" {...field} disabled={isLoading} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-1">
                                <FormField
                                    control={form.control}
                                    name="zip"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>PLZ</FormLabel>
                                        <FormControl><Input placeholder="12345" {...field} disabled={isLoading} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>
                            <div className="col-span-2">
                                <FormField
                                    control={form.control}
                                    name="city"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Stadt</FormLabel>
                                        <FormControl><Input placeholder="Musterstadt" {...field} disabled={isLoading} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-4">
                        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800 space-y-1">
                            <p className="font-bold">Hinweis zur Registrierung</p>
                            <p>Nach der Registrierung wird eine eindeutige Verwaltungs-ID generiert. Diese dient zur offiziellen Kopplung von Schüler-Accounts mit Ihrer Einrichtung.</p>
                        </div>
                    </div>

                    <Button type="submit" disabled={isLoading} className="w-full h-14 text-xl font-black rounded-xl shadow-lg shadow-primary/20">
                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : 'Schule jetzt registrieren'}
                    </Button>
                </form>
            </Form>
          </CardContent>
          <CardFooter className="justify-center border-t py-4 text-xs text-muted-foreground italic">
              Mit der Registrierung bestätigen Sie Ihre Vertretungsberechtigung.
          </CardFooter>
        </Card>
    </div>
  );
}
