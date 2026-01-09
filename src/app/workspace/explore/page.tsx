
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListTodo, Search, StickyNote, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const templates = [
    {
        title: "Quick Note",
        description: "Eine schnelle Notiz mit einfacher Markdown-Formatierung.",
        icon: <StickyNote className="w-8 h-8" />,
        href: "/workspace/notes/new"
    },
    {
        title: "To-Do-Liste",
        description: "Eine einfache Liste, um Aufgaben zu verfolgen.",
        icon: <ListTodo className="w-8 h-8" />,
        href: "/workspace/todos/new"
    }
]

export default function ExplorePage() {
    const router = useRouter();

    return (
        <div className="container mx-auto p-4 md:p-8">
            <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück
            </Button>
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
                {templates.map((template) => (
                    <Link href={template.href} key={template.title} className="block hover:no-underline">
                        <div className="p-6 border rounded-lg h-full flex flex-col items-start gap-4 hover:bg-accent/50 transition-colors">
                             <div className="p-3 bg-secondary rounded-lg text-primary">
                                {template.icon}
                            </div>
                            <h3 className="font-semibold text-lg">{template.title}</h3>
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                        </div>
                    </Link>
                ))}
                 <div className="p-8 text-center text-muted-foreground bg-secondary rounded-lg col-span-full md:col-span-2 lg:col-span-1">
                    <p>Hier werden bald weitere Vorlagen angezeigt.</p>
                </div>
            </div>
        </div>
    )
}
