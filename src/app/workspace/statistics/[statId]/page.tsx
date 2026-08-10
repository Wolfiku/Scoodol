
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
    Settings, LayoutGrid, Layers, Palette, ChevronRight, X, Layout, 
    PlusCircle, Wand2, ArrowUpCircle
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart as RechartsPieChart, Pie, Cell,
    LineChart as RechartsLineChart, Line,
    AreaChart as RechartsAreaChart, Area,
    ScatterChart as RechartsScatterChart, Scatter,
    RadarChart as RechartsRadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar,
    ComposedChart, ZAxis
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
    design: number; // 0, 1, or 2
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
    ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'], // Version 0: Bold
    ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa'], // Version 1: Soft
    ['#1d4ed8', '#047857', '#b45309', '#b91c1c', '#6d28d9'], // Version 2: Dark
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
          title,
          mode,
          charts,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        router.replace(`/workspace/statistics/${newDocRef.id}`);
      } else {
        if (!docRef) return;
        await setDoc(docRef, {
          title,
          mode,
          charts,
          updatedAt: serverTimestamp(),
        }, { merge: true });
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
          id: Date.now().toString(),
          type,
          design: 0,
          data: [
              { name: 'Label 1', value: 10, value2: 5, value3: 2 },
              { name: 'Label 2', value: 25, value2: 12, value3: 8 },
              { name: 'Label 3', value: 15, value2: 20, value3: 15 },
          ]
      };
      setCharts([...charts, newChart]);
      setEditingChartId(newChart.id);
      triggerAutoSave();
      toast({ title: 'Diagramm hinzugefügt' });
  };

  const updateChart = (id: string, updates: Partial<ChartItem>) => {
      setCharts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      triggerAutoSave();
  };

  const deleteChart = (id: string) => {
      setCharts(prev => prev.filter(c => c.id !== id));
      triggerAutoSave();
  };

  const handleDeleteDoc = async () => {
    if (isNewStat || !docRef) return;
    await deleteDoc(docRef);
    toast({ title: 'Statistik gelöscht' });
    router.push('/workspace');
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
                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                        <YAxis axisLine={false} tickLine={false} fontSize={12} />
                        <Tooltip cursor={{ fill: 'transparent' }} content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
              );
          case 'stacked-bar':
              return (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                        <YAxis axisLine={false} tickLine={false} fontSize={12} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="value" stackId="a" fill={colors[0]} />
                        <Bar dataKey="value2" stackId="a" fill={colors[1]} />
                        <Bar dataKey="value3" stackId="a" fill={colors[2]} />
                    </BarChart>
                </ResponsiveContainer>
              );
          case 'pie':
              return (
                <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill={colors[0]} label line={false}>
                            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />)}
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
                        <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </RechartsLineChart>
                </ResponsiveContainer>
              );
          case 'area':
              return (
                <ResponsiveContainer width="100%" height={300}>
                    <RechartsAreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke={colors[0]} fill={colors[0]} fillOpacity={0.2} strokeWidth={3} />
                    </RechartsAreaChart>
                </ResponsiveContainer>
              );
          case 'scatter':
              return (
                <ResponsiveContainer width="100%" height={300}>
                    <RechartsScatterChart>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" dataKey="value" name="Value A" />
                        <YAxis type="number" dataKey="value2" name="Value B" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter name="Data Points" data={data} fill={colors[0]} />
                    </RechartsScatterChart>
                </ResponsiveContainer>
              );
          case 'radar':
              return (
                <ResponsiveContainer width="100%" height={300}>
                    <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="name" />
                        <PolarRadiusAxis />
                        <RechartsRadar name="Set 1" dataKey="value" stroke={colors[0]} fill={colors[0]} fillOpacity={0.6} />
                    </RechartsRadarChart>
                </ResponsiveContainer>
              );
          case 'composed':
              return (
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="value" fill={colors[0]} stroke={colors[0]} fillOpacity={0.2} />
                        <Bar dataKey="value2" barSize={20} fill={colors[1]} />
                        <Line type="monotone" dataKey="value3" stroke={colors[2]} strokeWidth={2} />
                    </ComposedChart>
                </ResponsiveContainer>
              );
          default:
              return null;
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
              <Label className="font-bold">Titel der Statistik</Label>
              <Input placeholder="z.B. Klassen-Ergebnisse" value={title} onChange={e => setTitle(e.target.value)} className="py-6 text-lg" />
            </div>
            
            <div className="grid gap-4">
                <Button variant={mode === 'simple' ? 'default' : 'outline'} className="h-20 justify-start px-6 gap-4" onClick={() => setMode('simple')}>
                    <div className="bg-primary/10 p-2 rounded-lg text-primary"><BarChart3 /></div>
                    <div className="text-left"><p className="font-bold">Simple Mode</p><p className="text-xs opacity-70 text-muted-foreground">Einfache Diagramme per Klick hinzufügen.</p></div>
                </Button>
                <Button variant={mode === 'complex' ? 'default' : 'outline'} className="h-20 justify-start px-6 gap-4" disabled onClick={() => setMode('complex')}>
                    <div className="bg-primary/10 p-2 rounded-lg text-primary"><LayoutGrid /></div>
                    <div className="text-left"><p className="font-bold">Complex Mode (Tabelle)</p><p className="text-xs opacity-70 text-muted-foreground">Daten wie in Excel verwalten (bald verfügbar).</p></div>
                </Button>
                <Button variant={mode === 'fast' ? 'default' : 'outline'} className="h-20 justify-start px-6 gap-4" disabled onClick={() => setMode('fast')}>
                    <div className="bg-primary/10 p-2 rounded-lg text-primary"><Wand2 /></div>
                    <div className="text-left"><p className="font-bold">Fast Mode (KI)</p><p className="text-xs opacity-70 text-muted-foreground">Diagramme aus Text erstellen lassen (bald verfügbar).</p></div>
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
            <DropdownMenuTrigger asChild>
                <Button size="sm" className="font-bold px-4 gap-2">
                    <Plus className="h-4 w-4" /> Element hinzufügen
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
              <DropdownMenuLabel>Diagramm-Typ wählen</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="grid grid-cols-2 gap-1">
                <DropdownMenuItem onClick={() => addChart('bar')} className="flex flex-col gap-1 items-center p-3 h-auto"><BarChart3 className="h-6 w-6" /><span className="text-[10px]">Balken</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('stacked-bar')} className="flex flex-col gap-1 items-center p-3 h-auto"><Layers className="h-6 w-6" /><span className="text-[10px]">Turm</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('pie')} className="flex flex-col gap-1 items-center p-3 h-auto"><PieChart className="h-6 w-6" /><span className="text-[10px]">Kreis</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('scatter')} className="flex flex-col gap-1 items-center p-3 h-auto"><ScatterChart className="h-6 w-6" /><span className="text-[10px]">Punkt</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('line')} className="flex flex-col gap-1 items-center p-3 h-auto"><LineChart className="h-6 w-6" /><span className="text-[10px]">Linie</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('area')} className="flex flex-col gap-1 items-center p-3 h-auto"><AreaChart className="h-6 w-6" /><span className="text-[10px]">Fläche</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('radar')} className="flex flex-col gap-1 items-center p-3 h-auto"><Radar className="h-6 w-6" /><span className="text-[10px]">Radar</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('composed')} className="flex flex-col gap-1 items-center p-3 h-auto"><Layout className="h-6 w-6" /><span className="text-[10px]">Kombi</span></DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Löschen</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-auto bg-secondary/10">
          <div className="container mx-auto p-6 md:p-12 max-w-6xl">
              {charts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
                      <div className="bg-background p-10 rounded-full shadow-lg"><BarChart3 className="w-20 h-20 text-primary opacity-20" /></div>
                      <div className="max-w-xs">
                        <h2 className="text-2xl font-bold">Keine Diagramme</h2>
                        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">Klicke oben auf "+ Element hinzufügen", um dein erstes Diagramm zu erstellen.</p>
                      </div>
                  </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {charts.map((chart) => (
                        <Card key={chart.id} className="group relative overflow-hidden border-2 hover:border-primary/50 transition-all shadow-md">
                            <CardHeader className="pb-2 border-b bg-muted/30">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-primary/20 text-primary hover:bg-primary/30 uppercase text-[9px] font-black">{chart.type}</Badge>
                                        <Badge variant="outline" className="text-[9px] font-bold">Design {chart.design + 1}</Badge>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingChartId(chart.id)}><Settings className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteChart(chart.id)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-8">
                                {renderChart(chart)}
                            </CardContent>
                        </Card>
                    ))}
                </div>
              )}
          </div>
      </main>

      <Dialog open={!!editingChartId} onOpenChange={(open) => !open && setEditingChartId(null)}>
          <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0">
              {editingChart && (
                  <>
                    <DialogHeader className="p-6 border-b bg-muted/20">
                        <div className="flex justify-between items-center">
                            <div>
                                <DialogTitle className="text-2xl font-black">Diagramm bearbeiten</DialogTitle>
                                <DialogDescription>Passe Design und Daten deines Diagramms an.</DialogDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setEditingChartId(null)}><X className="h-5 w-5" /></Button>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        <div className="flex-1 overflow-auto p-6 space-y-8 bg-background">
                            <section className="space-y-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Palette className="w-4 h-4"/> Design & Stil</h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {[0, 1, 2].map(v => (
                                        <button 
                                            key={v}
                                            onClick={() => updateChart(editingChart.id, { design: v })}
                                            className={cn(
                                                "p-4 border-2 rounded-xl text-center space-y-3 transition-all",
                                                editingChart.design === v ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "hover:border-muted-foreground/30"
                                            )}
                                        >
                                            <div className="flex justify-center gap-1">
                                                {COLORS[v].map(c => <div key={c} className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />)}
                                            </div>
                                            <p className="text-[10px] font-bold uppercase">Version {v + 1}</p>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><LayoutGrid className="w-4 h-4"/> Datenpunkte</h3>
                                <div className="space-y-3">
                                    {editingChart.data.map((dp, i) => (
                                        <div key={i} className="flex gap-2 items-center bg-secondary/30 p-3 rounded-xl border animate-in slide-in-from-left-2 duration-200">
                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 flex-1">
                                                <div className="sm:col-span-1"><Label className="text-[9px] font-bold uppercase mb-1">Name</Label><Input value={dp.name} onChange={e => { const newData = [...editingChart.data]; newData[i].name = e.target.value; updateChart(editingChart.id, { data: newData }); }} className="h-8 text-xs font-bold" /></div>
                                                <div><Label className="text-[9px] font-bold uppercase mb-1">Wert 1</Label><Input type="number" value={dp.value} onChange={e => { const newData = [...editingChart.data]; newData[i].value = Number(e.target.value); updateChart(editingChart.id, { data: newData }); }} className="h-8 text-xs" /></div>
                                                <div><Label className="text-[9px] font-bold uppercase mb-1">Wert 2</Label><Input type="number" value={dp.value2 || 0} onChange={e => { const newData = [...editingChart.data]; newData[i].value2 = Number(e.target.value); updateChart(editingChart.id, { data: newData }); }} className="h-8 text-xs" /></div>
                                                <div><Label className="text-[9px] font-bold uppercase mb-1">Wert 3</Label><Input type="number" value={dp.value3 || 0} onChange={e => { const newData = [...editingChart.data]; newData[i].value3 = Number(e.target.value); updateChart(editingChart.id, { data: newData }); }} className="h-8 text-xs" /></div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={editingChart.data.length <= 1} onClick={() => { const newData = editingChart.data.filter((_, idx) => idx !== i); updateChart(editingChart.id, { data: newData }); }}><X className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                    <Button variant="outline" className="w-full border-dashed py-6 gap-2" onClick={() => { const newData = [...editingChart.data, { name: `Label ${editingChart.data.length + 1}`, value: 10, value2: 0, value3: 0 }]; updateChart(editingChart.id, { data: newData }); }}><PlusCircle className="h-4 w-4" /> Punkt hinzufügen</Button>
                                </div>
                            </section>
                        </div>
                        <div className="flex-1 bg-secondary/5 border-l p-6 flex flex-col items-center justify-center space-y-6">
                            <h3 className="text-xs font-black uppercase text-muted-foreground">Live Vorschau</h3>
                            <div className="w-full aspect-square max-w-sm bg-background rounded-3xl shadow-2xl p-6 border flex items-center justify-center">
                                {renderChart(editingChart)}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-4 border-t bg-muted/10">
                        <Button className="w-full font-bold h-12" onClick={() => setEditingChartId(null)}>Fertig & Schließen</Button>
                    </DialogFooter>
                  </>
              )}
          </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Dokument wirklich löschen?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDoc} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
