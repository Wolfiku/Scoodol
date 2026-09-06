"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Loader2, ArrowLeft, School, ShieldCheck, CheckCircle2, Copy, Info, Building2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

const schoolSchema = z.object({
  name: z.string().min(3, { message: "Der Name der Einrichtung muss mindestens 3 Zeichen lang sein." }),
  address: z.string().min(5, { message: "Bitte geben Sie eine vollständige Geschäftsadresse an." }),
  city: z.string().min(2, { message: "Bitte geben Sie den Standort an." }),
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
        
        const schoolData = {
            ...values,
            adminUid: user.uid,
            managementId,
            createdAt: serverTimestamp(),
        };
        const schoolRef = await addDoc(collection(firestore, 'schools'), schoolData);

        if (userDocRef) {
            await updateDoc(userDocRef, {
                role: 'school_admin',
                schoolId: schoolRef.id,
                managementId: managementId
            });
        }

        setRegisteredId(managementId);
        toast({
            title: "Registrierung erfolgreich",
            description: "Ihre Einrichtung wurde ordnungsgemäß im System hinterlegt.",
        });
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Systemfehler",
            description: "Die Registrierung konnte nicht abgeschlossen werden: " + error.message,
        });
    } finally {
        setIsLoading(false);
    }
  };

  const copyId = () => {
    if (registeredId) {
        navigator.clipboard.writeText(registeredId);
        toast({ title: "ID kopiert", description: "Die Verwaltungs-ID wurde für die Weitergabe gesichert." });
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50/50">
        <Loader2 className="animate-spin text-primary w-10 h-10" />
      </div>
    );
  }

  if (!user || user.isAnonymous) {
      return (
        <div className="container mx-auto p-4 md:p-8 max-w-lg min-h-screen flex flex-col justify-center">
            <Card className="shadow-2xl border-none ring-1 ring-black/5">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-primary/10 p-3 rounded-xl w-fit mb-4">
                        <ShieldAlert className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Autorisierung erforderlich</CardTitle>
                    <CardDescription>
                        Bitte melden Sie sich an, um den Registrierungsprozess für Ihre Einrichtung zu starten.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center">Administratoren benötigen ein verifiziertes Benutzerkonto, um rechtlich bindende Zuweisungen für Schulen vorzunehmen.</p>
                    <Button asChild className="w-full h-12 font-bold text-base rounded-xl">
                        <Link href="/login?redirect=/administration">Zum Login-Portal</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
      );
  }

  if (registeredId) {
      return (
        <div className="container mx-auto p-4 md:p-8 max-w-2xl min-h-screen flex flex-col justify-center">
            <Card className="shadow-2xl border-2 border-green-100 overflow-hidden rounded-3xl">
                <div className="bg-green-600 h-3 w-full" />
                <CardHeader className="text-center pt-10">
                    <div className="mx-auto bg-green-50 p-5 rounded-full w-fit mb-6">
                        <CheckCircle2 className="w-16 h-16 text-green-600" />
                    </div>
                    <CardTitle className="text-3xl font-black text-slate-900">Einrichtung aktiviert</CardTitle>
                    <CardDescription className="text-lg">Der administrative Zugang wurde erfolgreich konfiguriert.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-10 p-10">
                    <div className="p-8 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Offizielle Verwaltungs-ID</p>
                        <p className="text-5xl font-mono font-black text-primary tracking-tight">{registeredId}</p>
                        <div className="pt-2">
                            <Button onClick={copyId} variant="secondary" className="gap-2 rounded-xl h-12 px-6">
                                <Copy className="h-4 w-4" /> Kennung kopieren
                            </Button>
                        </div>
                    </div>
                    <div className="bg-blue-50/50 p-6 rounded-2xl flex gap-5 items-start border border-blue-100">
                        <ShieldCheck className="w-8 h-8 text-blue-600 shrink-0" />
                        <div className="text-sm space-y-2">
                            <p className="font-bold text-blue-900">Administrator-Status bestätigt</p>
                            <p className="text-blue-800/80 leading-relaxed">Sie verfügen nun über die Berechtigung, schulspezifische Parameter zu verwalten. Kommunizieren Sie die obige Kennung an Ihre Lehrkräfte und Schüler, um die digitale Vernetzung zu initiieren.</p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-slate-50 p-8">
                    <Button asChild className="w-full h-14 font-black text-lg rounded-2xl">
                        <Link href="/">Zentrale aufrufen</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
      );
  }

  if (userProfile?.role === 'school_admin') {
       return (
        <div className="container mx-auto p-4 md:p-8 max-w-2xl min-h-screen flex flex-col justify-center">
            <Card className="text-center p-10 rounded-3xl shadow-xl border-none ring-1 ring-black/5">
                 <CardHeader>
                    <div className="mx-auto bg-primary/10 p-4 rounded-2xl w-fit mb-6">
                        <Building2 className="w-12 h-12 text-primary" />
                    </div>
                    <CardTitle className="text-3xl font-black">Aktive Administration</CardTitle>
                    <CardDescription className="text-base">Ihr Profil ist bereits mit einer aktiven Einrichtung verknüpft.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full text-xs font-bold text-slate-600">
                        VERWALTUNGS-ID: <span className="font-mono text-primary">{userProfile.managementId}</span>
                    </div>
                    <Button asChild className="w-full font-black h-14 rounded-2xl text-lg">
                        <Link href="/">Zum Management-Dashboard</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
      );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl min-h-screen flex flex-col justify-center">
      <div className="flex items-center gap-4 mb-10">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full h-12 w-12 hover:bg-slate-100">
            <ArrowLeft className="h-6 w-6" />
        </Button>
        <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Einrichtungs-Management</h1>
            <p className="text-slate-500 font-medium">Registrierung und administrative Kontrolle</p>
        </div>
      </div>

      <Card className="shadow-2xl border-none rounded-3xl ring-1 ring-black/5 overflow-hidden">
          <div className="bg-primary h-2 w-full" />
          <CardHeader className="p-8 pb-4">
            <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                    <School className="w-8 h-8" />
                </div>
                <div>
                    <CardTitle className="text-2xl font-bold">Neue Registrierung</CardTitle>
                    <CardDescription className="text-sm">
                        Hinterlegen Sie Ihre Bildungseinrichtung im zentralen Scoodol-Verzeichnis.
                    </CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-0">
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="space-y-5">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold text-slate-700">Offizieller Name der Einrichtung</FormLabel>
                                <FormControl><Input placeholder="z. B. Gymnasium Musterstadt" className="h-12 rounded-xl border-slate-200 focus:ring-primary/20" {...field} disabled={isLoading} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold text-slate-700">Straße und Hausnummer</FormLabel>
                                <FormControl><Input placeholder="Akademiestraße 1" className="h-12 rounded-xl border-slate-200 focus:ring-primary/20" {...field} disabled={isLoading} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-3 gap-5">
                            <div className="col-span-1">
                                <FormField
                                    control={form.control}
                                    name="zip"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold text-slate-700">Postleitzahl</FormLabel>
                                        <FormControl><Input placeholder="12345" className="h-12 rounded-xl border-slate-200 focus:ring-primary/20" {...field} disabled={isLoading} /></FormControl>
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
                                        <FormLabel className="font-bold text-slate-700">Ort / Standort</FormLabel>
                                        <FormControl><Input placeholder="Musterstadt" className="h-12 rounded-xl border-slate-200 focus:ring-primary/20" {...field} disabled={isLoading} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-5 bg-amber-50/50 border border-amber-200 rounded-2xl flex items-start gap-4 shadow-sm shadow-amber-100">
                        <Info className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-900/80 space-y-1.5 leading-relaxed">
                            <p className="font-black text-amber-900 uppercase text-[10px] tracking-widest">Wichtiger Hinweis</p>
                            <p>Durch die Registrierung wird eine eindeutige Kennung erzeugt. Diese dient als autorisiertes Bindeglied zwischen Schüler-Konten und Ihrer Verwaltungsebene.</p>
                        </div>
                    </div>

                    <Button type="submit" disabled={isLoading} className="w-full h-16 text-lg font-black rounded-2xl shadow-xl shadow-primary/20 transition-transform active:scale-[0.98]">
                        {isLoading ? <Loader2 className="animate-spin mr-3 h-6 w-6" /> : 'Registrierung jetzt finalisieren'}
                    </Button>
                </form>
            </Form>
          </CardContent>
          <CardFooter className="justify-center bg-slate-50 border-t py-6 text-[10px] text-slate-400 uppercase font-black tracking-widest">
              Offizielle Bestätigung der Vertretungsbefugnis erforderlich
          </CardFooter>
        </Card>
    </div>
  );
}
