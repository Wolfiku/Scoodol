
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser, initiateEmailSignIn } from '@/firebase';
import { Loader2, ArrowLeft, Mail, Lock } from 'lucide-react';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email({ message: "Bitte gib eine gültige E-Mail-Adresse ein." }),
  password: z.string().min(6, { message: "Das Passwort muss mindestens 6 Zeichen lang sein." }),
});

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [isLoading, setIsLoading] = useState(false);

  const redirectPath = searchParams.get('redirect') || '/';

  useEffect(() => {
    // Forward to dashboard if already logged in with a permanent account
    if (!isUserLoading && user && !user.isAnonymous) {
      router.replace(redirectPath);
    }
  }, [user, isUserLoading, router, redirectPath]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    if (!auth) return;
    setIsLoading(true);

    try {
      await initiateEmailSignIn(auth, values.email, values.password);
      toast({ title: "Willkommen zurück!", description: "Du hast dich erfolgreich angemeldet." });
    } catch (error: any) {
      let message = "Anmeldung fehlgeschlagen. Bitte prüfe deine Daten.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "E-Mail oder Passwort ist falsch.";
      }
      toast({ variant: "destructive", title: "Fehler", description: message });
      setIsLoading(false);
    }
  };

  if (isUserLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="animate-spin text-primary w-12 h-12" />
        </div>
      );
  }

  return (
    <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
      <Button variant="ghost" asChild className="mb-8 self-start md:self-center">
        <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Startseite</Link>
      </Button>

      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-black">Anmelden</CardTitle>
          <CardDescription>Gib deine Daten ein, um auf deine Cloud-Inhalte zuzugreifen.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : "Jetzt anmelden"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 text-center">
          <div className="text-sm text-muted-foreground">
            Noch keinen Account?{" "}
            <Link href="/register" className="text-primary font-bold hover:underline">Jetzt registrieren</Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary" /></div>}>
            <LoginForm />
        </Suspense>
    );
}
