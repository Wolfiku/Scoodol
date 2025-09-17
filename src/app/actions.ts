"use server";

import { calculateRemainingTime } from "@/ai/flows/calculate-remaining-time";
import { findFormula } from "@/ai/flows/find-formula";

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
