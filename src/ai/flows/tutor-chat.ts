
'use server';

/**
 * @fileOverview Ein KI-Tutor, der Fragen zu Lerninhalten beantwortet.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TutorChatInputSchema = z.object({
  content: z.string().describe('Der Inhalt des Lernzettels oder der Notiz.'),
  question: z.string().describe('Die Frage des Schülers.'),
  language: z.string().optional().describe("Die Sprache der Antwort, z.B. 'German'."),
});
export type TutorChatInput = z.infer<typeof TutorChatInputSchema>;

const TutorChatOutputSchema = z.object({
  reply: z.string().describe('Die hilfreiche Antwort des Tutors.'),
});
export type TutorChatOutput = z.infer<typeof TutorChatOutputSchema>;

export async function tutorChat(input: TutorChatInput): Promise<TutorChatOutput> {
  return tutorChatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'tutorChatPrompt',
  input: {schema: TutorChatInputSchema},
  output: {schema: TutorChatOutputSchema},
  prompt: `Du bist ein hilfreicher und motivierender KI-Tutor. 
Ein Schüler hat einen Lernzettel mit folgendem Inhalt erstellt:

---
{{{content}}}
---

Der Schüler hat nun folgende Frage dazu:
"{{{question}}}"

Beantworte die Frage präzise, verständlich und passend zum Niveau eines Schülers in {{language}}. Wenn die Antwort nicht direkt im Text steht, nutze dein Allgemeinwissen, um den Zusammenhang zu erklären. Bleibe freundlich und unterstützend.`,
});

const tutorChatFlow = ai.defineFlow(
  {
    name: 'tutorChatFlow',
    inputSchema: TutorChatInputSchema,
    outputSchema: TutorChatOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
