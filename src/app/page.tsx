"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ZeitplanDashboard from '@/app/components/zeitplan-dashboard';
import ClassicTimetableView from '@/app/components/classic-timetable-view';
import HomeworkPlanner from '@/app/components/homework-planner';
import { Button } from '@/components/ui/button';
import { Home, ListChecks, Sparkles, Settings, Info, Timer } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import SmartToolsView from './components/smart-tools-view';
import SettingsView from './components/settings-view';
import { useTheme } from '@/hooks/use-theme';
import SetupView from './components/setup-view';
import { Loader2 } from 'lucide-react';
import initialTimetableData from "@/app/data/timetable.json";
import previewTimetableData from "@/app/data/preview-timetable.json";
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Link from 'next/link';
import ImpressumPage from './impressum/page';
import DatenschutzPage from './datenschutz/page';
import VokabelPage from './vokabel/page';
import { useAuth, useUser, initiateAnonymousSignIn, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

const APP_VERSION = '1.4.2';

const GeminiSparkle = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24" fill="currentColor" className="inline-block align-baseline ml-1">
        <path d="M12 2.75L13.25 10.75L21.25 12L13.25 13.25L12 21.25L10.75 13.25L2.75 12L10.75 10.75L12 2.75Z" />
    </svg>
);

type TimetableEntry = {
  id: string;
  fach: string;
  lehrer?: string;
  room?: string;
  start: string;
  ende: string;
  hauptfach?: boolean;
  notizen?: string;
  materialien?: string;
};

type TimetableData = {
  [key: string]: TimetableEntry[];
};

type TimetableSettings = {
    schoolStartTime: string;
    schoolEndTime: string;
    firstBreakDuration: number;
    secondBreakDuration: number;
}

type UserSettings = {
    theme?: string;
    startView?: string;
    aiLanguage?: string;
    betaFeaturesEnabled?: boolean;
    profilePicture?: string;
}

type UserData = {
    timetable: TimetableData,
    timetableSettings: TimetableSettings,
    settings: UserSettings,
}

export default function Page() {
    const router = useRouter();
    const { user, isUserLoading } = useUser();

    // Redirect logged-in users to workspace
    useEffect(() => {
        if (!isUserLoading && user && !user.isAnonymous) {
            router.replace('/workspace');
        }
    }, [user, isUserLoading, router]);

    // All hooks for the anonymous view are called here
    const [view, setView] = useState('daily');
    const [showUpdateDialog, setShowUpdateDialog] = useState(false);
    const isMobile = useIsMobile();
    const { setTheme, setStartView: setThemeStartView, setAiLanguage, startView } = useTheme();
    const { toast } = useToast();
    const auth = useAuth();
    const firestore = useFirestore();

    const [localTimetable, setLocalTimetable] = useState(initialTimetableData);
    const [localTimetableSettings, setLocalTimetableSettings] = useState({ schoolStartTime: '08:00', schoolEndTime: '13:00', firstBreakDuration: 15, secondBreakDuration: 15 });
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [isSetupComplete, setIsSetupComplete] = useState(false);
    
    // This effect runs once to check the initial state for anonymous users
    useEffect(() => {
        const localSetupDone = !!localStorage.getItem('isSetupComplete');
        setIsSetupComplete(localSetupDone);

        if (!localSetupDone && auth && !user) {
            initiateAnonymousSignIn(auth);
        }

        const storedTimetable = localStorage.getItem('timetable');
        if (storedTimetable) setLocalTimetable(JSON.parse(storedTimetable));
        
        const storedSettings = localStorage.getItem('timetableSettings');
        if (storedSettings) setLocalTimetableSettings(JSON.parse(storedSettings));

        setView(localStorage.getItem('startView') || 'daily');

    }, [auth, user]);


    const updateLocalData = (data: Partial<UserData>) => {
        if(data.timetable) {
            localStorage.setItem('timetable', JSON.stringify(data.timetable));
            setLocalTimetable(data.timetable);
        }
        if(data.timetableSettings) {
            localStorage.setItem('timetableSettings', JSON.stringify(data.timetableSettings));
            setLocalTimetableSettings(data.timetableSettings);
        }
    }

    const handleSetupComplete = (newUserData: Partial<UserData>) => {
        localStorage.setItem('isSetupComplete', 'true');
        setIsSetupComplete(true);
        updateLocalData(newUserData);
        setView(localStorage.getItem('startView') || 'daily');
    }
  
    const handleTimetableImport = (importedData: any) => {
        if (importedData.timetable) localStorage.setItem('timetable', JSON.stringify(importedData.timetable));
        if (importedData.timetableSettings) localStorage.setItem('timetableSettings', JSON.stringify(importedData.timetableSettings));
        if (importedData.homeworks) localStorage.setItem('homeworks', JSON.stringify(importedData.homeworks));
        if (importedData.theme) setTheme(importedData.theme);
        if (importedData.startView) {
            setThemeStartView(importedData.startView);
            setView(importedData.startView);
        }
        if (importedData.settings?.profilePicture) localStorage.setItem('profilePicture', importedData.settings.profilePicture);
        if (importedData.betaFeaturesEnabled) localStorage.setItem('betaFeaturesEnabled', importedData.betaFeaturesEnabled);
        if (importedData.aiLanguage) setAiLanguage(importedData.aiLanguage as 'German' | 'English');
        
        window.location.reload();
    }

    const handleEditTimetable = () => {
        setView('edit');
    }
  
    const handleNavClick = (newView: string) => {
        setView(newView);
    };

    if (isUserLoading || (user && !user.isAnonymous)) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen bg-background text-foreground p-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary"/>
                <p className="text-muted-foreground mt-4">Weiterleitung zum Workspace...</p>
            </div>
        );
    }
    
    if (!isSetupComplete) {
        return <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} />;
    }

    const renderView = () => {
        switch(view) {
        case 'daily':
            return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={localTimetable} timetableSettings={localTimetableSettings} onTimetableUpdate={(newTimetable) => updateLocalData({ timetable: newTimetable })} />;
        case 'weekly':
            return <ClassicTimetableView setView={setView} isPreview={isPreviewMode} timetable={localTimetable} timetableSettings={localTimetableSettings} />;
        case 'homework':
            return <HomeworkPlanner />;
        case 'smart-tool':
            return <SmartToolsView />;
        case 'settings':
            return <SettingsView onEditTimetable={handleEditTimetable} isPreview={isPreviewMode} onTimetableImport={handleTimetableImport} timetableSettings={localTimetableSettings} onSettingsChange={(newSettings) => updateLocalData({ timetableSettings: newSettings })} />;
        case 'edit':
            return <SetupView onSetupComplete={handleSetupComplete} onTimetableImport={handleTimetableImport} initialData={{timetable: localTimetable, timetableSettings: localTimetableSettings}} isEditing={true} viewMode="edit" />;
        default:
            return <ZeitplanDashboard setView={setView} isPreview={isPreviewMode} timetable={localTimetable} timetableSettings={localTimetableSettings} onTimetableUpdate={(newTimetable) => updateLocalData({ timetable: newTimetable })} />;
        }
    }
  
    const isHomeView = view === 'daily' || view === 'weekly';
  
    return (
        <>
        <main className="container mx-auto p-4 md:p-8 relative min-h-screen pb-24">
            {renderView()}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-8 z-50">
                <div className="bg-background/80 backdrop-blur-sm rounded-full p-2 flex justify-around items-center shadow-lg border">
                <Button
                    variant={isHomeView ? 'secondary' : 'ghost'}
                    size="icon"
                    className="rounded-full h-14 w-14 flex flex-col gap-1"
                    onClick={() => handleNavClick(startView || 'daily')}
                >
                    <Home className="w-5 h-5" />
                    <span className="text-[10px] whitespace-nowrap">Heute</span>
                </Button>
                <Button
                    variant={view === 'homework' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="rounded-full h-14 w-14 flex flex-col gap-1"
                    onClick={() => handleNavClick('homework')}
                >
                    <ListChecks className="w-5 h-5" />
                    <span className="text-[10px] whitespace-nowrap">Aufgaben</span>
                </Button>
                <Button
                    variant={view === 'smart-tool' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="rounded-full h-14 w-14 flex flex-col gap-1"
                    onClick={() => handleNavClick('smart-tool')}
                >
                    <Sparkles className="w-5 h-5" />
                    <span className="text-[10px] whitespace-nowrap">Smart Tools</span>
                </Button>
                <Button
                    variant={view === 'settings' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="rounded-full h-14 w-14 flex flex-col gap-1"
                    onClick={() => handleNavClick('settings')}
                >
                    <Settings className="w-5 h-5" />
                    <span className="text-[10px] whitespace-nowrap">Einst.</span>
                </Button>
                </div>
            </div>
        </main>
        </>
    );
}
