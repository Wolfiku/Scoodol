"use server";

import { calculateRemainingTime } from "@/ai/flows/calculate-remaining-time";

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
