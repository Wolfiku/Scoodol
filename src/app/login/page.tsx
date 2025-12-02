"use client";

import { useState } from 'react';
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

const loginSchema = z.object({
  email: z.string().email({ message: "Ungültige E-Mail-Adresse." }),
  password: z.string().min(1, { message: "Passwort wird benötigt." }),
});

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const { user } = useUser();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    try {
      // Non-blocking sign-in. The onAuthStateChanged listener will handle the redirect.
      initiateEmailSignIn(auth, values.email, values.password);
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Login fehlgeschlagen",
        description: "E-Mail oder Passwort ist falsch.",
      });
      setIsLoading(false);
    }
  };
  
  // This effect will run when the user's auth state changes.
  // If the user successfully logs in, redirect them.
  if (user) {
    router.push('/success');
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
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
                      <Input placeholder="deine@email.de" {...field} />
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
                      <Input type="password" placeholder="******" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Melde an...' : 'Anmelden'}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Noch keinen Account?{" "}
            <Link href="/register" className="underline">
              Jetzt registrieren
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
