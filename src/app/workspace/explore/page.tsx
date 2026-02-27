
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListTodo, Search, StickyNote, ArrowLeft, BrainCircuit, BookOpen, FileText, Link2, Presentation } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const templates = [
    {
        title: "Quick Note",
        description: "Eine schnelle Notiz mit einfacher Markdown-Formatierung.",
        icon: <StickyNote className="w-8 h-8" />,
        href: "/workspace/notes/new",
        category: "Basic"
    },
    {
        title: "Lernzettel",
        description: "Perfekt strukturiert für deine Prüfungsvorbereitung.",
        icon: <BookOpen className="w-8 h-8" />,
        href: "/workspace/notes/new?template=study",
        category: "Lernen"
    },
    {
        title: "Stunden-Protokoll",
        description: "Halte fest, was in der letzten Stunde wichtig war.",
        icon: <FileText className="w-8 h-8" />,
        href: "/workspace/notes/new?template=protocol",
        category: "Unterricht"
    },
    {
        title: "Referat-Planer",
        description: "Plane deinen nächsten Vortrag von der Gliederung bis zum Handout.",
        icon: <Presentation className="w-8 h-8" />,
        href: "/workspace/notes/new?template=presentation",
        category: "Projekte"
    },
    {
        title: "Link-Sammlung",
        description: "Sammle Quellen und Inspiration für deine Hausarbeiten.",
        icon: <Link2 className="w-8 h-8" />,
        href: "/workspace/notes/new?template=links",
        category: "Recherche"
    },
    {
        title: "To-Do-Liste",
        description: "Eine einfache Liste, um Aufgaben zu verfolgen.",
        icon: <ListTodo className="w-8 h-8" />,
        href: "/workspace/todos/new",
        category: "Basic"
    },
    {
        title: "Quiz",
        description: "Erstelle interaktive Quizzes zum Lernen und Testen.",
        icon: <BrainCircuit className="w-8 h-8" />,
        href: "/workspace/quizzes/new",
        category: "Interaktiv"
    }
]

export default function ExplorePage() {
    const router = useRouter();
    const [search, setSearch] = useState("");

    const filteredTemplates = templates.filter(t => 
        t.title.toLowerCase().includes(search.toLowerCase()) || 
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
    );

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
                    placeholder="Suche nach Vorlagen (z.B. 'Lernen', 'Referat')..."
                    className="pl-10 text-base py-6"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((template) => (
                    <Link href={template.href} key={template.title} className="block hover:no-underline">
                        <div className="p-6 border rounded-lg h-full flex flex-col items-start gap-4 hover:bg-accent/50 transition-colors group">
                             <div className="p-3 bg-secondary rounded-lg text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                {template.icon}
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{template.category}</span>
                                <h3 className="font-semibold text-lg">{template.title}</h3>
                                <p className="text-sm text-muted-foreground">{template.description}</p>
                            </div>
                        </div>
                    </Link>
                ))}
                {filteredTemplates.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground bg-secondary rounded-lg col-span-full">
                        <p>Keine Vorlagen für deine Suche gefunden.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
