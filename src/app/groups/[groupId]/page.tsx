
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Copy, User, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

type Group = {
  name: string;
  schoolName: string;
  motto?: string;
  admin: string;
  members: string[];
}

type MemberProfile = {
  displayName?: string;
  settings?: {
    profilePicture?: string;
  };
}

export default function GroupDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { groupId } = params;
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
  
  useEffect(() => {
    if (typeof window !== 'undefined' && groupId) {
      setInviteLink(`${window.location.origin}/groups/join/${groupId}`);
    }
  }, [groupId]);

  useEffect(() => {
    if (group?.members && firestore) {
      const fetchMembers = async () => {
        setIsLoadingMembers(true);
        const memberPromises = group.members.map(uid => getDoc(doc(firestore, 'users', uid)));
        const memberDocs = await Promise.all(memberPromises);
        const memberProfiles = memberDocs
          .filter(doc => doc.exists())
          .map(doc => doc.data() as MemberProfile);
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

  const isLoading = isUserLoading || isLoadingGroup || isLoadingMembers;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary" /></div>;
  }
  
  if (!user || user.isAnonymous) {
    router.push('/login');
    return null;
  }

  if (!group) {
    return (
      <div className="container mx-auto p-4 text-center">
        <Card>
            <CardHeader>
                <CardTitle>Gruppe nicht gefunden</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Diese Gruppe existiert nicht oder du hast keinen Zugriff.</p>
                <Button onClick={() => router.push('/settings')} className="mt-4">Zurück zu den Einstellungen</Button>
            </CardContent>
        </Card>
      </div>
    );
  }

  const isGroupAdmin = user.uid === group.admin;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
        <Button variant="ghost" onClick={() => router.push('/settings')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zu den Einstellungen
        </Button>
      <header className="mb-8">
        <h1 className="text-4xl font-bold">{group.name}</h1>
        <p className="text-xl text-muted-foreground">{group.schoolName}</p>
        {group.motto && <p className="text-lg italic mt-2">"{group.motto}"</p>}
      </header>
      
      <div className="grid gap-8 md:grid-cols-2">
        {isGroupAdmin && (
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>Gruppe verwalten</CardTitle>
                    <CardDescription>Teile diesen Link, um andere in deine Gruppe einzuladen.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                    <Input value={inviteLink} readOnly />
                    <Button onClick={copyToClipboard} size="icon" className="shrink-0">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </CardContent>
            </Card>
        )}

        <Card>
            <CardHeader>
                <CardTitle>Mitglieder ({group.members.length})</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-72">
                    <div className="space-y-4">
                        {members.map((member, index) => (
                            <div key={index} className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={member.settings?.profilePicture} />
                                    <AvatarFallback><User /></AvatarFallback>
                                </Avatar>
                                <span>{member.displayName || 'Anonymer Nutzer'}</span>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Gruppen-Stundenplan</CardTitle>
                <CardDescription>Dies ist der geteilte Stundenplan für alle Mitglieder.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Vorschau des Stundenplans kommt bald hierher...</p>
                 {isGroupAdmin && (
                    <Button variant="outline" className="mt-4" onClick={() => router.push('/edit/timetable')}>Stundenplan bearbeiten</Button>
                 )}
            </CardContent>
        </Card>

      </div>
    </div>
  );
}
