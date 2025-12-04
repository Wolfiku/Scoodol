
"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function ChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  
  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurück
      </Button>
      {children}
    </div>
  );
}
