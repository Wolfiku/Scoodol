
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
import { initiateEmailSignUp, useAuth } from '@/firebase';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

const registerSchema = z.object({
  email: z.string().email({ message: "Ungültige E-Mail-Adresse." }),
  password: z.string().min(6, { message: "Passwort muss mindestens 6 Zeichen lang sein." }),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwörter stimmen nicht überein.",
  path: ["confirmPassword"],
});

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof registerSchema>) => {
    if (!auth) return;
    setIsLoading(true);
    try {
      await initiateEmailSignUp(auth, values.email, values.password);
      
      toast({
        title: "Registrierung erfolgreich!",
        description: "Du wirst zum Login weitergeleitet, um dich anzumelden.",
      });
      router.push('/login');

    } catch (error: any) {
       let description = "Ein unbekannter Fehler ist aufgetreten.";
       if (error.code === 'auth/email-already-in-use') {
           description = "Diese E-Mail-Adresse wird bereits verwendet.";
       }
      toast({
        variant: "destructive",
        title: "Registrierung fehlgeschlagen",
        description,
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Account erstellen</CardTitle>
          <CardDescription>Erstelle einen neuen Scoodol Account, um deine Daten zu sichern.</CardDescription>
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
                      <Input placeholder="deine@email.de" {...field} disabled={isLoading}/>
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
                      <Input type="password" placeholder="******" {...field} disabled={isLoading}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passwort bestätigen</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="******" {...field} disabled={isLoading}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : 'Registrieren'}
              </Button>
            </form>
          </Form>
           <div className="mt-4 text-center text-sm">
            Schon einen Account?{" "}
             <Button variant="link" asChild className="p-0 h-auto">
                <Link href="/login">Hier anmelden</Link>
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

    