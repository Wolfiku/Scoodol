'use server';

/**
 * @fileOverview Finds information about a chemical element or compound.
 *
 * - findElement - A function that finds an element or compound.
 * - FindElementInput - The input type for the findElement function.
 * - FindElementOutput - The return type for the findElement function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FindElementInputSchema = z.object({
  query: z.string().describe('The user\'s search query for a chemical element or compound (e.g., "H2O", "Iron", "Wasserstoff").'),
});
export type FindElementInput = z.infer<typeof FindElementInputSchema>;

const ElementSchema = z.object({
  name: z.string().describe('The name of the element.'),
  symbol: z.string().describe('The chemical symbol of the element.'),
  atomicNumber: z.number().describe('The atomic number of the element.'),
  atomicMass: z.string().describe('The atomic mass of the element (e.g., "1.008 u").'),
  description: z.string().describe('A brief description of the element and its most important properties.'),
});

const CompoundSchema = z.object({
    name: z.string().describe('The common name of the compound.'),
    formula: z.string().describe('The chemical formula of the compound.'),
    molarMass: z.string().describe('The molar mass of the compound in g/mol.'),
    description: z.string().describe('A brief description of the compound, its composition, and its most important properties.'),
});

const FindElementOutputSchema = z.object({
  element: ElementSchema.optional().describe('Information about the found element.'),
  compound: CompoundSchema.optional().describe('Information about the found compound.'),
  error: z.string().optional().describe('An error message if the query could not be resolved or is not a chemical element/compound.'),
});
export type FindElementOutput = z.infer<typeof FindElementOutputSchema>;

export async function findElement(input: FindElementInput): Promise<FindElementOutput> {
  return findElementFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findElementPrompt',
  input: {schema: FindElementInputSchema},
  output: {schema: FindElementOutputSchema},
  prompt: `You are an expert chemist. The user is searching for information about a chemical element or a chemical compound.
Your task is to analyze the user's query and provide structured information about it.

- If the query refers to a single chemical element (like "Iron", "O", or "Wasserstoff"), populate the 'element' field.
- If the query refers to a chemical compound (like "H2O", "Water", or "Sodium Chloride"), populate the 'compound' field.
- If the query is ambiguous, not a chemical term, or you cannot find any information, set the 'error' field with a helpful message in German.
- Do not populate both 'element' and 'compound' fields at the same time.

User Query: {{{query}}}
`,  
});

const findElementFlow = ai.defineFlow(
  {
    name: 'findElementFlow',
    inputSchema: FindElementInputSchema,
    outputSchema: FindElementOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
