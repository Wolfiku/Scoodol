"use server";

import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";
import { initializeApp, getApps } from "firebase/app";

if (!getApps().some(app => app.name === 'admin-action-app')) {
  initializeApp(firebaseConfig, 'admin-action-app');
}

export type FindFormulaOutput = {
  foundFormula?: {
    subject: string;
    name: string;
    formula: string;
  };
  suggestedFormula?: {
    name: string;
    formula: string;
    subject: string;
  };
  error?: string;
};

export type ElementInfo = {
  name: string;
  symbol: string;
  atomicNumber: number;
  atomicMass: string;
  description: string;
  meltingPoint?: string;
  boilingPoint?: string;
  density?: string;
};

export type CompoundInfo = {
  name: string;
  formula: string;
  molarMass: string;
  description: string;
  meltingPoint?: string;
  boilingPoint?: string;
  density?: string;
};

export type FindElementOutput = {
  element?: ElementInfo;
  compound?: CompoundInfo;
  error?: string;
};

export type ScanHomeworkOutput = {
  tasks: {
    subject: string;
    task: string;
    dueDate?: string;
  }[];
  error?: string;
};

export type TimetableEntry = {
  period: number;
  subject: string;
  teacher?: string;
  room?: string;
  start?: string;
  end?: string;
  isMainSubject?: boolean;
};

export type DaySchedule = TimetableEntry[];

export type TimetableData = {
  Montag?: DaySchedule;
  Dienstag?: DaySchedule;
  Mittwoch?: DaySchedule;
  Donnerstag?: DaySchedule;
  Freitag?: DaySchedule;
};

export type ScanTimetableOutput = {
  timetable?: TimetableData;
  weekB?: TimetableData;
  isABWeek?: boolean;
  schoolStartTime?: string;
  schoolEndTime?: string;
  error?: string;
};

export type GradeInfo = {
  subject: string;
  grade: string;
  type: 'written' | 'oral' | 'final' | 'other';
};

export type AnalyzeReportCardOutput = {
  overallAverage?: string;
  mainSubjectsAverage?: string;
  summary?: string;
  statistics?: {
    oralAverage?: string;
    writtenAverage?: string;
  };
  grades?: GradeInfo[];
  error?: string;
};

export type VocabularyPair = {
  foreign: string;
  german: string;
};

export type ScanVocabularyOutput = {
  vocabulary: VocabularyPair[];
  error?: string;
};

export type CheckQuizAnswerOutput = {
  isCorrect: boolean;
  explanation?: string;
};

export type EvaluateLongAnswerOutput = {
  isCorrect: boolean;
  score: number;
  feedback?: string;
};

export type TutorChatOutput = {
  reply: string;
  suggestedQuestions?: string[];
  error?: string;
};

export async function searchFormula(query: string, formulasJson: string, _language: string): Promise<FindFormulaOutput> {
  try {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return { error: "Bitte gib einen Suchbegriff ein." };

    let parsed: Record<string, { name: string; formula: string }[]> = {};
    try {
      parsed = JSON.parse(formulasJson);
    } catch (e) {}

    for (const [subject, list] of Object.entries(parsed)) {
      const match = list.find(f => 
        f.name.toLowerCase().includes(trimmed) || 
        f.formula.toLowerCase().includes(trimmed)
      );
      if (match) {
        return {
          foundFormula: {
            subject,
            name: match.name,
            formula: match.formula,
          }
        };
      }
    }

    return { error: `Keine passende Formel für "${query}" gefunden.` };
  } catch (error) {
    console.error("Error searching for formula:", error);
    return { error: "Bei der Suche ist ein Fehler aufgetreten." };
  }
}

export async function searchElement(query: string, _language: string): Promise<FindElementOutput> {
  try {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return { error: "Bitte gib ein Element oder Symbol ein." };

    if (trimmed === 'wolfiku') {
      return {
        element: {
          name: "Wolfiku",
          symbol: "Wk",
          atomicNumber: 404,
          atomicMass: "Infinity",
          description: "Ein legendärer Entwickler von Scoodol. Extrem selten, hochgradig innovativ und stets kaffeegetrieben.",
          meltingPoint: "1000 °C",
          boilingPoint: "5000 °C",
          density: "Unendlich"
        }
      };
    }

    return { error: `Element "${query}" konnte in der Offline-Suche nicht gefunden werden.` };
  } catch (error) {
    console.error("Error searching for element:", error);
    return { error: "Bei der Suche ist ein Fehler aufgetreten." };
  }
}

export async function scanHomeworkImage(_photoDataUri: string, _language: string): Promise<ScanHomeworkOutput> {
  return { 
    tasks: [], 
    error: "Die Cloud-KI-Scan-Funktion ist in der Open-Source-Version standardmäßig deaktiviert. Bitte trage Aufgaben manuell ein." 
  };
}

export async function scanTimetableImage(_photoDataUri: string, _language: string): Promise<ScanTimetableOutput> {
  return { 
    error: "Die Cloud-KI-Scan-Funktion ist in der Open-Source-Version standardmäßig deaktiviert. Bitte trage den Stundenplan manuell ein." 
  };
}

export async function analyzeReportCard(_photoDataUri: string, _language: string): Promise<AnalyzeReportCardOutput> {
  return { 
    error: "Die Zeugnis-Analyse ist in der Open-Source-Basisversion deaktiviert." 
  };
}

export async function getSimplifiedText(text: string, _language: string): Promise<{ simplifiedText?: string; error?: string }> {
  return { 
    simplifiedText: text, 
    error: undefined 
  };
}

export async function scanVocabularyImage(_photoDataUri: string, _language: string): Promise<ScanVocabularyOutput> {
  return { 
    vocabulary: [], 
    error: "Die Vokabel-Scan-Funktion ist in der Open-Source-Version deaktiviert." 
  };
}

export async function verifyQuizAnswer(_question: string, correctAnswer: string, userAnswer: string, _language: string): Promise<CheckQuizAnswerOutput> {
  const isMatch = correctAnswer.trim().toLowerCase() === userAnswer.trim().toLowerCase();
  return { 
    isCorrect: isMatch,
    explanation: isMatch ? "Richtig gelöst!" : `Die richtige Antwort lautet: ${correctAnswer}`
  };
}

export async function checkLongAnswer(_question: string, referenceAnswer: string, _criteria: string, userAnswer: string, _language: string): Promise<EvaluateLongAnswerOutput> {
  const isCorrect = userAnswer.trim().length > 0 && userAnswer.trim().toLowerCase() === referenceAnswer.trim().toLowerCase();
  return { 
    isCorrect, 
    score: isCorrect ? 100 : 50, 
    feedback: isCorrect ? "Sehr gut!" : "Vergleiche deine Antwort mit der Musterlösung." 
  };
}

export async function getTutorReply(_content: string, _question: string, _language: string): Promise<TutorChatOutput> {
  return { 
    reply: "Der KI-Tutor ist in der Open-Source-Version standardmäßig deaktiviert.",
    suggestedQuestions: []
  };
}

export async function getTutorChatReply(_input: { history: { role: 'user' | 'model'; content: { text: string }[] }[] }): Promise<{ reply?: string; error?: string }> {
  return { 
    reply: "Der KI-Tutor ist in der Open-Source-Version standardmäßig deaktiviert." 
  };
}

export async function sendPasswordResetEmailForUser(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = getAuth();
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error: any) {
    console.error("Error sending password reset email:", error);
    if (error.code === 'auth/user-not-found') {
      return { success: false, error: 'Benutzer mit dieser E-Mail nicht gefunden.' };
    }
    return { success: false, error: 'E-Mail zum Zurücksetzen des Passworts konnte nicht gesendet werden.' };
  }
}

export async function generateAiWritingAssistance(text: string, _task: 'improve' | 'extend' | 'summarize', _language: string): Promise<{ result: string } | { error: string }> {
  return { result: text };
}
