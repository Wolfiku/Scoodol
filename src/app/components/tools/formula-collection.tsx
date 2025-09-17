
"use client"

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const formulas = {
    "Mathematik": [
        { name: "Satz des Pythagoras", formula: "a² + b² = c²" },
        { name: "Quadratische Formel (Mitternachtsformel)", formula: "x = [-b ± sqrt(b² - 4ac)] / 2a" },
        { name: "Binomische Formeln", formula: "(a+b)²=a²+2ab+b²\n(a-b)²=a²-2ab+b²\n(a+b)(a-b)=a²-b²" },
    ],
    "Physik": [
        { name: "Newtonsches Bewegungsgesetz", formula: "F = m * a" },
        { name: "Ohmsches Gesetz", formula: "U = R * I" },
        { name: "Energie-Masse-Äquivalenz", formula: "E = mc²" },
    ],
    "Chemie": [
        { name: "Ideales Gasgesetz", formula: "PV = nRT" },
    ]
}

type Subject = keyof typeof formulas;

export default function FormulaCollection() {
    const [searchTerm, setSearchTerm] = useState('');

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
        <CardDescription>Durchsuche die Formelsammlung für Mathe, Physik und Chemie.</CardDescription>
      </CardHeader>
      <CardContent>
        <Input 
            type="text"
            placeholder="Suche nach einer Formel oder einem Thema..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-6"
        />

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
