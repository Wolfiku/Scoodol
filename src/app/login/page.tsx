
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
      // The useEffect below handles the redirect
    } catch (error: any) {
       console.error("Login error:", error);
       let message = "E-Mail oder Passwort ist falsch.";
       if (error.code === 'auth/user-not-found') message = "Account nicht gefunden.";
       if (error.code === 'auth/wrong-password') message = "Falsches Passwort.";
       
       toast({ variant: "destructive", title: "Login fehlgeschlagen", description: message });
       setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (!isUserLoading && user && !user.isAnonymous) {
      router.push(redirectPath);
    }
  }, [user, isUserLoading, router, redirectPath]);

  if (isUserLoading) {
    return (
        <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="animate-spin text-primary h-8 w-8" />
            <p className="text-sm text-muted-foreground">Prüfe Anmeldung...</p>
        </div>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Willkommen zurück!</CardTitle>
        <CardDescription>Melde dich bei deinem Scoodol Account an.</CardDescription>
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : 'Anmelden'}
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center text-sm">
          Noch keinen Account?{" "}
          <Button variant="link" asChild className="p-0 h-auto">
              <Link href={`/register${redirectPath !== '/' ? `?redirect=${encodeURIComponent(redirectPath)}` : ''}`}>Jetzt registrieren</Link>
          </Button>
        </div>
         <div className="mt-6 text-center">
           <Button variant="ghost" asChild>
              <Link href="/">Zurück zur App</Link>
          </Button>
         </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
            <Suspense fallback={<Loader2 className="animate-spin" />}><LoginForm /></Suspense>
        </div>
    );
}
