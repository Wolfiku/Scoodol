
"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LegalLayout({ title, children }: { title: string, children: React.ReactNode }) {
    const router = useRouter();

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
             <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück
            </Button>
            <h1 className="text-4xl font-bold mb-8">{title}</h1>
            <div className="prose dark:prose-invert max-w-none">
                {children}
            </div>
        </div>
    );
}

// Basic prose styling for Tailwind
// Add this to your globals.css if you don't have a typography plugin

/*
@layer base {
  .prose {
    @apply text-foreground;
  }
  .prose h2 {
    @apply text-2xl font-bold mt-8 mb-4;
  }
  .prose h3 {
    @apply text-xl font-bold mt-6 mb-3;
  }
  .prose p, .prose ul, .prose li {
    @apply mb-4;
  }
  .prose a {
    @apply text-primary hover:underline;
  }
  .prose strong {
    @apply font-bold;
  }
  .prose ul {
    @apply list-disc pl-5;
  }
}
*/
