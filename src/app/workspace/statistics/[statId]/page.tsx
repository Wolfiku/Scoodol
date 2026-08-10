
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Loader2, ArrowLeft, Plus, Trash2, Save, Check, MoreHorizontal, 
    BarChart3, PieChart, LineChart, AreaChart, ScatterChart, Radar, 
    Settings, LayoutGrid, Layers, Palette, X, Layout, 
    PlusCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ChartTooltipContent } from "@/components/ui/chart";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart as RechartsPieChart, Pie, Cell,
    LineChart as RechartsLineChart, Line,
    AreaChart as RechartsAreaChart, Area,
    ScatterChart as RechartsScatterChart, Scatter,
    RadarChart as RechartsRadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar,
    ComposedChart
} from 'recharts';

type ChartType = 'bar' | 'stacked-bar' | 'pie' | 'scatter' | 'area' | 'line' | 'radar' | 'composed';

interface ChartDataPoint {
    name: string;
    value: number;
    value2?: number;
    value3?: number;
}

interface ChartItem {
    id: string;
    type: ChartType;
    design: number;
    data: ChartDataPoint[];
}

interface StatisticDoc {
  title: string;
  ownerId: string;
  mode: 'simple' | 'complex' | 'fast';
  charts: ChartItem[];
  createdAt: any;
  updatedAt: any;
}

type SaveStatus = 'idle' | 'dirty' | 'saving';

const COLORS = [
    ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'], 
    ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa'], 
    ['#1d4ed8', '#047857', '#b45309', '#b91c1c', '#6d28d9'], 
];

export default function StatisticPage() {
  const router = useRouter();
  const params = useParams();
  const statId = params?.statId as string;
  const isNewStat = statId === 'new';

  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'simple' | 'complex' | 'fast'>('simple');
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [isSetupDone, setIsSetupDone] = useState(!isNewStat);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingChartId, setEditingChartId] = useState<string | null>(null);

  const docRef = useMemoFirebase(() => 
    !isNewStat && user && typeof statId === 'string'
      ? doc(firestore, `users/${user.uid}/statistics`, statId)
      : null
  , [firestore, user, statId, isNewStat]);

  const { data: statisticData, isLoading: isLoadingStat } = useDoc<StatisticDoc>(docRef);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (statisticData) {
      setTitle(statisticData.title);
      setMode(statisticData.mode);
      setCharts(statisticData.charts || []);
      setIsSetupDone(true);
      setSaveStatus('idle');
    }
  }, [statisticData]);

  const handleSave = useCallback(async () => {
    if (!firestore || !user || !title.trim()) return;
    setSaveStatus('saving');

    try {
      if (isNewStat) {
        const statsColRef = collection(firestore, `users/${user.uid}/statistics`);
        const newDocRef = await addDoc(statsColRef, {
          title, mode, charts, ownerId: user.uid,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        router.replace(`/workspace/statistics/${newDocRef.id}`);
      } else {
        if (!docRef) return;
        await setDoc(docRef, { title, mode, charts, updatedAt: serverTimestamp() }, { merge: true });
      }
      setSaveStatus('idle');
    } catch (error) {
      setSaveStatus('dirty');
    }
  }, [firestore, user, title, mode, charts, isNewStat, docRef, router]);

  const triggerAutoSave = () => {
    setSaveStatus('dirty');
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(handleSave, 2000);
  };

  const addChart = (type: ChartType) => {
      const newChart: ChartItem = {
          id: Date.now().toString(), type, design: 0,
          data: [
              { name: 'Label 1', value: 10, value2: 5, value3: 2 },
              { name: 'Label 2', value: 25, value2: 12, value3: 8 },
              { name: 'Label 3', value: 15, value2: 20, value3: 15 },
          ]
      };
      setCharts([...charts, newChart]);
      setEditingChartId(newChart.id);
      triggerAutoSave();
  };

  const updateChart = (id: string, updates: Partial<ChartItem>) => {
      setCharts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      triggerAutoSave();
  };

  const deleteChart = (id: string) => {
      setCharts(prev => prev.filter(c => c.id !== id));
      triggerAutoSave();
  };

  const renderChart = (chart: ChartItem) => {
      const colors = COLORS[chart.design];
      const data = chart.data;
      switch(chart.type) {
          case 'bar':
              return (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
              );
          case 'stacked-bar':
              return (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="value" stackId="a" fill={colors[0]} />
                        <Bar dataKey="value2" stackId="a" fill={colors[1]} />
                    </BarChart>
                </ResponsiveContainer>
              );
          case 'pie':
              return (
                <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill={colors[0]} label>
                            {data.map((_, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </RechartsPieChart>
                </ResponsiveContainer>
              );
          case 'line':
              return (
                <ResponsiveContainer width="100%" height={300}>
                    <RechartsLineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={3} />
                    </RechartsLineChart>
                </ResponsiveContainer>
              );
          default:
              return <p className="text-center text-muted-foreground p-8">Chart-Typ {chart.type} wird geladen...</p>;
      }
  };

  const editingChart = useMemo(() => charts.find(c => c.id === editingChartId), [charts, editingChartId]);

  if (isUserLoading || (isLoadingStat && !isNewStat)) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  if (!isSetupDone) {
    return (
      <div className="container mx-auto p-4 max-w-lg flex flex-col justify-center min-h-screen">
        <Card className="border-2 shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl font-black">Neue Statistik</CardTitle>
            <CardDescription>Wähle deinen Arbeitsmodus.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="font-bold">Titel</Label>
              <Input placeholder="z.B. Ergebnisse 10b" value={title} onChange={e => setTitle(e.target.value)} className="py-6 text-lg" />
            </div>
            <div className="grid gap-4">
                <Button variant={mode === 'simple' ? 'default' : 'outline'} className="h-20 justify-start px-6 gap-4" onClick={() => setMode('simple')}>
                    <BarChart3 className="text-primary" />
                    <div className="text-left"><p className="font-bold">Simple Mode</p><p className="text-xs opacity-70">Diagramme per Klick hinzufügen.</p></div>
                </Button>
            </div>
            <Button className="w-full py-6 font-bold text-lg" disabled={!title.trim()} onClick={() => setIsSetupDone(true)}>Editor starten</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="bg-background border-b p-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <Button variant="ghost" size="icon" onClick={() => router.push('/workspace')}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex flex-col">
            <Input value={title} onChange={e => { setTitle(e.target.value); triggerAutoSave(); }} className="h-7 text-lg font-bold border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent" />
            <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black text-muted-foreground">Modus: {mode}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">• {saveStatus === 'saving' ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3"/>}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" className="font-bold px-4 gap-2"><Plus className="h-4 w-4" /> Element hinzufügen</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
              <DropdownMenuLabel>Diagramm-Typ wählen</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="grid grid-cols-2 gap-1">
                <DropdownMenuItem onClick={() => addChart('bar')} className="flex flex-col gap-1 items-center p-3 h-auto"><BarChart3 className="h-6 w-6" /><span className="text-[10px]">Balken</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('pie')} className="flex flex-col gap-1 items-center p-3 h-auto"><PieChart className="h-6 w-6" /><span className="text-[10px]">Kreis</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('line')} className="flex flex-col gap-1 items-center p-3 h-auto"><LineChart className="h-6 w-6" /><span className="text-[10px]">Linie</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('stacked-bar')} className="flex flex-col gap-1 items-center p-3 h-auto"><Layers className="h-6 w-6" /><span className="text-[10px]">Turm</span></DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={() => setIsDeleteDialogOpen(true)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto bg-secondary/10 p-6 md:p-12">
        <div className="max-w-6xl mx-auto">
            {charts.length === 0 ? (
                <div className="text-center py-32 space-y-6">
                    <BarChart3 className="w-20 h-20 text-primary opacity-20 mx-auto" />
                    <h2 className="text-2xl font-bold">Keine Diagramme</h2>
                    <p className="text-muted-foreground">Erstelle oben dein erstes Diagramm.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {charts.map((chart) => (
                        <Card key={chart.id} className="group border-2 hover:border-primary/50 transition-all shadow-md">
                            <CardHeader className="pb-2 border-b bg-muted/30 flex flex-row justify-between items-center space-y-0">
                                <Badge variant="secondary" className="uppercase text-[9px] font-black">{chart.type}</Badge>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingChartId(chart.id)}><Settings className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteChart(chart.id)}><X className="h-4 w-4" /></Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-8">{renderChart(chart)}</CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
      </main>

      <Dialog open={!!editingChartId} onOpenChange={(open) => !open && setEditingChartId(null)}>
          <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col p-0">
              {editingChart && (
                  <>
                    <DialogHeader className="p-6 border-b"><DialogTitle>Diagramm bearbeiten</DialogTitle></DialogHeader>
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        <div className="flex-1 overflow-auto p-6 space-y-8 bg-background">
                            <section className="space-y-4">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">Farbschema</Label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[0, 1, 2].map(v => (
                                        <button key={v} onClick={() => updateChart(editingChart.id, { design: v })} className={cn("p-4 border-2 rounded-xl transition-all", editingChart.design === v ? "border-primary bg-primary/5" : "hover:border-muted")}>
                                            <div className="flex justify-center gap-1">{COLORS[v].map(c => <div key={c} className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />)}</div>
                                            <p className="text-[10px] font-bold uppercase mt-2">Design {v + 1}</p>
                                        </button>
                                    ))}
                                </div>
                            </section>
                            <section className="space-y-4">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">Datenpunkte</Label>
                                {editingChart.data.map((dp, i) => (
                                    <div key={i} className="flex gap-2 items-center bg-secondary/30 p-3 rounded-xl border">
                                        <Input value={dp.name} onChange={e => { const newData = [...editingChart.data]; newData[i].name = e.target.value; updateChart(editingChart.id, { data: newData }); }} className="h-8 text-xs font-bold" />
                                        <Input type="number" value={dp.value} onChange={e => { const newData = [...editingChart.data]; newData[i].value = Number(e.target.value); updateChart(editingChart.id, { data: newData }); }} className="h-8 text-xs w-24" />
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { const newData = editingChart.data.filter((_, idx) => idx !== i); updateChart(editingChart.id, { data: newData }); }}><X className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                                <Button variant="outline" className="w-full border-dashed" onClick={() => { const newData = [...editingChart.data, { name: 'Neu', value: 10 }]; updateChart(editingChart.id, { data: newData }); }}><PlusCircle className="h-4 w-4 mr-2" /> Punkt hinzufügen</Button>
                            </section>
                        </div>
                        <div className="flex-1 bg-secondary/5 border-l p-6 flex items-center justify-center">{renderChart(editingChart)}</div>
                    </div>
                  </>
              )}
          </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Statistik löschen?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDoc} className="bg-destructive text-white">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
