<div align="center">

# Scoodol
 
**Der smarte Begleiter für den modernen Schulalltag.**
 
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://scoodol.app)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg)](https://www.typescriptlang.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-100%25_Offline-success.svg)](https://scoodol.app)
[![License](https://img.shields.io/badge/license-wk--lc--04-orange.svg)](./LICENSE.md)
 
**Live-Version:** [scoodol.app](https://scoodol.app)
 
</div>

---
 
## Über Scoodol
 
Scoodol ist eine moderne Progressive Web App (PWA) für Schülerinnen und Schüler. Sie vereint Stundenplan, Hausaufgabenverwaltung, Notenberechnung und weitere Lernwerkzeuge in einer einzigen, durchdachten Oberfläche.
 
Die Anwendung ist auf drei Kernprinzipien ausgelegt:
 
- **Performance** – Cache-First-Architektur für nahezu verzögerungsfreies Laden
- **Offline-Fähigkeit** – vollständige Funktionalität ohne aktive Internetverbindung
- **Datenschutz** – Daten bleiben, wo immer möglich, lokal auf dem Gerät

---
 
## Features
 
### Stundenplan
 
- **Tages-Dashboard:** Zeigt die aktuelle und nächste Schulstunde inklusive Countdown und Pausenstatus.
- **Wochenansicht:** Klassisches Wochenraster mit Raum, Lehrkraft, Notizen und farblicher Kennzeichnung.
- **A/B-Wochen:** Unterstützung für 2-Wochen-Rhythmen mit automatischem oder manuellem Umschalten.
- **Flexible Schulzeiten:** Konfigurierbare Startzeiten, Stundendauern und Pausenlängen.

### Nachmittagsunterricht
 
Eigene Nachmittagsfächer (7.–10. Stunde) lassen sich unabhängig verwalten – auch wenn der Hauptstundenplan mit einer Klasse synchronisiert ist.
 
### Hausaufgaben-Planer
 
- **Cache-First Loading:** Aufgaben werden ohne Ladeverzögerung angezeigt.
- **Fach-Gruppierung:** Automatische Sortierung nach Unterrichtsfächern.
- **Schnellwahl für Fälligkeiten:** Ein-Klick-Auswahl für „Morgen", „Übermorgen" oder den nächsten Unterrichtstermin des Fachs.
- **Klassen-Freigabe:** Aufgaben lassen sich innerhalb einer Gruppe mit Mitschülern teilen.

### Fokus-Modus
 
Konzentrierte Lerneinheiten für anstehende Aufgaben mit Timer und Abschluss-Signal.
 
### Offline-PWA
 
Installierbar als native App auf iOS, Android, Windows und macOS. Läuft vollständig offline; alle Daten werden lokal gesichert.
 
### Schul-Tools & Workspace
 
- **Notenrechner:** Schnelle Berechnung des Notendurchschnitts inklusive Gewichtung.
- **Formelsammlung:** Referenz für Mathematik und Physik.
- **Periodensystem:** Interaktive Übersicht der chemischen Elemente.
- **Vokabeltrainer & Quiz:** Erstellung eigener Vokabellisten mit interaktiver Abfrage.
- **Workspace:** Notizen, Dokumente, Präsentationen und Todo-Listen.

---
 
## Schnellstart & Installation
 
### Voraussetzungen
 
- [Node.js](https://nodejs.org/) (Version 18 oder höher)
- [npm](https://www.npmjs.com/) oder [pnpm](https://pnpm.io/)

### 1. Repository klonen
 
```bash
git clone https://github.com/Wolfiku/Scoodol.git
cd Scoodol
```
 
### 2. Abhängigkeiten installieren
 
```bash
npm install
```
 
### 3. Umgebungsvariablen einrichten (optional)
 
```bash
cp .env.example .env.local
```
 
### 4. Entwicklungsserver starten
 
```bash
npm run dev
```
 
Anschließend [http://localhost:3000](http://localhost:3000) im Browser öffnen.
 
### 5. Produktions-Build
 
```bash
npm run build
npm run start
```
 
---
 
## Tech Stack
 
| Bereich | Technologie |
|---|---|
| Framework | [Next.js 15](https://nextjs.org/) (App Router, Server Actions) |
| Frontend | [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/) |
| Icons | [Lucide React](https://lucide.dev/) |
| PWA & Offline | [@ducanh2912/next-pwa](https://github.com/ducanh2912/next-pwa), Workbox |
| Datenbank & Auth | [Firebase](https://firebase.google.com/) (Firestore, Firebase Auth) |
 
---
 
## Lizenz & Urheberrecht
 
Dieses Projekt steht unter der **wk-lc-04** (Wolfiku Custom Non-Commercial License, v0.4).
 
**Erlaubt:**
- Private, schulische und nicht-kommerzielle Nutzung
- Wiederverwendung von Komponenten und Code-Ausschnitten mit Namensnennung
- Forken und substanzielle Weiterentwicklung mit Namensnennung

**Nicht erlaubt:**
- Kommerzielle Nutzung (Verkauf, SaaS, Werbung) ohne ausdrückliche Genehmigung
- Reines Rebranding als „neues" Produkt ohne wesentliche eigene Entwicklungsleistung

**Namensnennung:** Bei jeder Nutzung oder Weiterverbreitung müssen der Autor (**Wolfiku**) und das Originalprojekt ([scoodol.app](https://scoodol.app)) sichtbar genannt werden.
 
Der vollständige Lizenztext befindet sich in [`LICENSE.md`](./LICENSE.md).
 
---
 
<div align="center">

Entwickelt von **Wolfiku** · [scoodol.app](https://scoodol.app)
 
</div>
