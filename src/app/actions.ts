"use server";

import { calculateRemainingTime } from "@/ai/flows/calculate-remaining-time";
import { findElement } from "@/ai/flows/find-element";
import { findFormula } from "@/ai/flows/find-formula";
import { scanHomework } from "@/ai/flows/scan-homework";

export async function getRemainingTime(currentTime: string) {
  try {
    const result = await calculateRemainingTime({
      currentTime,
      schoolEndTime: "13:00",
    });
    return result.remainingTime;
  } catch (error) {
    console.error("Error calculating remaining time:", error);
    return null;
  }
}

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
