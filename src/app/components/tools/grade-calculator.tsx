
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';

type Grade = {
  id: number;
  grade: string;
  weight: string;
};

export default function GradeCalculator() {
    const [grades, setGrades] = useState<Grade[]>([{ id: 1, grade: '', weight: '1' }]);
    const [average, setAverage] = useState<number | null>(null);

    const addGrade = () => {
        setGrades([...grades, { id: Date.now(), grade: '', weight: '1' }]);
    };

    const removeGrade = (id: number) => {
        setGrades(grades.filter(g => g.id !== id));
    };

    const handleGradeChange = (id: number, field: 'grade' | 'weight', value: string) => {
        setGrades(grades.map(g => (g.id === id ? { ...g, [field]: value } : g)));
    };

    const calculateAverage = () => {
        let totalWeightedGrade = 0;
        let totalWeight = 0;
        let valid = true;

        grades.forEach(g => {
            const grade = parseFloat(g.grade.replace(',', '.'));
            const weight = parseFloat(g.weight.replace(',', '.'));

            if (!isNaN(grade) && !isNaN(weight) && weight > 0) {
                totalWeightedGrade += grade * weight;
                totalWeight += weight;
            } else if (g.grade || g.weight) { // only invalidate if fields are filled but incorrect
                valid = false;
            }
        });
        
        if (valid && totalWeight > 0) {
            setAverage(totalWeightedGrade / totalWeight);
        } else {
            setAverage(null);
        }
    };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notenrechner</CardTitle>
        <CardDescription>Gib deine Noten und deren Gewichtung ein, um deinen Durchschnitt zu berechnen.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {grades.map((grade, index) => (
            <div key={grade.id} className="flex gap-2 items-center">
              <Input
                type="text"
                placeholder={`Note ${index + 1}`}
                value={grade.grade}
                onChange={e => handleGradeChange(grade.id, 'grade', e.target.value)}
                className="w-full"
              />
              <Input
                type="text"
                placeholder="Gewichtung"
                value={grade.weight}
                onChange={e => handleGradeChange(grade.id, 'weight', e.target.value)}
                className="w-32"
              />
              <Button variant="ghost" size="icon" onClick={() => removeGrade(grade.id)} disabled={grades.length <= 1}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button onClick={addGrade} variant="outline" className="mt-4">
            <Plus className="mr-2 h-4 w-4" /> Note hinzufügen
        </Button>
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
          <Button onClick={calculateAverage} className="w-full sm:w-auto">Durchschnitt berechnen</Button>
          {average !== null && (
            <div className="text-center sm:text-left">
              <p className="font-bold text-lg">Dein Durchschnitt: <span className="text-primary">{average.toFixed(2)}</span></p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
