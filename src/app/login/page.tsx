
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
import { initiateEmailSignIn, useAuth, useUser } from '@/firebase';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email({ message: "Ungültige E-Mail-Adresse." }),
  password: z.string().min(1, { message: "Passwort wird benötigt." }),
});

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    if (!auth) return;
    setIsLoading(true);
    try {
      // Non-blocking sign-in. The onAuthStateChanged listener will handle the redirect.
      initiateEmailSignIn(auth, values.email, values.password);
      toast({
        title: "Anmeldung...",
        description: "Du wirst gleich weitergeleitet.",
      });
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Login fehlgeschlagen",
        description: "E-Mail oder Passwort ist falsch.",
      });
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    // Redirect if user is logged in (and not anonymous)
    if (!isUserLoading && user && !user.isAnonymous) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || (user && !user.isAnonymous)) {
     return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <CardTitle>Einen Moment...</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                <p>Du wirst angemeldet und weitergeleitet.</p>
                <Loader2 className="animate-spin text-primary" />
            </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
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
                {isLoading ? <Loader2 className="animate-spin" /> : 'Anmelden'}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Noch keinen Account?{" "}
            <Button variant="link" asChild className="p-0 h-auto">
                <Link href="/register">Jetzt registrieren</Link>
            </Button>
          </div>
           <div className="mt-6 text-center">
             <Button variant="ghost" asChild>
                <Link href="/">Zurück zur App</Link>
            </Button>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}

    