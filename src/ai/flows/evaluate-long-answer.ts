
'use server';

/**
 * @fileOverview Evaluates a long-form quiz answer using AI.
 *
 * - evaluateLongAnswer - A function that evaluates a long answer.
 * - EvaluateLongAnswerInput - The input type for the evaluateLongAnswer function.
 * - EvaluateLongAnswerOutput - The return type for the evaluateLongAnswer function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EvaluateLongAnswerInputSchema = z.object({
  question: z.string().describe('The question asked in the quiz.'),
  referenceAnswer: z.string().describe('The ideal correct answer defined by the creator.'),
  criteria: z.string().describe('Specific points or keywords that should be included in the answer.'),
  userAnswer: z.string().describe('The answer provided by the user.'),
  language: z.string().optional().describe("The language of the quiz, e.g., 'German'."),
});
export type EvaluateLongAnswerInput = z.infer<typeof EvaluateLongAnswerInputSchema>;

const EvaluateLongAnswerOutputSchema = z.object({
  isCorrect: z.boolean().describe('Whether the answer is at least 75% correct based on the reference and criteria.'),
  score: z.number().min(1).max(10).describe('A score from 1 to 10 for the answer.'),
  feedback: z.string().describe('Constructive feedback on what is missing or incorrect, and how to improve.'),
});
export type EvaluateLongAnswerOutput = z.infer<typeof EvaluateLongAnswerOutputSchema>;

export async function evaluateLongAnswer(input: EvaluateLongAnswerInput): Promise<EvaluateLongAnswerOutput> {
  return evaluateLongAnswerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'evaluateLongAnswerPrompt',
  input: {schema: EvaluateLongAnswerInputSchema},
  output: {schema: EvaluateLongAnswerOutputSchema},
  prompt: `You are an expert educator. Evaluate a student's answer to a long-form question.
Question: "{{{question}}}"
Ideal Reference Answer: "{{{referenceAnswer}}}"
Important Criteria/Keywords: "{{{criteria}}}"
Student's Answer: "{{{userAnswer}}}"

Evaluation Rules:
1. isCorrect: Set to true if the answer is at least 75% accurate and covers the main points of the reference answer and criteria.
2. score: Provide a score from 1 to 10 based on depth, accuracy, and clarity. 10 is perfect.
3. feedback: Provide helpful, friendly feedback in {{language}}. If the score is less than 10, explain exactly what was missed or could be explained better. Keep it concise but helpful.

Be fair but encouraging. Return only the JSON object.`,
});

const evaluateLongAnswerFlow = ai.defineFlow(
  {
    name: 'evaluateLongAnswerFlow',
    inputSchema: EvaluateLongAnswerInputSchema,
    outputSchema: EvaluateLongAnswerOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
