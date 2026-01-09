
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Share, Download, Mail, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type QuickNote = {
  title: string;
  content: string;
}

type ShareNoteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: QuickNote;
}

export default function ShareNoteDialog({ open, onOpenChange, note }: ShareNoteDialogProps) {
  const { toast } = useToast();

  const handleShare = (platform: 'whatsapp' | 'email') => {
    const text = `${note.title}\n\n${note.content}`;
    let url = '';

    if (platform === 'whatsapp') {
      url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    } else if (platform === 'email') {
      url = `mailto:?subject=${encodeURIComponent(note.title)}&body=${encodeURIComponent(note.content)}`;
    }

    window.open(url, '_blank');
    onOpenChange(false);
  };

  const handleExport = () => {
    const fileContent = JSON.stringify({
      title: note.title,
      content: note.content,
      exportedAt: new Date().toISOString(),
    }, null, 2);

    const blob = new Blob([fileContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const sanitizedTitle = note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${sanitizedTitle || 'note'}.sc`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Notiz exportiert!", description: `Deine Notiz wurde als ${link.download} gespeichert.` });
    onOpenChange(false);
  }

  const handleCopyToClipboard = () => {
    const text = `${note.title}\n\n${note.content}`;
    navigator.clipboard.writeText(text).then(() => {
        toast({ title: 'Kopiert!', description: 'Der Notizinhalt wurde in die Zwischenablage kopiert.' });
        onOpenChange(false);
    }, () => {
        toast({ variant: 'destructive', title: 'Fehler', description: 'Kopieren fehlgeschlagen.' });
    });
  }

  const shareOptions = [
    {
      title: "Auf Scoodol teilen",
      description: "Sende an einen Chat oder eine Gruppe (bald verfügbar)",
      icon: <MessageSquare className="w-8 h-8 text-primary" />,
      action: () => {},
      disabled: true,
    },
    {
      title: "Per WhatsApp senden",
      description: "Teile die Notiz als Textnachricht",
      icon: <Share className="w-8 h-8 text-green-500" />,
      action: () => handleShare('whatsapp'),
      disabled: false,
    },
     {
      title: "Per E-Mail senden",
      description: "Öffnet deinen Standard-Mail-Client",
      icon: <Mail className="w-8 h-8 text-blue-500" />,
      action: () => handleShare('email'),
      disabled: false,
    },
    {
      title: "Als .sc-Datei exportieren",
      description: "Lade eine Scoodol-Notizdatei herunter",
      icon: <Download className="w-8 h-8" />,
      action: handleExport,
      disabled: false,
    },
    {
      title: "In Zwischenablage kopieren",
      description: "Kopiere den gesamten Notiztext",
      icon: <Copy className="w-8 h-8" />,
      action: handleCopyToClipboard,
      disabled: false,
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-full sm:w-full h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Notiz teilen</DialogTitle>
          <DialogDescription>
            Wähle eine Option, um deine Notiz "{note.title}" zu teilen oder zu exportieren.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 flex-1 overflow-y-auto">
          {shareOptions.map((opt, index) => (
            <button
              key={index}
              onClick={opt.action}
              disabled={opt.disabled}
              className={cn(
                "flex items-start gap-4 p-4 border rounded-lg text-left transition-colors hover:bg-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <div className="p-2 bg-secondary rounded-md">
                {opt.icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{opt.title}</p>
                <p className="text-sm text-muted-foreground">{opt.description}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
