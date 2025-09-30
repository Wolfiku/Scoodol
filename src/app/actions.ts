
"use server";

import { findElement } from "@/ai/flows/find-element";
import { findFormula } from "@/ai/flows/find-formula";
import { scanHomework } from "@/ai/flows/scan-homework";
import { scanTimetable as scanTimetableFlow } from "@/ai/flows/scan-timetable";
import type { ScanTimetableOutput } from "@/ai/flows/scan-timetable";
import { analyzeReportCard as analyzeReportCardFlow } from "@/ai/flows/analyze-report-card";
import type { AnalyzeReportCardOutput } from "@/ai/flows/analyze-report-card";
import { simplifyText } from "@/ai/flows/simplify-text";
import { scanVocabulary } from "@/ai/flows/scan-vocabulary";
import type { ScanVocabularyOutput } from "@/ai/flows/scan-vocabulary";

export async function searchFormula(query: string, formulas: string, language: string) {
  try {
    const result = await findFormula({ query, formulas, language });
    return result;
  } catch (error) {
    console.error("Error searching for formula:", error);
    return { error: "Bei der Suche ist ein Fehler aufgetreten." };
  }
}

export async function searchElement(query: string, language: string) {
  try {
    const result = await findElement({ query, language });
    return result;
  } catch (error) {
    console.error("Error searching for element:", error);
    return { error: "Bei der Suche ist ein Fehler aufgetreten." };
  }
}

export async function scanHomeworkImage(photoDataUri: string, language: string) {
    try {
        const result = await scanHomework({ photoDataUri, language });
        return result;
    } catch (error) {
        console.error("Error scanning homework:", error);
        return { error: "Beim Scannen der Hausaufgabe ist ein Fehler aufgetreten." };
    }
}

export async function scanTimetableImage(photoDataUri: string, language: string): Promise<ScanTimetableOutput> {
    try {
        const result = await scanTimetableFlow({ photoDataUri, language });
        return result;
    } catch (error) {
        console.error("Error scanning timetable:", error);
        return { error: "Beim Scannen des Stundenplans ist ein Fehler aufgetreten." };
    }
}


export async function analyzeReportCard(photoDataUri: string, language: string): Promise<AnalyzeReportCardOutput> {
    try {
        const result = await analyzeReportCardFlow({ photoDataUri, language });
        return result;
    } catch (error) {
        console.error("Error analyzing report card:", error);
        return { error: "Bei der Analyse des Zeugnisses ist ein Fehler aufgetreten." };
    }
}

export async function getSimplifiedText(text: string, language: string) {
    try {
        const result = await simplifyText({ text, language });
        return result;
    } catch (error) {
        console.error("Error simplifying text:", error);
        return { error: "Entschuldigung, beim Vereinfachen des Textes ist ein Fehler aufgetreten." };
    }
}

export async function scanVocabularyImage(photoDataUri: string, language: string): Promise<ScanVocabularyOutput> {
    try {
        const result = await scanVocabulary({ photoDataUri, language });
        return result;
    } catch (error) {
        console.error("Error scanning vocabulary:", error);
        return { error: "Beim Scannen der Vokabeln ist ein Fehler aufgetreten." };
    }
}
