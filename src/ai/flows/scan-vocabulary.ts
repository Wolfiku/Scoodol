
'use server';

/**
 * @fileOverview Scans an image of a vocabulary list and extracts the pairs.
 *
 * - scanVocabulary - A function that scans a vocabulary image.
 * - ScanVocabularyInput - The input type for the scanVocabulary function.
 * - ScanVocabularyOutput - The return type for the scanVocabulary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScanVocabularyInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a vocabulary list, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  language: z.string().optional().describe("The language to respond in, e.g., 'German' or 'English'."),
});
export type ScanVocabularyInput = z.infer<typeof ScanVocabularyInputSchema>;

const VocabularyPairSchema = z.object({
    foreign: z.string().describe("The vocabulary in the foreign language."),
    german: z.string().describe("The German translation of the vocabulary."),
});

const ScanVocabularyOutputSchema = z.object({
  vocabulary: z.array(VocabularyPairSchema).describe('A list of vocabulary pairs found in the image.'),
  error: z.string().optional().describe('An error message if no vocabulary could be extracted.'),
});
export type ScanVocabularyOutput = z.infer<typeof ScanVocabularyOutputSchema>;

export async function scanVocabulary(input: ScanVocabularyInput): Promise<ScanVocabularyOutput> {
  return scanVocabularyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanVocabularyPrompt',
  input: {schema: ScanVocabularyInputSchema},
  output: {schema: ScanVocabularyOutputSchema},
  prompt: `You are an expert at analyzing images of vocabulary lists.
The user has uploaded a photo of a two-column vocabulary table. Your task is to extract all vocabulary pairs.
The first column is the foreign language, the second column is German.
If there is a third column, you MUST ignore it completely.

The user wants the response in {{language}}.

For each row, extract the foreign word and its German translation.
The output fields MUST be named 'foreign' and 'german'.
If the image is not a vocabulary list or unreadable, set the 'error' field.

Image of vocabulary:
{{media url=photoDataUri}}
`,  
});

const scanVocabularyFlow = ai.defineFlow(
  {
    name: 'scanVocabularyFlow',
    inputSchema: ScanVocabularyInputSchema,
    outputSchema: ScanVocabularyOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
