
"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function ExplorePage() {
    return (
        <div className="container mx-auto p-4 md:p-8">
            <header className="mb-8">
                <h1 className="text-4xl font-bold">Entdecken</h1>
                <p className="text-lg text-muted-foreground">Durchsuche alle verfügbaren Vorlagen und Tools.</p>
            </header>
            <div className="relative mb-8">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                    placeholder="Suche nach Vorlagen, z.B. 'Zusammenfassung'..."
                    className="pl-10 text-base py-6"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Placeholder for future content */}
                 <div className="p-8 text-center text-muted-foreground bg-secondary rounded-lg col-span-full">
                    <p>Hier werden bald Vorlagen und weitere Tools angezeigt.</p>
                </div>
            </div>
        </div>
    )
}
