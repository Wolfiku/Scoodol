<div align="center">

# 🎓 Scoodol

**Dein smarter Begleiter für den modernen Schulalltag.**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://scoodol.app)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg)](https://www.typescriptlang.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-100%25_Offline-success.svg)](https://scoodol.app)
[![License](https://img.shields.io/badge/license-wk--lc--04-orange.svg)](./LICENSE)

🌐 **Live-Version:** [scoodol.app](https://scoodol.app)

</div>

---

## 📖 Über Scoodol

**Scoodol** ist eine moderne, blitzschnelle Progressive Web App (PWA) für Schülerinnen und Schüler. Sie vereint Stundenplan, Hausaufgabenverwaltung, Notenberechnung und smarte Lernwerkzeuge in einem durchdachten, minimalistischen Interface.

Entwickelt mit Fokus auf **Performance (0ms Latenz durch Cache-First-Architektur)**, **100% Offline-Fähigkeit** und **echtem Datenschutz**.

---

## ✨ Features

### 📅 Smarter Stundenplan
- **Tages-Dashboard:** Automatische Anzeige der aktuellen und nächsten Schulstunde mit Countdown und Pausenstatus.
- **Wochenansicht:** Klassisches Wochenraster mit Raum, Lehrer, Notizen und Farbakzenten.
- **A/B-Wochen:** Volle Unterstützung für 2-Wochen-Rhythmen mit automatischem oder manuellem Umschalten.
- **Flexible Schulzeiten:** Konfigurierbare Startzeiten, Stundendauern und Pausen.

### 🕒 Persönlicher Nachmittagsunterricht
- Verwalte deine eigenen Nachmittagsfächer (7.–10. Stunde) flexibel.
- Funktioniert nahtlos auch dann, wenn der Haupt-Stundenplan mit einer Klasse synchronisiert ist.

### 📝 Hausaufgaben-Planer
- **Cache-First Instant Loading:** Lädt Aufgaben ohne Verzögerung oder störende Ladebalken.
- **Fach-Gruppierung:** Automatische Gruppierung nach Unterrichtsfächern.
- **Schnellwahl für Fälligkeiten:** Ein-Klick-Auswahl für „Morgen“, „Übermorgen“ oder den nächsten Unterrichtstermin des Fachs.
- **Klassen-Freigabe:** Teile Aufgaben mit deinen Mitschülern in einer Gruppe.

### 🎯 Fokus-Modus
- Konzentrierte Lerneinheiten für anstehende Aufgaben mit Timer und Abschluss-Sounds.

### ⚡ 100% Offline PWA
- Installierbar als native App auf iOS, Android, Windows und macOS.
- Funktioniert komplett ohne Internetverbindung – alle Daten werden lokal gesichert.

### 🛠️ Smarte Schul-Tools & Workspace
- **Notenrechner:** Schnelle Berechnung deines Notendurchschnitts mit Gewichtung.
- **Formelsammlung:** Umfassende Sammlung für Mathematik und Physik.
- **Periodensystem:** Interaktive Übersicht der chemischen Elemente.
- **Vokabeltrainer & Quiz:** Eigene Vokabellisten erstellen und interaktiv abfragen.
- **Workspace:** Notizen, Dokumente, Präsentationen und Todo-Listen.

---

## 🚀 Schnellstart & Installation

### Voraussetzungen
- [Node.js](https://nodejs.org/) (Version 18 oder höher)
- [npm](https://www.npmjs.com/) oder [pnpm](https://pnpm.io/)

### 1. Repository klonen
```bash
git clone https://github.com/DEIN-BENUTZERNAME/scoodol.git
cd scoodol
```

### 2. Abhängigkeiten installieren
```bash
npm install
```

### 3. Umgebungsvariablen einrichten (Optional)
Kopiere die Beispieldatei:
```bash
cp .env.example .env.local
```

### 4. Entwicklungsserver starten
```bash
npm run dev
```
Öffne [http://localhost:3000](http://localhost:3000) in deinem Browser.

### 5. Für Produktion bauen
```bash
npm run build
npm run start
```

---

## 🏗️ Tech Stack

| Bereich | Technologie |
|---|---|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router, Server Actions) |
| **Frontend** | [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **PWA & Offline** | [@ducanh2912/next-pwa](https://github.com/ducanh2912/next-pwa), Workbox |
| **Datenbank & Auth** | [Firebase](https://firebase.google.com/) (Firestore, Firebase Auth) |

---

## 📜 Lizenz & Urheberrecht

Dieses Projekt ist lizenziert unter der **wk-lc-04** (Wolfgang's Custom Non-Commercial License, v0.4).

- ✅ **Erlaubt:** Private, schulische und nicht-kommerzielle Nutzung.
- ✅ **Erlaubt:** Wiederverwendung von Komponenten und Code-Ausschnitten mit Namensnennung.
- ✅ **Erlaubt:** Forken und substanzielles Weiterentwickeln mit Namensnennung.
- ❌ **Nicht erlaubt:** Kommerzielle Nutzung (Verkauf, SaaS, Werbung) ohne ausdrückliche Genehmigung.
- ❌ **Nicht erlaubt:** Reines Rebranding als „neues“ Produkt ohne wesentliche eigene Entwicklungsleistung.

> **Attribution Requirement:**  
> Bei jeder Nutzung oder Weiterverbreitung muss der Autor (**Wolfiku**) und das Originalprojekt (**[scoodol.app](https://scoodol.app)**) sichtbar genannt werden.

Den vollständigen Lizenztext findest du in der Datei [`LICENSE`](./LICENSE).

---

<div align="center">

Erstellt mit ❤️ von **Wolfiku** · Live unter **[scoodol.app](https://scoodol.app)**

</div>
