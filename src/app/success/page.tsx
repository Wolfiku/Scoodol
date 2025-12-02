"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function SuccessPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // If user is not loading and is logged in, redirect to home.
    if (!isUserLoading && user) {
      setTimeout(() => {
        router.push('/');
      }, 1500); // Wait 1.5 seconds before redirecting
    }
    // If user is not logged in after check, redirect to login.
    if (!isUserLoading && !user) {
        router.push('/login');
    }
  }, [user, isUserLoading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Login erfolgreich!</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p>Du wirst gleich weitergeleitet...</p>
          <Loader2 className="animate-spin text-primary" />
        </CardContent>
      </Card>
    </div>
  );
}
