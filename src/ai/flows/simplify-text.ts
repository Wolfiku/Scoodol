'use server';

/**
 * @fileOverview Simplifies a given text for better understanding.
 *
 * - simplifyText - A function that simplifies text.
 * - SimplifyTextInput - The input type for the simplifyText function.
 * - SimplifyTextOutput - The return type for the simplifyText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SimplifyTextInputSchema = z.object({
  text: z.string().describe('The text to be simplified.'),
});
export type SimplifyTextInput = z.infer<typeof SimplifyTextInputSchema>;


const SimplifyTextOutputSchema = z.object({
  simplifiedText: z.string().describe('The simplified version of the text.'),
});
export type SimplifyTextOutput = z.infer<typeof SimplifyTextOutputSchema>;


export async function simplifyText(input: SimplifyTextInput): Promise<SimplifyTextOutput> {
  return simplifyTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'simplifyTextPrompt',
  input: {schema: SimplifyTextInputSchema},
  output: {schema: SimplifyTextOutputSchema},
  prompt: `You are an expert in education and language. Your task is to simplify the following text.
Rewrite the text in simple, clear German. Use shorter sentences, easier words, and active voice.
The goal is to make the text understandable for a student who might have difficulties with complex instructions or language.

Original Text:
"{{text}}"

Your simplified version should only be in the 'simplifiedText' field.
`,
});

const simplifyTextFlow = ai.defineFlow(
  {
    name: 'simplifyTextFlow',
    inputSchema: SimplifyTextInputSchema,
    outputSchema: SimplifyTextOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
