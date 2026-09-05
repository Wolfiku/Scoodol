
'use client';

import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, useStorage } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, increment, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { 
    Loader2, ArrowLeft, Upload, Trash2, ImageIcon, Video, 
    HardDrive, Search, Filter, PlayCircle, Eye, Plus
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface MediaFile {
    id: string;
    name: string;
    url: string;
    type: 'image' | 'video';
    size: number;
    fullPath: string;
    createdAt: any;
}

const STORAGE_LIMIT_BYTES = 3 * 1024 * 1024 * 1024; // 3GB

export default function GalleryPage() {
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();

    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const userDocRef = useMemoFirebase(() => 
        user ? doc(firestore, 'users', user.uid) : null
    , [firestore, user]);
    const { data: userProfile } = useDoc<any>(userDocRef);

    const mediaRef = useMemoFirebase(() => 
        user ? collection(firestore, `users/${user.uid}/media`) : null
    , [firestore, user]);
    const mediaQuery = useMemoFirebase(() => 
        mediaRef ? query(mediaRef, orderBy('createdAt', 'desc')) : null
    , [mediaRef]);
    const { data: files, isLoading: isLoadingMedia } = useCollection<MediaFile>(mediaQuery);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user || !userDocRef || !mediaRef) return;

        const currentUsage = userProfile?.storageUsage || 0;
        if (currentUsage + file.size > STORAGE_LIMIT_BYTES) {
            toast({ variant: 'destructive', title: 'Speicher voll', description: 'Du hast dein Limit von 3 GB erreicht.' });
            return;
        }

        const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
        if (!type) {
            toast({ variant: 'destructive', title: 'Dateityp nicht unterstützt', description: 'Bitte lade nur Bilder oder Videos hoch.' });
            return;
        }

        const storageRefPath = `users/${user.uid}/media/${Date.now()}_${file.name}`;
        const fileRef = ref(storage, storageRefPath);
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            }, 
            (error) => {
                toast({ variant: 'destructive', title: 'Upload fehlgeschlagen', description: error.message });
                setUploadProgress(null);
            }, 
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                
                // Track in Firestore
                await addDoc(mediaRef, {
                    name: file.name,
                    url: downloadURL,
                    type,
                    size: file.size,
                    fullPath: storageRefPath,
                    createdAt: serverTimestamp()
                });

                // Update usage
                await updateDoc(userDocRef, { storageUsage: increment(file.size) });
                
                setUploadProgress(null);
                toast({ title: 'Datei zur Galerie hinzugefügt!' });
            }
        );
        event.target.value = '';
    };

    const handleDelete = async (file: MediaFile) => {
        if (!user || !userDocRef) return;

        try {
            // Delete from Storage
            const fileRef = ref(storage, file.fullPath);
            await deleteObject(fileRef);

            // Delete from Firestore
            await deleteDoc(doc(firestore, `users/${user.uid}/media`, file.id));

            // Decrease usage
            await updateDoc(userDocRef, { storageUsage: increment(-file.size) });

            toast({ title: 'Datei gelöscht' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Fehler beim Löschen', description: error.message });
        }
    };

    const filteredFiles = useMemo(() => {
        if (!files) return [];
        return files.filter(f => {
            const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = filterType === 'all' || f.type === filterType;
            return matchesSearch && matchesType;
        });
    }, [files, searchTerm, filterType]);

    const usedMB = Math.round((userProfile?.storageUsage || 0) / 1024 / 1024);
    const limitMB = Math.round(STORAGE_LIMIT_BYTES / 1024 / 1024);
    const usagePercentage = Math.min(100, (usedMB / limitMB) * 100);

    if (isUserLoading || isLoadingMedia) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/workspace')} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight">Galerie</h1>
                        <p className="text-muted-foreground mt-1">Verwalte deine Bilder und Videos für Präsentationen.</p>
                    </div>
                </div>

                <div className="w-full md:w-80 space-y-2 bg-secondary/20 p-4 rounded-2xl border">
                    <div className="flex justify-between items-center text-xs font-black uppercase text-muted-foreground">
                        <span className="flex items-center gap-1.5"><HardDrive className="h-3 w-3" /> Speicherplatz</span>
                        <span className={cn(usagePercentage > 90 ? "text-destructive" : "text-primary")}>
                            {usedMB} MB / {limitMB} MB
                        </span>
                    </div>
                    <Progress value={usagePercentage} className="h-2" />
                </div>
            </header>

            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Dateien durchsuchen..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 h-12 rounded-xl"
                    />
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant={filterType === 'all' ? 'default' : 'outline'} 
                        onClick={() => setFilterType('all')}
                        className="h-12 rounded-xl px-6 font-bold"
                    >Alle</Button>
                    <Button 
                        variant={filterType === 'image' ? 'default' : 'outline'} 
                        onClick={() => setFilterType('image')}
                        className="h-12 rounded-xl px-6 font-bold gap-2"
                    ><ImageIcon className="h-4 w-4" /> Bilder</Button>
                    <Button 
                        variant={filterType === 'video' ? 'default' : 'outline'} 
                        onClick={() => setFilterType('video')}
                        className="h-12 rounded-xl px-6 font-bold gap-2"
                    ><Video className="h-4 w-4" /> Videos</Button>
                </div>
                <Button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={uploadProgress !== null}
                    className="h-12 rounded-xl px-8 font-black gap-2 bg-primary shadow-lg shadow-primary/20"
                >
                    {uploadProgress !== null ? <Loader2 className="animate-spin h-5 w-5" /> : <Upload className="h-5 w-5" />}
                    {uploadProgress !== null ? `${Math.round(uploadProgress)}%` : 'Hochladen'}
                </Button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,video/*" />
            </div>

            {filteredFiles.length === 0 ? (
                <div className="p-20 text-center bg-secondary/10 rounded-3xl border-2 border-dashed flex flex-col items-center gap-4">
                    <div className="p-6 bg-secondary rounded-full">
                        <ImageIcon className="h-12 w-12 text-muted-foreground opacity-30" />
                    </div>
                    <h2 className="text-2xl font-bold">Keine Medien gefunden</h2>
                    <p className="text-muted-foreground max-w-xs mx-auto">Lade deine ersten Bilder oder Videos hoch, um sie in deinen Projekten zu verwenden.</p>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="mt-2 font-bold">Jetzt Datei wählen</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredFiles.map((file) => (
                        <Card key={file.id} className="group overflow-hidden rounded-2xl border-2 hover:border-primary/40 transition-all shadow-sm">
                            <div className="aspect-video relative bg-muted flex items-center justify-center overflow-hidden">
                                {file.type === 'image' ? (
                                    <img src={file.url} className="w-full h-full object-cover" alt={file.name} />
                                ) : (
                                    <video src={file.url} className="w-full h-full object-cover" />
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button variant="secondary" size="icon" className="rounded-full" onClick={() => window.open(file.url, '_blank')}>
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button variant="destructive" size="icon" className="rounded-full" onClick={() => handleDelete(file)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                {file.type === 'video' && <div className="absolute bottom-2 right-2 p-1 bg-black/60 rounded-md"><PlayCircle className="h-4 w-4 text-white" /></div>}
                            </div>
                            <CardContent className="p-4">
                                <p className="font-bold truncate text-sm" title={file.name}>{file.name}</p>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-[10px] text-muted-foreground font-medium">
                                        {file.createdAt ? formatDistanceToNow(new Date(file.createdAt.seconds * 1000), { addSuffix: true, locale: de }) : 'Gerade eben'}
                                    </span>
                                    <Badge variant="secondary" className="text-[9px] uppercase font-black px-1.5 h-4">
                                        {Math.round(file.size / 1024 / 1024 * 100) / 100} MB
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
