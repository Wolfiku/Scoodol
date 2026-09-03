
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, Copy, User, Check, Users, Calendar, ListChecks, Plus, Trash2, Camera, Info, GraduationCap, MapPin, Clock, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TimetableEntry = {
    id: string;
    fach: string;
    lehrer?: string;
    room?: string;
    start: string;
    ende: string;
    hauptfach?: boolean;
};

type TimetableData = {
    [key: string]: TimetableEntry[];
};

type GroupRole = 'admin' | 'bearbeiter' | 'berechtigt' | 'nutzer';

type Group = {
  name: string;
  schoolName: string;
  motto?: string;
  admin: string;
  members: string[];
  roles?: Record<string, GroupRole>;
  timetable: TimetableData;
  timetableSettings: any;
}

type MemberProfile = {
  id: string;
  displayName?: string;
  settings?: {
    profilePicture?: string;
  };
}

type GroupHomework = {
    id: string;
    subject: string;
    task: string;
    dueDate: string;
    done: boolean;
    createdBy: string;
    createdByName?: string;
}

export default function GroupDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params?.groupId as string;
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const groupDocRef = useMemoFirebase(() => 
    typeof groupId === 'string' ? doc(firestore, 'groups', groupId) : null
  , [firestore, groupId]);

  const { data: group, isLoading: isLoadingGroup } = useDoc<Group>(groupDocRef);
  
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Homework state
  const [isHwDialogOpen, setIsHwDialogOpen] = useState(false);
  const [newHwSubject, setNewHwSubject] = useState("");
  const [newHwTask, setNewHwTask] = useState("");
  const [newHwDue, setNewHwDue] = useState("");

  const homeworksRef = useMemoFirebase(() => 
    typeof groupId === 'string' ? collection(firestore, `groups/${groupId}/homeworks`) : null
  , [firestore, groupId]);
  const homeworksQuery = useMemoFirebase(() => homeworksRef ? query(homeworksRef, orderBy('dueDate', 'asc')) : null, [homeworksRef]);
  const { data: groupHomeworks, isLoading: isLoadingHw } = useCollection<GroupHomework>(homeworksQuery);

  useEffect(() => {
    if (typeof window !== 'undefined' && groupId) {
      setInviteLink(`${window.location.origin}/groups/join/${groupId}`);
    }
  }, [groupId]);

  useEffect(() => {
    if (group?.members && firestore) {
      const fetchMembers = async () => {
        setIsLoadingMembers(true);
        const memberPromises = group.members.map(async (uid) => {
            const d = await getDoc(doc(firestore, 'users', uid));
            return { id: uid, ...d.data() } as MemberProfile;
        });
        const memberProfiles = await Promise.all(memberPromises);
        setMembers(memberProfiles);
        setIsLoadingMembers(false);
      }
      fetchMembers();
    }
  }, [group, firestore]);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast({ title: 'Kopiert!', description: 'Der Einladungslink wurde in die Zwischenablage kopiert.' });
    setTimeout(() => setCopied(false), 2000);
  }

  const handleAddHw = async () => {
    if (!newHwTask.trim() || !user || !homeworksRef) return;
    
    const newHw = {
        subject: newHwSubject,
        task: newHwTask,
        dueDate: newHwDue,
        done: false,
        createdBy: user.uid,
        createdByName: user.displayName || user.email?.split('@')[0] || "Anonym"
    };

    addDocumentNonBlocking(homeworksRef, newHw);
    toast({ title: "Hausaufgabe geteilt!" });
    setIsHwDialogOpen(false);
    setNewHwSubject(""); setNewHwTask(""); setNewHwDue("");
  }

  const deleteHw = (id: string) => {
      if (!groupDocRef || !firestore) return;
      const hwRef = doc(firestore, `groups/${groupId}/homeworks`, id);
      deleteDocumentNonBlocking(hwRef);
      toast({ title: "Hausaufgabe für alle gelöscht" });
  }

  const handleRoleChange = async (uid: string, newRole: GroupRole) => {
      if (!groupDocRef) return;
      try {
          await updateDoc(groupDocRef, {
              [`roles.${uid}`]: newRole
          });
          toast({ title: "Rolle aktualisiert" });
      } catch (e) {
          toast({ variant: 'destructive', title: "Fehler beim Aktualisieren der Rolle" });
      }
  }

  const isLoading = isUserLoading || isLoadingGroup || isLoadingMembers;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary w-12 h-12" /></div>;
  }
  
  if (!user || user.isAnonymous) {
    router.push('/login');
    return null;
  }

  if (!group) {
    return (
      <div className="container mx-auto p-4 text-center">
        <Card className="max-w-md mx-auto">
            <CardHeader>
                <CardTitle>Gruppe nicht gefunden</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Diese Gruppe existiert nicht oder du hast keinen Zugriff.</p>
                <Button onClick={() => router.push('/')} className="mt-4 w-full">Zurück zum Dashboard</Button>
            </CardContent>
        </Card>
      </div>
    );
  }

  const userRole = (group.roles && group.roles[user.uid]) || 'nutzer';
  const isGroupAdmin = userRole === 'admin';
  const canEditTimetable = userRole === 'admin' || userRole === 'bearbeiter';
  const canManageHomework = userRole === 'admin' || userRole === 'bearbeiter' || userRole === 'berechtigt';

  const todayName = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][new Date().getDay()];
  const todaySchedule = group.timetable?.[todayName] || [];

  const getRoleIcon = (role: GroupRole) => {
      switch(role) {
          case 'admin': return <ShieldAlert className="h-3 w-3 text-red-500" />;
          case 'bearbeiter': return <ShieldCheck className="h-3 w-3 text-blue-500" />;
          case 'berechtigt': return <Shield className="h-3 w-3 text-green-500" />;
          default: return <Shield className="h-3 w-3 text-muted-foreground" />;
      }
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl pb-24">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-4xl font-black tracking-tight">{group.name}</h1>
                    <div className="flex items-center gap-2 text-muted-foreground mt-1">
                        <GraduationCap className="h-4 w-4" />
                        <span>{group.schoolName}</span>
                    </div>
                </div>
            </div>
            <div className="flex flex-col items-end gap-1">
                <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>{group.members.length} Mitglieder</span>
                </Badge>
                <div className="flex items-center gap-1 text-[10px] uppercase font-black text-muted-foreground">
                    Deine Rolle: <span className="text-primary">{userRole}</span>
                </div>
            </div>
        </div>

        {group.motto && (
            <div className="bg-primary/5 border-l-4 border-primary p-4 rounded-r-lg mb-8 italic text-lg text-primary/80">
                "{group.motto}"
            </div>
        )}
      
      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="timetable">Stundenplan</TabsTrigger>
            <TabsTrigger value="homework">Hausaufgaben</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
            <div className="grid gap-8 md:grid-cols-2">
                <Card className="md:col-span-2 border-primary/20 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-primary" />
                            Gruppe teilen
                        </CardTitle>
                        <CardDescription>Lade deine Mitschüler mit diesem Link in die Gruppe ein.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative flex-1 w-full">
                            <Input value={inviteLink} readOnly className="pr-10 bg-secondary/30" />
                            <Users className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        </div>
                        <Button onClick={copyToClipboard} className="shrink-0 w-full sm:w-auto font-bold gap-2">
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            Link kopieren
                        </Button>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            Heute ({todayName})
                        </CardTitle>
                        <CardDescription>Die nächsten Stunden laut Gruppen-Plan.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-64 pr-4">
                            <div className="space-y-3">
                                {todaySchedule.length > 0 ? (
                                    todaySchedule
                                        .filter(e => e.fach && e.fach !== 'Pause')
                                        .map((entry, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-transparent hover:border-primary/20 transition-all">
                                            <div className="flex-1">
                                                <p className="font-bold text-lg">{entry.fach}</p>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {entry.start} - {entry.ende}</span>
                                                    {entry.room && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {entry.room}</span>}
                                                </div>
                                            </div>
                                            {entry.hauptfach && <Badge variant="default" className="text-[9px] uppercase font-black px-1.5 h-4">HF</Badge>}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-muted-foreground">
                                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p>Kein Unterricht am heutigen Tag.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            Mitglieder ({members.length})
                        </CardTitle>
                        <CardDescription>Hier siehst du, wer in der Gruppe ist.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-64 pr-4">
                            <div className="space-y-4">
                                {members.map((member) => {
                                    const mRole = (group.roles && group.roles[member.id]) || 'nutzer';
                                    return (
                                        <div key={member.id} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 border-2 border-background ring-2 ring-primary/5">
                                                    <AvatarImage src={member.settings?.profilePicture} />
                                                    <AvatarFallback className="bg-primary/10 text-primary"><User className="h-5 w-5" /></AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-bold text-sm leading-tight">{member.displayName || 'Anonymer Nutzer'}</p>
                                                    <div className="flex items-center gap-1 text-[9px] uppercase font-black text-muted-foreground mt-0.5">
                                                        {getRoleIcon(mRole)}
                                                        {mRole}
                                                    </div>
                                                </div>
                                            </div>
                                            {isGroupAdmin && member.id !== user.uid ? (
                                                <Select value={mRole} onValueChange={(v: GroupRole) => handleRoleChange(member.id, v)}>
                                                    <SelectTrigger className="h-7 text-[10px] w-32 font-bold uppercase rounded-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                        <SelectItem value="bearbeiter">Bearbeiter</SelectItem>
                                                        <SelectItem value="berechtigt">Berechtigt</SelectItem>
                                                        <SelectItem value="nutzer">Nutzer</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <div className="h-2 w-2 rounded-full bg-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="timetable" className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Gruppen-Stundenplan</CardTitle>
                        <CardDescription>Dieser Plan gilt für alle Mitglieder der Gruppe.</CardDescription>
                    </div>
                    {canEditTimetable && (
                        <Button variant="outline" onClick={() => router.push(`/edit/timetable?groupId=${groupId}`)} className="font-bold">
                            Plan bearbeiten
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="p-8 text-center bg-secondary/30 rounded-3xl border-2 border-dashed">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="text-xl font-bold mb-2">Synchronisierter Plan</p>
                        <p className="text-muted-foreground max-w-sm mx-auto">Dein persönlicher Stundenplan wird automatisch mit diesem Plan aktualisiert, wenn die Kopplung in den Einstellungen aktiv ist.</p>
                        <Button className="mt-6" variant="secondary" onClick={() => router.push('/')}>In der Hauptansicht anzeigen</Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="homework" className="space-y-6">
            <Card className="border-accent/20">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ListChecks className="h-5 w-5 text-accent" />
                            Gemeinsame Hausaufgaben
                        </CardTitle>
                        <CardDescription>Aufgaben, die von Mitgliedern für die ganze Klasse geteilt wurden.</CardDescription>
                    </div>
                    {canManageHomework && (
                        <Dialog open={isHwDialogOpen} onOpenChange={setIsHwDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-accent hover:bg-accent/90 text-white font-bold">
                                    <Plus className="mr-2 h-4 w-4" /> Aufgabe teilen
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Hausaufgabe für die Gruppe hinzufügen</DialogTitle>
                                    <DialogDescription>Diese Aufgabe wird für alle Mitglieder in diesem Dashboard sichtbar.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Fach</Label>
                                        <Input placeholder="z.B. Mathe" value={newHwSubject} onChange={e => setNewHwSubject(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Aufgabe</Label>
                                        <Textarea placeholder="Was ist zu tun?" value={newHwTask} onChange={e => setNewHwTask(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fällig am</Label>
                                        <Input type="date" value={newHwDue} onChange={e => setNewHwDue(e.target.value)} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsHwDialogOpen(false)}>Abbrechen</Button>
                                    <Button onClick={handleAddHw} className="bg-accent text-white">Jetzt teilen</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4">
                        {groupHomeworks && groupHomeworks.length > 0 ? (
                            groupHomeworks.map(hw => (
                                <div key={hw.id} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/50 border hover:shadow-sm transition-all group">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge className="bg-accent/10 text-accent border-accent/20 hover:bg-accent/20">{hw.subject || 'Allgemein'}</Badge>
                                            {hw.dueDate && <span className="text-[10px] font-black uppercase text-muted-foreground">Fällig: {new Date(hw.dueDate).toLocaleDateString('de-DE')}</span>}
                                        </div>
                                        <p className="font-bold text-lg leading-tight mb-2">{hw.task}</p>
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                            <User className="h-3 w-3" />
                                            Geteilt von {hw.createdByName}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {canManageHomework && (
                                            <Button variant="ghost" size="icon" onClick={() => deleteHw(hw.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button variant="secondary" size="sm" className="font-bold rounded-xl" onClick={() => {
                                             if (!firestore) return;
                                             const userHwRef = collection(firestore, `users/${user.uid}/homeworks`);
                                             addDocumentNonBlocking(userHwRef, {
                                                 subject: hw.subject,
                                                 task: hw.task,
                                                 dueDate: hw.dueDate,
                                                 done: false,
                                                 groupHwId: hw.id
                                             });
                                             toast({ title: "In deinen Planer kopiert!" });
                                        }}>
                                            Hinzufügen
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 bg-background/50 rounded-2xl border-2 border-dashed">
                                <Info className="w-10 h-10 mx-auto mb-4 opacity-20 text-accent" />
                                <p className="font-bold text-xl mb-1">Noch keine Aufgaben</p>
                                <p className="text-sm text-muted-foreground">Teile Aufgaben, damit sie hier für alle erscheinen.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
