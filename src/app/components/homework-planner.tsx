"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  Camera,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { scanHomeworkImage } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";

type Homework = {
  id: number;
  subject: string;
  task: string;
  dueDate: string;
  done: boolean;
};

export default function HomeworkPlanner() {
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
    const savedHomeworks = localStorage.getItem("homeworks");
    if (savedHomeworks) {
      setHomeworks(JSON.parse(savedHomeworks));
    }
  }, []);

  useEffect(() => {
    if(isMounted) {
      localStorage.setItem("homeworks", JSON.stringify(homeworks));
    }
  }, [homeworks, isMounted]);

  const addHomework = () => {
    if (!newTask.trim()) return;
    const newHomework: Homework = {
      id: Date.now(),
      subject: newSubject,
      task: newTask,
      dueDate: newDueDate,
      done: false,
    };
    setHomeworks(prev => [...prev, newHomework]);
    setNewSubject("");
    setNewTask("");
    setNewDueDate("");
  };
  
  const addMultipleHomeworks = (tasks: {subject: string, task: string, dueDate?: string}[]) => {
      const newHomeworks: Homework[] = tasks.map(t => ({
          id: Date.now() + Math.random(),
          subject: t.subject,
          task: t.task,
          dueDate: t.dueDate || "",
          done: false,
      }));
      setHomeworks(prev => [...prev, ...newHomeworks]);
  }

  const toggleDone = (id: number) => {
    setHomeworks(
      homeworks.map((hw) => (hw.id === id ? { ...hw, done: !hw.done } : hw))
    );
  };

  const deleteHomework = (id: number) => {
    setHomeworks(homeworks.filter((hw) => hw.id !== id));
  };
  
  const handleCameraClick = () => {
      fileInputRef.current?.click();
  }
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const dataUri = reader.result as string;
        const result = await scanHomeworkImage(dataUri);
        
        if (result.error || !result.tasks || result.tasks.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Fehler beim Scannen',
                description: result.error || 'Die KI konnte keine Aufgaben im Bild finden.',
            });
        } else {
            addMultipleHomeworks(result.tasks);
            toast({
                title: 'Aufgaben gescannt!',
                description: `${result.tasks.length} neue Aufgabe(n) wurde(n) hinzugefügt.`,
            });
        }
        setIsScanning(false);
    };
    reader.onerror = () => {
        toast({
            variant: 'destructive',
            title: 'Fehler',
            description: 'Die Bilddatei konnte nicht gelesen werden.',
        });
        setIsScanning(false);
    }
  }
  
  if (!isMounted) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Hausaufgabenplaner</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Laden...</p>
            </CardContent>
        </Card>
    ); 
  }

  const upcomingHomeworks = homeworks.filter(hw => !hw.done);
  const doneHomeworks = homeworks.filter(hw => hw.done);

  return (
    <Card className="h-full flex flex-col min-h-[500px]">
      <CardHeader>
        <CardTitle className="flex flex-wrap gap-4 justify-between items-center">
          <span>Hausaufgabenplaner</span>
          <div className="flex gap-2">
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <Button variant="outline" size="icon" onClick={handleCameraClick} disabled={isScanning}>
              {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              <span className="sr-only">Hausaufgabe scannen</span>
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2" /> Neue Aufgabe
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neue Hausaufgabe hinzufügen</DialogTitle>
                  <DialogDescription>
                    Fülle die Details für deine neue Aufgabe aus.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Input
                    placeholder="Fach (z.B. Mathe)"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                  />
                  <Textarea
                    placeholder="Aufgabe (z.B. Buch S. 55 Nr. 3)"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </div>
                <DialogFooter>
                    <Button onClick={addHomework}>Hinzufügen</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="flex flex-col gap-4">
          <h3 className="font-bold text-lg">Anstehend</h3>
          {upcomingHomeworks.length > 0 ? (
            upcomingHomeworks
              .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
              .map((hw) => (
              <div
                key={hw.id}
                className="flex items-center gap-4 p-3 rounded-md bg-secondary"
              >
                <Checkbox
                  checked={hw.done}
                  onCheckedChange={() => toggleDone(hw.id)}
                  id={`hw-${hw.id}`}
                />
                <label
                  htmlFor={`hw-${hw.id}`}
                  className={`flex-1 grid gap-1 ${hw.done ? "line-through text-muted-foreground" : ""}`}
                >
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold">{hw.subject}</span>
                      {hw.dueDate && <span className="text-xs">{new Date(hw.dueDate).toLocaleDateString('de-DE')}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{hw.task}</p>
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteHomework(hw.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          ) : (
              <p className="text-muted-foreground text-center p-4">Super! Keine anstehenden Aufgaben.</p>
          )}

          {doneHomeworks.length > 0 && <h3 className="font-bold text-lg mt-4">Erledigt</h3>}
          {doneHomeworks
              .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
              .map((hw) => (
              <div
                key={hw.id}
                className="flex items-center gap-4 p-3 rounded-md bg-secondary/50"
              >
                <Checkbox
                  checked={hw.done}
                  onCheckedChange={() => toggleDone(hw.id)}
                  id={`hw-${hw.id}`}
                />
                <label
                  htmlFor={`hw-${hw.id}`}
                  className={`flex-1 grid gap-1 ${hw.done ? "line-through text-muted-foreground" : ""}`}
                >
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold">{hw.subject}</span>
                      {hw.dueDate && <span className="text-xs">{new Date(hw.dueDate).toLocaleDateString('de-DE')}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{hw.task}</p>
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteHomework(hw.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
