
"use client"

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { searchFormula } from '@/app/actions';
import type { FindFormulaOutput } from '@/ai/flows/find-formula';
import { Loader2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const formulas = {
    "Mathematik": [
        // Algebra
        { name: "Satz des Pythagoras", formula: "a² + b² = c²" },
        { name: "Quadratische Formel (Mitternachtsformel)", formula: "x = [-b ± sqrt(b² - 4ac)] / 2a" },
        { name: "Binomische Formeln", formula: "(a+b)²=a²+2ab+b²\n(a-b)²=a²-2ab+b²\n(a+b)(a-b)=a²-b²" },
        { name: "p-q-Formel", formula: "x₁,₂ = -p/2 ± sqrt((p/2)² - q)" },
        // Geometrie
        { name: "Umfang eines Kreises", formula: "U = 2 * π * r" },
        { name: "Flächeninhalt eines Kreises", formula: "A = π * r²" },
        { name: "Volumen einer Kugel", formula: "V = (4/3) * π * r³" },
        { name: "Volumen eines Zylinders", formula: "V = π * r² * h" },
        // Trigonometrie
        { name: "Sinussatz", formula: "a/sin(α) = b/sin(β) = c/sin(γ)" },
        { name: "Kosinussatz", formula: "c² = a² + b² - 2ab * cos(γ)" },
    ],
    "Physik": [
        // Mechanik
        { name: "Newtonsches Bewegungsgesetz", formula: "F = m * a" },
        { name: "Impuls", formula: "p = m * v" },
        { name: "Kinetische Energie", formula: "E_kin = 1/2 * m * v²" },
        { name: "Potentielle Energie", formula: "E_pot = m * g * h" },
        // Elektrizität
        { name: "Ohmsches Gesetz", formula: "U = R * I" },
        { name: "Elektrische Leistung", formula: "P = U * I" },
        { name: "Coulombsches Gesetz", formula: "F = k * (|q₁*q₂|) / r²" },
        // Thermodynamik & Wellen
        { name: "Energie-Masse-Äquivalenz", formula: "E = mc²" },
        { name: "Wellengeschwindigkeit", formula: "c = λ * f" },

    ],
    "Chemie": [
        { name: "Ideales Gasgesetz", formula: "PV = nRT" },
        { name: "Stoffmenge", formula: "n = m / M" },
        { name: "Konzentration (Molarität)", formula: "c = n / V" },
    ]
}

type Subject = keyof typeof formulas;

export default function FormulaCollection() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [searchResult, setSearchResult] = useState<FindFormulaOutput | null>(null);
    const { toast } = useToast();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            toast({
                variant: 'destructive',
                title: 'Offline',
                description: 'Diese Funktion benötigt eine Internetverbindung.',
            });
            return;
        }

        setIsLoading(true);
        setSearchResult(null);
        const result = await searchFormula(searchTerm, JSON.stringify(formulas));
        setSearchResult(result);
        setIsLoading(false);
    };

    const filteredFormulas = Object.keys(formulas).reduce((acc, subject) => {
        const subjectFormulas = formulas[subject as Subject].filter(
            f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.formula.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (subjectFormulas.length > 0) {
            acc[subject as Subject] = subjectFormulas;
        }
        return acc;
    }, {} as typeof formulas);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Formelsammlung</CardTitle>
        <CardDescription>Durchsuche die Formelsammlung oder frage die KI nach einer Formel.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <Input 
                type="text"
                placeholder="Suche nach einer Formel, z.B. 'Fläche Dreieck'..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : 'Suchen'}
            </Button>
        </form>

        {isLoading && (
            <div className="flex justify-center items-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="ml-4 text-muted-foreground">KI durchsucht das Wissen des Universums...</p>
            </div>
        )}

        {searchResult && (
            <div className="mb-6">
                <h3 className="text-xl font-bold mb-4">KI-Suchergebnis</h3>
                {searchResult.foundFormula && (
                     <div className="p-4 bg-primary/10 rounded-lg border border-primary">
                        <p className="font-semibold text-primary">{searchResult.foundFormula.name}</p>
                        <p className="font-mono text-primary whitespace-pre-wrap mt-1">{searchResult.foundFormula.formula}</p>
                        <p className="text-sm text-muted-foreground mt-2">Gefunden in: {searchResult.foundFormula.subject}</p>
                    </div>
                )}
                 {searchResult.suggestedFormula && (
                     <div className="p-4 bg-accent/10 rounded-lg border border-accent">
                        <p className="font-semibold text-accent-foreground flex items-center gap-2"><Wand2 className="w-5 h-5" /> KI-Vorschlag</p>
                        <p className="font-semibold mt-2">{searchResult.suggestedFormula.name}</p>
                        <p className="font-mono whitespace-pre-wrap mt-1">{searchResult.suggestedFormula.formula}</p>
                        <p className="text-sm text-muted-foreground mt-2">Thema: {searchResult.suggestedFormula.subject}</p>
                    </div>
                )}
                {searchResult.error && <p className="text-destructive">{searchResult.error}</p>}
                 {!searchResult.foundFormula && !searchResult.suggestedFormula && !searchResult.error && (
                    <p className="text-muted-foreground text-center p-4">Die KI konnte leider keine passende Formel finden.</p>
                )}
            </div>
        )}


        <Accordion type="multiple" defaultValue={Object.keys(filteredFormulas)} className="w-full">
             {(Object.keys(filteredFormulas) as Subject[]).map(subject => (
                <AccordionItem value={subject} key={subject}>
                    <AccordionTrigger className="text-xl font-bold">{subject}</AccordionTrigger>
                    <AccordionContent>
                        <div className="space-y-4">
                            {filteredFormulas[subject].map(formula => (
                                <div key={formula.name} className="p-4 bg-secondary rounded-lg">
                                    <p className="font-semibold">{formula.name}</p>
                                    <p className="font-mono text-primary whitespace-pre-wrap">{formula.formula}</p>
                                </div>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

    