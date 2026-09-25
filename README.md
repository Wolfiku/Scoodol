<div align="center">

# Scoodol
 
**The smart, modern school planner for students.**
 
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://scoodol.app)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg)](https://www.typescriptlang.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-100%25_Offline-success.svg)](https://scoodol.app)
[![License](https://img.shields.io/badge/license-wk--lc--04-orange.svg)](./LICENSE.md)
 
**Live App:** [scoodol.app](https://scoodol.app)
 
</div>

---
 
## About Scoodol
 
Scoodol is a modern, high-performance Progressive Web App (PWA) designed for students. It combines timetables, homework management, grade calculation, and study tools in a single, well-crafted interface.
 
The application is built on three core design principles:
 
- **Performance** — Cache-first architecture for instantaneous (0ms latency) page rendering and state hydration.
- **Offline-First** — Full standalone functionality with zero active internet connection required.
- **Privacy** — User data stays local on the device whenever possible.

---
 
## Features
 
### Timetable
 
- **Daily Dashboard:** Live view of the current and upcoming class period with countdowns and break status.
- **Weekly Schedule:** Classic grid overview with room numbers, teachers, notes, and color accents.
- **A/B Week Support:** Full support for alternating 2-week schedules with automatic or manual toggling.
- **Flexible Bell Times:** Configurable school start times, period durations, and customized breaks.

### Custom Afternoon Classes
 
Manage your individual afternoon classes (7th–10th period) independently — even when your main schedule is synced with a class or study group.
 
### Homework Planner
 
- **Cache-First Loading:** Zero-latency task rendering with background Firestore synchronization.
- **Subject Grouping:** Automatically groups and sorts tasks by school subjects.
- **Due Date Presets:** One-click shortcuts for "Tomorrow", "Day After Tomorrow", or the subject's next scheduled class date.
- **Group Sharing:** Seamlessly share assignments with classmates inside a group.

### Focus Mode
 
Distraction-free study sessions with integrated focus timers, checklists, and sound notifications.
 
### 100% Offline PWA
 
Installable as a native app on iOS, Android, Windows, and macOS. Operates completely offline with local storage fallbacks.
 
### Study Tools & Workspace
 
- **Grade Calculator:** Quick GPA and average calculation with custom weighting.
- **Formula Collection:** Quick reference for mathematics and physics.
- **Periodic Table:** Interactive directory of chemical elements.
- **Vocabulary Trainer & Quizzes:** Build custom vocabulary lists with interactive test modes.
- **Workspace:** Notes, documents, presentations, and todo lists.

---
 
## Quick Start & Installation
 
### Prerequisites
 
- [Node.js](https://nodejs.org/) (version 18 or higher)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

### 1. Clone the repository
 
```bash
git clone https://github.com/Wolfiku/Scoodol.git
cd Scoodol
```
 
### 2. Install dependencies
 
```bash
npm install
```
 
### 3. Configure environment variables (optional)
 
```bash
cp .env.example .env.local
```
 
### 4. Start development server
 
```bash
npm run dev
```
 
Open [http://localhost:3000](http://localhost:3000) in your browser.
 
### 5. Production build
 
```bash
npm run build
npm run start
```
 
---
 
## Tech Stack
 
| Area | Technology |
|---|---|
| Framework | [Next.js 15](https://nextjs.org/) (App Router, Server Actions, Turbopack) |
| Frontend | [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/) |
| Icons | [Lucide React](https://lucide.dev/) |
| PWA & Offline | [@ducanh2912/next-pwa](https://github.com/ducanh2912/next-pwa), Workbox |
| Database & Auth | [Firebase](https://firebase.google.com/) (Firestore, Firebase Auth) |
 
---
 
## License & Attribution
 
This project is licensed under **wk-lc-04** (Wolfiku's Custom Non-Commercial License, v0.4).
 
**Allowed:**
- Personal, educational, and non-commercial use.
- Reusing individual components, functions, or modules with attribution.
- Forking and making substantial, meaningful improvements with attribution.

**Not Allowed:**
- Commercial use (sales, SaaS, monetization, advertising) without separate written permission.
- Pure rebranding or superficial copies without substantial original work.

**Attribution Requirement:** Any reuse, fork, or distribution must clearly credit **Wolfiku** and the original project ([scoodol.app](https://scoodol.app)).
 
For full terms, see [`LICENSE.md`](./LICENSE.md).
 
---
 
<div align="center">

Developed with ❤️ by **Wolfiku** · [scoodol.app](https://scoodol.app)
 
</div>
