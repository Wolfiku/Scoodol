'use server';

/**
 * @fileOverview Finds a formula based on a user query.
 *
 * - findFormula - A function that finds a formula.
 * - FindFormulaInput - The input type for the findFormula function.
 * - FindFormulaOutput - The return type for the findFormula function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FindFormulaInputSchema = z.object({
  query: z.string().describe('The user\'s search query for a formula.'),
  formulas: z.string().describe('A JSON string of the existing formulas available to search through.'),
});
export type FindFormulaInput = z.infer<typeof FindFormulaInputSchema>;

const FoundFormulaSchema = z.object({
    subject: z.string().describe('The subject of the found formula.'),
    name: z.string().describe('The name of the formula.'),
    formula: z.string().describe('The formula itself.'),
});

const FindFormulaOutputSchema = z.object({
  foundFormula: FoundFormulaSchema.optional().describe('The formula found in the provided list.'),
  suggestedFormula: z.object({
    name: z.string().describe('The suggested name for the formula.'),
    formula: z.string().describe('The suggested formula.'),
    subject: z.string().describe('The suggested subject for the formula (Mathematik, Physik, or Chemie).'),
  }).optional().describe('A suggested formula if nothing was found in the list.'),
  error: z.string().optional().describe('An error message if something went wrong.'),
});
export type FindFormulaOutput = z.infer<typeof FindFormulaOutputSchema>;

export async function findFormula(input: FindFormulaInput): Promise<FindFormulaOutput> {
  return findFormulaFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findFormulaPrompt',
  input: {schema: FindFormulaInputSchema},
  output: {schema: FindFormulaOutputSchema},
  prompt: `You are a helpful assistant for a student. The user is searching for a formula.
First, search the provided list of formulas to see if any of them match the user's query. The list is a JSON string.
If you find a relevant formula in the list, return it in the 'foundFormula' field.

If you DO NOT find a relevant formula in the provided list, use your own knowledge to find the correct formula.
Return this newly found formula in the 'suggestedFormula' field. Make sure to also determine the correct subject for the suggested formula.

User Query: {{{query}}}

Existing Formulas (JSON):
\`\`\`json
{{{formulas}}}
\`\`\`
`,  
});

const findFormulaFlow = ai.defineFlow(
  {
    name: 'findFormulaFlow',
    inputSchema: FindFormulaInputSchema,
    outputSchema: FindFormulaOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
