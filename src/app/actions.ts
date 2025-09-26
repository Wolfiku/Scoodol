
"use server";

import { findElement } from "@/ai/flows/find-element";
import { findFormula } from "@/ai/flows/find-formula";
import { scanHomework } from "@/ai/flows/scan-homework";
import { scanTimetable as scanTimetableFlow } from "@/ai/flows/scan-timetable";
import type { ScanTimetableOutput } from "@/ai/flows/scan-timetable";
import { analyzeReportCard as analyzeReportCardFlow } from "@/ai/flows/analyze-report-card";
import type { AnalyzeReportCardOutput } from "@/ai/flows/analyze-report-card";
import { aiTutorChat } from "@/ai/flows/ai-tutor-chat";
import type { AiTutorChatInput } from "@/ai/flows/ai-tutor-chat";
import { simplifyText } from "@/ai/flows/simplify-text";

export async function searchFormula(query: string, formulas: string) {
  try {
    const result = await findFormula({ query, formulas });
    return result;
  } catch (error) {
    console.error("Error searching for formula:", error);
    return { error: "Bei der Suche ist ein Fehler aufgetreten." };
  }
}

export async function searchElement(query: string) {
  try {
    const result = await findElement({ query });
    return result;
  } catch (error) {
    console.error("Error searching for element:", error);
    return { error: "Bei der Suche ist ein Fehler aufgetreten." };
  }
}

export async function scanHomeworkImage(photoDataUri: string) {
    try {
        const result = await scanHomework({ photoDataUri });
        return result;
    } catch (error) {
        console.error("Error scanning homework:", error);
        return { error: "Beim Scannen der Hausaufgabe ist ein Fehler aufgetreten." };
    }
}

export async function scanTimetableImage(photoDataUri: string): Promise<ScanTimetableOutput> {
    try {
        const result = await scanTimetableFlow({ photoDataUri });
        return result;
    } catch (error) {
        console.error("Error scanning timetable:", error);
        return { error: "Beim Scannen des Stundenplans ist ein Fehler aufgetreten." };
    }
}


export async function analyzeReportCard(photoDataUri: string): Promise<AnalyzeReportCardOutput> {
    try {
        const result = await analyzeReportCardFlow({ photoDataUri });
        return result;
    } catch (error) {
        console.error("Error analyzing report card:", error);
        return { error: "Bei der Analyse des Zeugnisses ist ein Fehler aufgetreten." };
    }
}

export async function getTutorChatReply(history: AiTutorChatInput["history"]) {
    try {
        const result = await aiTutorChat({ history });
        return result;
    } catch (error) {
        console.error("Error in AI Tutor chat:", error);
        return { error: "Entschuldigung, bei der Kommunikation mit dem Tutor ist ein Fehler aufgetreten." };
    }
}

export async function getSimplifiedText(text: string) {
    try {
        const result = await simplifyText({ text });
        return result;
    } catch (error) {
        console.error("Error simplifying text:", error);
        return { error: "Entschuldigung, beim Vereinfachen des Textes ist ein Fehler aufgetreten." };
    }
}
