
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2, ArrowLeft } from 'lucide-react';
import SetupView from '@/app/components/setup-view';
import { Button } from '@/components/ui/button';

/**
 * Editor-Seite für den Stundenplan.
 * Unterstützt das Bearbeiten des persönlichen Plans sowie von Gruppen-Plänen.
 */
function EditContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const groupId = searchParams.get('groupId');
  
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // Bestimme das Ziel-Dokument (Nutzer oder Gruppe)
  const targetDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    if (groupId) return doc(firestore, 'groups', groupId);
    return doc(firestore, 'users', user.uid);
  }, [firestore, user, groupId]);

  const { data: targetData, isLoading: isTargetDataLoading } = useDoc<any>(targetDocRef);

  const handleSetupComplete = async (newData: any) => {
    if (!targetDocRef) return;
    
    // Bereite die zu speichernden Daten vor
    const cleanData: any = {
        timetable: newData.timetable,
        timetableSettings: newData.timetableSettings
    };

    // Profilbild nur speichern, wenn es sich um ein Nutzerprofil handelt
    if (!groupId && newData.settings?.profilePicture) {
        cleanData.settings = { 
            ...targetData?.settings,
            profilePicture: newData.settings.profilePicture 
        };
    }

    try {
        await setDoc(targetDocRef, cleanData, { merge: true });
        
        if (groupId) {
            router.push(`/groups/${groupId}`);
        } else {
            router.push('/');
        }
    } catch (e) {
        console.error("Fehler beim Speichern des Stundenplans:", e);
    }
  };

  const handleTimetableImport = async (importedData: any) => {
    if (!targetDocRef) return;
    try {
        await setDoc(targetDocRef, {
            timetable: importedData.timetable,
            timetableSettings: importedData.timetableSettings,
        }, { merge: true });
        window.location.reload();
    } catch (e) {
        console.error("Fehler beim Importieren:", e);
    }
  };

  if (isUserLoading || (user && isTargetDataLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary w-12 h-12" />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (id === 'timetable') {
      return (
        <div className="min-h-screen bg-background pb-20">
             <SetupView 
                onSetupComplete={handleSetupComplete} 
                onTimetableImport={handleTimetableImport} 
                initialData={{ 
                    timetable: targetData?.timetable, 
                    timetableSettings: targetData?.timetableSettings,
                    settings: targetData?.settings
                }} 
                isEditing={true} 
                viewMode="edit" 
            />
        </div>
      )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Unbekannter Editor-Typ: {id}</h1>
        <Button onClick={() => router.push('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Zurück zur App
        </Button>
    </div>
  );
}

export default function EditPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary w-12 h-12" /></div>}>
            <EditContent />
        </Suspense>
    );
}
