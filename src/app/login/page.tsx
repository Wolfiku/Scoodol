
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useUser, initiateEmailSignIn } from '@/firebase';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email({ message: "Ungültige E-Mail-Adresse." }),
  password: z.string().min(1, { message: "Passwort wird benötigt." }),
});

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  const redirectPath = searchParams.get('redirect') || '/';

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    if (!auth) return;
    setIsLoading(true);
    try {
      await initiateEmailSignIn(auth, values.email, values.password);
      toast({ title: "Anmeldung erfolgreich", description: "Willkommen zurück!" });
      // The redirect is handled by the useEffect below once auth state updates
    } catch (error: any) {
       console.error("Login error:", error);
       let message = "E-Mail oder Passwort ist falsch.";
       if (error.code === 'auth/user-not-found') message = "Account nicht gefunden.";
       if (error.code === 'auth/wrong-password') message = "Falsches Passwort.";
       if (error.code === 'auth/invalid-credential') message = "Ungültige Anmeldedaten.";
       
       toast({ variant: "destructive", title: "Login fehlgeschlagen", description: message });
       setIsLoading(false);
    }
  };
  
  useEffect(() => {
    // Navigate ONLY if we are logged in with a real account and everything is loaded
    if (!isUserLoading && user && !user.isAnonymous) {
      router.replace(redirectPath);
    }
  }, [user, isUserLoading, router, redirectPath]);

  return (
    <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary">
      <CardHeader>
        <CardTitle className="text-2xl font-black">Willkommen zurück!</CardTitle>
        <CardDescription>Melde dich bei deinem Scoodol Account an.</CardDescription>
      </CardHeader>
      <CardContent>
        {isUserLoading && !user ? (
            <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="animate-spin text-primary h-8 w-8" />
                <p className="text-sm text-muted-foreground">Status wird geprüft...</p>
            </div>
        ) : (
            <>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-Mail</FormLabel>
                          <FormControl>
                            <Input placeholder="deine@email.de" {...field} disabled={isLoading} />
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
                            <Input type="password" placeholder="******" {...field} disabled={isLoading} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isLoading}>
                      {isLoading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : 'Anmelden'}
                    </Button>
                  </form>
                </Form>
                <div className="mt-6 text-center text-sm">
                  Noch keinen Account?{" "}
                  <Button variant="link" asChild className="p-0 h-auto font-bold">
                      <Link href={`/register${redirectPath !== '/' ? `?redirect=${encodeURIComponent(redirectPath)}` : ''}`}>Jetzt registrieren</Link>
                  </Button>
                </div>
                 <div className="mt-8 text-center">
                   <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
                      <Link href="/">Abbrechen & Zurück</Link>
                  </Button>
                 </div>
            </>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-secondary/20 p-4">
            <Suspense fallback={<Loader2 className="animate-spin" />}><LoginForm /></Suspense>
        </div>
    );
}
