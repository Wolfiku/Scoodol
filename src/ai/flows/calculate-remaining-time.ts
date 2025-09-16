'use server';

/**
 * @fileOverview Calculates the remaining time until the end of the school day.
 *
 * - calculateRemainingTime - A function that calculates the remaining time.
 * - CalculateRemainingTimeInput - The input type for the calculateRemainingTime function.
 * - CalculateRemainingTimeOutput - The return type for the calculateRemainingTime function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CalculateRemainingTimeInputSchema = z.object({
  currentTime: z.string().describe('The current time in HH:mm format.'),
  schoolEndTime: z.string().describe('The school end time in HH:mm format.'),
});
export type CalculateRemainingTimeInput = z.infer<typeof CalculateRemainingTimeInputSchema>;

const CalculateRemainingTimeOutputSchema = z.object({
  remainingTime: z.string().describe('The remaining time until the end of the school day in HH:mm format.'),
});
export type CalculateRemainingTimeOutput = z.infer<typeof CalculateRemainingTimeOutputSchema>;

export async function calculateRemainingTime(input: CalculateRemainingTimeInput): Promise<CalculateRemainingTimeOutput> {
  return calculateRemainingTimeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'calculateRemainingTimePrompt',
  input: {schema: CalculateRemainingTimeInputSchema},
  output: {schema: CalculateRemainingTimeOutputSchema},
  prompt: `You are a time calculation expert. You will be provided with the current time and the school end time. Your task is to calculate the remaining time until the end of the school day and return it in HH:mm format.

Current Time: {{{currentTime}}}
School End Time: {{{schoolEndTime}}}
`,  
});

const calculateRemainingTimeFlow = ai.defineFlow(
  {
    name: 'calculateRemainingTimeFlow',
    inputSchema: CalculateRemainingTimeInputSchema,
    outputSchema: CalculateRemainingTimeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
