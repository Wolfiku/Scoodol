'use client';

import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MonitorOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

/**
 * Layout component for the Scoodol Workspace.
 * Prevents access on mobile devices as requested by the user.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const router = useRouter();

  // Wait for the client-side hook to determine the device type to avoid hydration flickers
  if (isMobile === undefined) return null;

  if (isMobile) {
    return (
      <div className="flex items-center justify-center min-h-svh p-6 bg-background">
        <Card className="max-w-md w-full border-2 shadow-2xl text-center rounded-3xl overflow-hidden animate-in zoom-in duration-300">
          <div className="h-2 bg-primary w-full" />
          <CardHeader className="pt-8">
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
              <MonitorOff className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-black">Workspace gesperrt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pb-8">
            <div className="space-y-2">
                <p className="text-lg font-bold text-foreground">
                    Diese Website ist nicht für Mobilgeräte optimiert.
                </p>
                <p className="text-sm text-muted-foreground">
                  Um den Scoodol Workspace mit all seinen Dokumenten, Quizzes und Statistiken zu nutzen, verwende bitte einen PC, Laptop oder ein Tablet.
                </p>
            </div>
            <Button variant="outline" className="w-full rounded-xl h-12 font-bold" onClick={() => router.push('/')}>
                Zurück zur App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
