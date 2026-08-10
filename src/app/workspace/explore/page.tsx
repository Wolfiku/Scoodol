
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListTodo, Search, StickyNote, ArrowLeft, BrainCircuit, BookOpen, FileText, Link2, Type } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type ItemKind = 'type' | 'template' | 'smart';

interface ExploreItem {
    title: string;
    description: string;
    icon: React.ReactNode;
    href: string;
    category: string;
    kind: ItemKind;
}

const items: ExploreItem[] = [
    {
        title: "Text-Dokument",
        description: "Ein funktionsreiches Dokument mit Tabellen, Bildern und Text-Formatierung.",
        icon: <Type className="w-8 h-8" />,
        href: "/workspace/documents/new",
        category: "Basic",
        kind: "type"
    },
    {
        title: "Quick Note",
        description: "Eine schnelle Notiz mit einfacher Markdown-Formatierung.",
        icon: <StickyNote className="w-8 h-8" />,
        href: "/workspace/notes/new",
        category: "Basic",
        kind: "type"
    },
    {
        title: "To-Do-Liste",
        description: "Organisiere deine Aufgaben mit Prioritäten, Fristen und Gruppen.",
        icon: <ListTodo className="w-8 h-8" />,
        href: "/workspace/todos/new",
        category: "Basic",
        kind: "type"
    },
    {
        title: "Quiz",
        description: "Erstelle interaktive Quizzes zum Lernen und Testen.",
        icon: <BrainCircuit className="w-8 h-8" />,
        href: "/workspace/quizzes/new",
        category: "Interaktiv",
        kind: "type"
    },
    {
        title: "Link-Sammlung",
        description: "Sammle Quellen für deine Recherche mit einer speziellen UI.",
        icon: <Link2 className="w-8 h-8" />,
        href: "/workspace/notes/new?template=links",
        category: "Recherche",
        kind: "smart"
    },
    {
        title: "Lernzettel",
        description: "Prüfungsvorbereitung mit integriertem KI-Tutor für Rückfragen.",
        icon: <BookOpen className="w-8 h-8" />,
        href: "/workspace/notes/new?template=study",
        category: "Lernen",
        kind: "smart"
    },
    {
        title: "Stunden-Protokoll",
        description: "Halte Mitschriften fest und erstelle Hausaufgaben direkt aus dem Protokoll.",
        icon: <FileText className="w-8 h-8" />,
        href: "/workspace/notes/new?template=protocol",
        category: "Unterricht",
        kind: "smart"
    }
]

export default function ExplorePage() {
    const router = useRouter();
    const [search, setSearch] = useState("");

    const filteredItems = items.filter(t => 
        t.title.toLowerCase().includes(search.toLowerCase()) || 
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
    );

    const types = filteredItems.filter(i => i.kind === 'type');
    const smartTemplates = filteredItems.filter(i => i.kind === 'smart');

    const renderGrid = (items: ExploreItem[], sectionTitle: string) => {
        if (items.length === 0) return null;
        return (
            <div className="space-y-6 mb-12">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    {sectionTitle}
                    <Badge variant="outline" className="ml-2 font-normal">{items.length}</Badge>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => (
                        <Link href={item.href} key={item.title} className="block hover:no-underline">
                            <div className={cn(
                                "p-6 border rounded-xl h-full flex flex-col items-start gap-4 transition-all hover:shadow-md hover:border-primary/50 group",
                                item.kind === 'type' ? "bg-card shadow-sm" : "bg-accent/5"
                            )}>
                                <div className={cn(
                                    "p-3 rounded-lg transition-colors",
                                    item.kind === 'type' 
                                        ? "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground" 
                                        : "bg-background border text-muted-foreground group-hover:text-primary"
                                )}>
                                    {item.icon}
                                </div>
                                <div className="space-y-1 w-full">
                                    <div className="flex justify-between items-start">
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{item.category}</span>
                                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 uppercase font-black">
                                            {item.kind === 'type' ? 'System' : 'Smart Vorlage'}
                                        </Badge>
                                    </div>
                                    <h3 className="font-bold text-lg">{item.title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
            <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zum Workspace
            </Button>
            <header className="mb-10">
                <h1 className="text-4xl font-black tracking-tight mb-2">Entdecken</h1>
                <p className="text-lg text-muted-foreground">Erstelle neue Dokumente oder nutze spezialisierte Smart Vorlagen.</p>
            </header>

            <div className="relative mb-12">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                    placeholder="Suche nach Vorlagen, Typen oder Kategorien..."
                    className="pl-12 text-lg py-7 rounded-2xl shadow-sm border-2 focus-visible:ring-primary"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {renderGrid(types, "Dokumententypen")}
                {renderGrid(smartTemplates, "Smart Vorlagen")}

                {filteredItems.length === 0 && (
                    <div className="p-20 text-center text-muted-foreground bg-secondary/30 rounded-3xl border-2 border-dashed">
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="text-xl font-medium">Keine Ergebnisse für deine Suche gefunden.</p>
                        <Button variant="link" onClick={() => setSearch("")} className="mt-2">Suche zurücksetzen</Button>
                    </div>
                )}
            </div>
        </div>
    )
}
