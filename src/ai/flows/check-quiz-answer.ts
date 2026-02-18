
'use server';

/**
 * @fileOverview Checks a quiz answer for spelling mistakes or semantic similarity using AI.
 *
 * - checkQuizAnswer - A function that evaluates a quiz answer.
 * - CheckQuizAnswerInput - The input type for the checkQuizAnswer function.
 * - CheckQuizAnswerOutput - The return type for the checkQuizAnswer function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CheckQuizAnswerInputSchema = z.object({
  question: z.string().describe('The question asked in the quiz.'),
  correctAnswer: z.string().describe('The correct answer defined by the creator.'),
  userAnswer: z.string().describe('The answer provided by the user.'),
  language: z.string().optional().describe("The language of the quiz, e.g., 'German'."),
});
export type CheckQuizAnswerInput = z.infer<typeof CheckQuizAnswerInputSchema>;

const CheckQuizAnswerOutputSchema = z.object({
  isCorrect: z.boolean().describe('Whether the answer is acceptable despite minor spelling mistakes.'),
  explanation: z.string().optional().describe('A very short explanation why it was accepted or rejected (optional).'),
});
export type CheckQuizAnswerOutput = z.infer<typeof CheckQuizAnswerOutputSchema>;

export async function checkQuizAnswer(input: CheckQuizAnswerInput): Promise<CheckQuizAnswerOutput> {
  return checkQuizAnswerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'checkQuizAnswerPrompt',
  input: {schema: CheckQuizAnswerInputSchema},
  output: {schema: CheckQuizAnswerOutputSchema},
  prompt: `You are an intelligent quiz evaluator. A user provided an answer to a short-answer question.
The defined correct answer is: "{{{correctAnswer}}}"
The user's answer is: "{{{userAnswer}}}"
The question was: "{{{question}}}"

Your task is to determine if the user's answer is correct, even if there are minor spelling mistakes (typos) or slight variations in wording that don't change the meaning.
The language is {{language}}.

- If it's clearly the same concept/word but just misspelled (e.g. "Phytagoras" instead of "Pythagoras"), set isCorrect to true.
- If it's a completely different word or a different fact, set isCorrect to false.
- Be fair but not too loose.

Return only the JSON object.`,
});

const checkQuizAnswerFlow = ai.defineFlow(
  {
    name: 'checkQuizAnswerFlow',
    inputSchema: CheckQuizAnswerInputSchema,
    outputSchema: CheckQuizAnswerOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
