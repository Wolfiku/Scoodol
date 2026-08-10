
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
    PlusCircle, Wand2, MousePointer2, Zap, ChartColumnStacked, BoxSelect
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
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart as RechartsPieChart, Pie, Cell,
    LineChart as RechartsLineChart, Line,
    AreaChart as RechartsAreaChart, Area,
    ScatterChart as RechartsScatterChart, Scatter,
    RadarChart as RechartsRadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar,
    ComposedChart
} from 'recharts';

type ChartType = 'bar' | 'stacked-bar' | 'pie' | 'scatter' | 'area' | 'line' | 'radar' | 'composed' | 'quader';

interface ChartDataPoint {
    name: string;
    value: number;
    value2?: number;
    value3?: number;
}

interface ChartItem {
    id: string;
    type: ChartType;
    design: number; // 0, 1, 2
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

const DESIGNS = [
    { name: 'Bold', colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'] },
    { name: 'Soft', colors: ['#93c5fd', '#a7f3d0', '#fde68a', '#fecaca', '#ddd6fe', '#fbcfe8'] },
    { name: 'Contrast', colors: ['#1e3a8a', '#064e3b', '#78350f', '#7f1d1d', '#4c1d95', '#831843'] },
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
              { name: 'Punkt 1', value: 30, value2: 15, value3: 10 },
              { name: 'Punkt 2', value: 55, value2: 40, value3: 20 },
              { name: 'Punkt 3', value: 45, value2: 60, value3: 35 },
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

  const renderChartContent = (chart: ChartItem) => {
      const design = DESIGNS[chart.design];
      const colors = design.colors;
      const data = chart.data;
      
      const commonProps = { width: "100%", height: 300, data };

      switch(chart.type) {
          case 'bar':
              return (
                <ResponsiveContainer {...commonProps}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
              );
          case 'stacked-bar':
              return (
                <ResponsiveContainer {...commonProps}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Legend iconType="circle" />
                        <Bar dataKey="value" stackId="a" fill={colors[0]} />
                        <Bar dataKey="value2" stackId="a" fill={colors[1]} />
                    </BarChart>
                </ResponsiveContainer>
              );
          case 'pie':
              return (
                <ResponsiveContainer {...commonProps}>
                    <RechartsPieChart>
                        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={DESIGN_MAP[chart.design].outer} innerRadius={DESIGN_MAP[chart.design].inner} paddingAngle={5}>
                            {data.map((_, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="transparent" />)}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" align="center" />
                    </RechartsPieChart>
                </ResponsiveContainer>
              );
          case 'line':
              return (
                <ResponsiveContainer {...commonProps}>
                    <RechartsLineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={4} dot={{ r: 6, fill: colors[0], strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                    </RechartsLineChart>
                </ResponsiveContainer>
              );
          case 'area':
              return (
                <ResponsiveContainer {...commonProps}>
                    <RechartsAreaChart data={data}>
                        <defs>
                            <linearGradient id={`color-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={colors[0]} stopOpacity={0.8}/>
                                <stop offset="95%" stopColor={colors[0]} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={3} fillOpacity={1} fill={`url(#color-${chart.id})`} />
                    </RechartsAreaChart>
                </ResponsiveContainer>
              );
          case 'scatter':
              return (
                <ResponsiveContainer {...commonProps}>
                    <RechartsScatterChart>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis type="category" dataKey="name" fontSize={11} />
                        <YAxis type="number" dataKey="value" fontSize={11} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter name="Werte" data={data} fill={colors[0]}>
                            {data.map((_, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />)}
                        </Scatter>
                    </RechartsScatterChart>
                </ResponsiveContainer>
              );
          case 'radar':
              return (
                <ResponsiveContainer {...commonProps}>
                    <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                        <PolarGrid opacity={0.3} />
                        <PolarAngleAxis dataKey="name" fontSize={10} />
                        <PolarRadiusAxis fontSize={10} />
                        <RechartsRadar name="Werte" dataKey="value" stroke={colors[0]} fill={colors[0]} fillOpacity={0.6} />
                        <Tooltip />
                    </RechartsRadarChart>
                </ResponsiveContainer>
              );
          case 'composed':
              return (
                <ResponsiveContainer {...commonProps}>
                    <ComposedChart data={data}>
                        <CartesianGrid stroke="#f5f5f5" vertical={false} />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="value" fill={colors[5]} stroke={colors[5]} opacity={0.3} />
                        <Bar dataKey="value2" barSize={20} fill={colors[0]} radius={[2, 2, 0, 0]} />
                        <Line type="monotone" dataKey="value3" stroke={colors[2]} strokeWidth={2} />
                    </ComposedChart>
                </ResponsiveContainer>
              );
          case 'quader':
              return (
                <ResponsiveContainer {...commonProps}>
                    <BarChart data={data} barGap={0}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Bar dataKey="value" fill={colors[0]} radius={[2, 2, 0, 0]} stroke={colors[2]} strokeWidth={1} />
                        <Bar dataKey="value2" fill={colors[1]} radius={[2, 2, 0, 0]} stroke={colors[2]} strokeWidth={1} />
                    </BarChart>
                </ResponsiveContainer>
              );
          default:
              return <div className="flex items-center justify-center h-[300px] text-muted-foreground">Typ nicht unterstützt</div>;
      }
  };

  const DESIGN_MAP = [
    { outer: 80, inner: 0 },
    { outer: 80, inner: 40 },
    { outer: 80, inner: 60 }
  ];

  const editingChart = useMemo(() => charts.find(c => c.id === editingChartId), [charts, editingChartId]);

  if (isUserLoading || (isLoadingStat && !isNewStat)) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  if (!isSetupDone) {
    return (
      <div className="container mx-auto p-4 max-w-lg flex flex-col justify-center min-h-screen">
        <Card className="border-2 shadow-2xl animate-in zoom-in duration-300">
          <CardHeader>
            <CardTitle className="text-3xl font-black flex items-center gap-3"><Zap className="text-primary fill-primary" /> Neue Statistik</CardTitle>
            <CardDescription>Wähle einen Modus für deine Datenauswertung.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Titel der Statistik</Label>
              <Input placeholder="z.B. Klassenarbeit Ø 10b" value={title} onChange={e => setTitle(e.target.value)} className="py-7 text-xl font-bold" />
            </div>
            <div className="grid gap-3">
                <Button variant={mode === 'simple' ? 'default' : 'outline'} className="h-24 justify-start px-6 gap-6 rounded-2xl transition-all" onClick={() => setMode('simple')}>
                    <div className="p-3 bg-primary/10 rounded-xl"><MousePointer2 className="w-8 h-8 text-primary" /></div>
                    <div className="text-left"><p className="font-bold text-lg">Simple Mode</p><p className="text-xs opacity-70">Schnelle Diagramme per Klick erstellen.</p></div>
                </Button>
                 <Button variant={mode === 'complex' ? 'default' : 'outline'} className="h-24 justify-start px-6 gap-6 rounded-2xl opacity-50 cursor-not-allowed" onClick={() => {}}>
                    <div className="p-3 bg-secondary rounded-xl"><LayoutGrid className="w-8 h-8" /></div>
                    <div className="text-left"><p className="font-bold text-lg">Complex Mode</p><p className="text-xs opacity-70">Tabellenbasierte Auswertung (bald verfügbar).</p></div>
                </Button>
            </div>
            <Button className="w-full py-8 font-black text-xl rounded-2xl" disabled={!title.trim()} onClick={() => setIsSetupDone(true)}>Editor starten</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="bg-background border-b p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <Button variant="ghost" size="icon" onClick={() => router.push('/workspace')}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex flex-col">
            <Input value={title} onChange={e => { setTitle(e.target.value); triggerAutoSave(); }} className="h-7 text-lg font-bold border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent flex-1" />
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] uppercase font-black px-1.5 h-4">{mode}-Mode</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">• {saveStatus === 'saving' ? <Loader2 className="h-2.5 w-2.5 animate-spin"/> : <Check className="h-2.5 w-2.5"/>}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" className="font-black gap-2 h-9 rounded-full px-5"><Plus className="h-4 w-4" /> Element</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-3 rounded-2xl">
              <DropdownMenuLabel className="text-xs font-black uppercase tracking-tighter text-muted-foreground mb-2">Diagramm-Typ wählen</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="grid grid-cols-3 gap-2 mt-2">
                <DropdownMenuItem onClick={() => addChart('bar')} className="flex flex-col gap-2 items-center p-3 h-auto cursor-pointer rounded-xl hover:bg-primary/5 focus:bg-primary/10 border border-transparent"><BarChart3 className="h-6 w-6 text-primary" /><span className="text-[10px] font-bold">Balken</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('stacked-bar')} className="flex flex-col gap-2 items-center p-3 h-auto cursor-pointer rounded-xl hover:bg-primary/5 focus:bg-primary/10 border border-transparent"><ChartColumnStacked className="h-6 w-6 text-primary" /><span className="text-[10px] font-bold">Turm</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('pie')} className="flex flex-col gap-2 items-center p-3 h-auto cursor-pointer rounded-xl hover:bg-primary/5 focus:bg-primary/10 border border-transparent"><PieChart className="h-6 w-6 text-primary" /><span className="text-[10px] font-bold">Kreis</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('line')} className="flex flex-col gap-2 items-center p-3 h-auto cursor-pointer rounded-xl hover:bg-primary/5 focus:bg-primary/10 border border-transparent"><LineChart className="h-6 w-6 text-primary" /><span className="text-[10px] font-bold">Linie</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('area')} className="flex flex-col gap-2 items-center p-3 h-auto cursor-pointer rounded-xl hover:bg-primary/5 focus:bg-primary/10 border border-transparent"><AreaChart className="h-6 w-6 text-primary" /><span className="text-[10px] font-bold">Fläche</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('radar')} className="flex flex-col gap-2 items-center p-3 h-auto cursor-pointer rounded-xl hover:bg-primary/5 focus:bg-primary/10 border border-transparent"><Radar className="h-6 w-6 text-primary" /><span className="text-[10px] font-bold">Radar</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('scatter')} className="flex flex-col gap-2 items-center p-3 h-auto cursor-pointer rounded-xl hover:bg-primary/5 focus:bg-primary/10 border border-transparent"><ScatterChart className="h-6 w-6 text-primary" /><span className="text-[10px] font-bold">Punkt</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('quader')} className="flex flex-col gap-2 items-center p-3 h-auto cursor-pointer rounded-xl hover:bg-primary/5 focus:bg-primary/10 border border-transparent"><BoxSelect className="h-6 w-6 text-primary" /><span className="text-[10px] font-bold">Quader</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => addChart('composed')} className="flex flex-col gap-2 items-center p-3 h-auto cursor-pointer rounded-xl hover:bg-primary/5 focus:bg-primary/10 border border-transparent"><Layers className="h-6 w-6 text-primary" /><span className="text-[10px] font-bold">Kombi</span></DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={() => setIsDeleteDialogOpen(true)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto bg-secondary/10 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
            {charts.length === 0 ? (
                <div className="text-center py-40 space-y-6 bg-background rounded-3xl border-2 border-dashed border-muted shadow-inner">
                    <div className="p-6 bg-secondary/50 rounded-full w-24 h-24 flex items-center justify-center mx-auto"><BarChart3 className="w-12 h-12 text-muted-foreground opacity-30" /></div>
                    <h2 className="text-2xl font-black text-muted-foreground">Deine Statistik ist leer</h2>
                    <p className="text-muted-foreground max-w-xs mx-auto">Füge oben dein erstes Diagramm hinzu, um mit der Visualisierung deiner Daten zu beginnen.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20">
                    {charts.map((chart) => (
                        <Card key={chart.id} className="group border-2 hover:border-primary/40 transition-all shadow-xl overflow-hidden rounded-3xl bg-card">
                            <CardHeader className="pb-2 border-b bg-muted/20 flex flex-row justify-between items-center space-y-0 px-6">
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="uppercase text-[9px] font-black tracking-widest">{chart.type}</Badge>
                                    <Badge variant="outline" className="text-[9px] uppercase font-bold opacity-60">Design {chart.design + 1}</Badge>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditingChartId(chart.id)}><Settings className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10" onClick={() => deleteChart(chart.id)}><X className="h-4 w-4" /></Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-8 px-6 pb-6 h-[350px] flex items-center justify-center">
                                {renderChartContent(chart)}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
      </main>

      <Dialog open={!!editingChartId} onOpenChange={(open) => !open && setEditingChartId(null)}>
          <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col p-0 rounded-3xl overflow-hidden">
              {editingChart && (
                  <>
                    <DialogHeader className="p-6 border-b bg-background flex flex-row justify-between items-center space-y-0">
                        <div>
                            <DialogTitle className="text-2xl font-black">Daten bearbeiten</DialogTitle>
                            <DialogDescription className="text-xs uppercase tracking-widest font-bold">Element: {editingChart.type}</DialogDescription>
                        </div>
                        <Button variant="outline" onClick={() => setEditingChartId(null)} className="rounded-full h-8 w-8 p-0"><X className="h-4 w-4"/></Button>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        <div className="flex-1 overflow-auto p-8 space-y-10 bg-background border-r">
                            <section className="space-y-4">
                                <Label className="text-xs uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2"><Palette className="w-3 h-3"/> Design-Variante</Label>
                                <div className="grid grid-cols-3 gap-3">
                                    {DESIGNS.map((design, idx) => (
                                        <button 
                                            key={idx} 
                                            onClick={() => updateChart(editingChart.id, { design: idx })} 
                                            className={cn("p-4 border-2 rounded-2xl transition-all text-left group", editingChart.design === idx ? "border-primary bg-primary/5" : "hover:border-primary/20 bg-secondary/20")}
                                        >
                                            <div className="flex gap-1 mb-2">
                                                {design.colors.slice(0, 4).map(c => <div key={c} className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: c }} />)}
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-tighter">{design.name}</p>
                                        </button>
                                    ))}
                                </div>
                            </section>
                            
                            <section className="space-y-4">
                                <Label className="text-xs uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2"><PlusCircle className="w-3 h-3"/> Daten-Tabelle</Label>
                                <div className="space-y-3">
                                    {editingChart.data.map((dp, i) => (
                                        <div key={i} className="flex gap-2 items-center bg-secondary/30 p-3 rounded-2xl border animate-in slide-in-from-left duration-200" style={{ animationDelay: `${i * 50}ms` }}>
                                            <Input 
                                                value={dp.name} 
                                                onChange={e => { const newData = [...editingChart.data]; newData[i].name = e.target.value; updateChart(editingChart.id, { data: newData }); }} 
                                                className="h-10 text-sm font-bold bg-background border-none rounded-xl" 
                                                placeholder="Label"
                                            />
                                            <div className="flex gap-1 items-center">
                                                <Input 
                                                    type="number" 
                                                    value={dp.value} 
                                                    onChange={e => { const newData = [...editingChart.data]; newData[i].value = Number(e.target.value); updateChart(editingChart.id, { data: newData }); }} 
                                                    className="h-10 text-sm w-20 bg-background border-none rounded-xl text-center" 
                                                />
                                                {(editingChart.type === 'stacked-bar' || editingChart.type === 'composed' || editingChart.type === 'quader') && (
                                                    <Input 
                                                        type="number" 
                                                        value={dp.value2 || 0} 
                                                        onChange={e => { const newData = [...editingChart.data]; newData[i].value2 = Number(e.target.value); updateChart(editingChart.id, { data: newData }); }} 
                                                        className="h-10 text-sm w-20 bg-background border-none rounded-xl text-center" 
                                                    />
                                                )}
                                                {editingChart.type === 'composed' && (
                                                    <Input 
                                                        type="number" 
                                                        value={dp.value3 || 0} 
                                                        onChange={e => { const newData = [...editingChart.data]; newData[i].value3 = Number(e.target.value); updateChart(editingChart.id, { data: newData }); }} 
                                                        className="h-10 text-sm w-20 bg-background border-none rounded-xl text-center" 
                                                    />
                                                )}
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-destructive hover:bg-destructive/10" onClick={() => { const newData = editingChart.data.filter((_, idx) => idx !== i); updateChart(editingChart.id, { data: newData }); }}><X className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                    <Button variant="outline" className="w-full border-dashed border-2 py-6 rounded-2xl hover:bg-secondary/50 font-bold" onClick={() => { const newData = [...editingChart.data, { name: `Punkt ${editingChart.data.length + 1}`, value: 10, value2: 5, value3: 0 }]; updateChart(editingChart.id, { data: newData }); }}>
                                        <Plus className="h-4 w-4 mr-2" /> Zeile hinzufügen
                                    </Button>
                                </div>
                            </section>
                        </div>
                        <div className="flex-1 bg-secondary/5 p-8 flex flex-col items-center justify-center">
                            <div className="w-full max-w-md bg-card p-6 rounded-3xl shadow-2xl border-4 border-background">
                                <h3 className="text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground mb-8">Vorschau</h3>
                                {renderChartContent(editingChart)}
                            </div>
                        </div>
                    </div>
                  </>
              )}
          </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl p-8">
          <AlertDialogHeader>
            <div className="p-4 bg-destructive/10 w-fit rounded-full mx-auto mb-4"><Trash2 className="w-8 h-8 text-destructive" /></div>
            <AlertDialogTitle className="text-center text-2xl font-black">Statistik löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-lg">
                Möchtest du die gesamte Statistik "{title}" wirklich endgültig entfernen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-2xl h-12 font-bold flex-1">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (docRef) { await deleteDoc(docRef); toast({ title: 'Gelöscht' }); router.push('/workspace'); } }} className="bg-destructive text-white hover:bg-destructive/90 rounded-2xl h-12 font-bold flex-1">Ja, löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
