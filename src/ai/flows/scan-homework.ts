
'use server';

/**
 * @fileOverview Scans an image of homework and extracts tasks.
 *
 * - scanHomework - A function that scans a homework image.
 * - ScanHomeworkInput - The input type for the scanHomework function.
 * - ScanHomeworkOutput - The return type for the scanHomework function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScanHomeworkInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a homework assignment, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ScanHomeworkInput = z.infer<typeof ScanHomeworkInputSchema>;

const HomeworkTaskSchema = z.object({
    subject: z.string().describe("The subject of the homework task (e.g., 'Mathe', 'Deutsch', 'Englisch'). If not determinable, leave empty."),
    task: z.string().describe("The specific homework task (e.g., 'Buch S. 55 Nr. 3', 'Vokabeln lernen')."),
    dueDate: z.string().optional().describe("The due date of the task in YYYY-MM-DD format if mentioned, otherwise leave empty."),
});

const ScanHomeworkOutputSchema = z.object({
  tasks: z.array(HomeworkTaskSchema).describe('A list of homework tasks found in the image.'),
  error: z.string().optional().describe('An error message if no tasks could be extracted.'),
});
export type ScanHomeworkOutput = z.infer<typeof ScanHomeworkOutputSchema>;

export async function scanHomework(input: ScanHomeworkInput): Promise<ScanHomeworkOutput> {
  return scanHomeworkFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanHomeworkPrompt',
  input: {schema: ScanHomeworkInputSchema},
  output: {schema: ScanHomeworkOutputSchema},
  prompt: `You are an expert at analyzing images of homework assignments (e.g., from a textbook, a worksheet, or a whiteboard).
Your task is to extract all individual homework tasks from the provided image.

For each task, identify the subject, the task description, and if mentioned, the due date.
The output fields MUST be named 'subject', 'task', and 'dueDate'.
If the image contains multiple tasks, create a separate entry for each one.
Pay attention to keywords like "HA:" (Hausaufgabe), "due:", "bis:", or dates.

If you cannot find any tasks, return an empty array for 'tasks'.

Image of homework:
{{media url=photoDataUri}}
`,  
});

const scanHomeworkFlow = ai.defineFlow(
  {
    name: 'scanHomeworkFlow',
    inputSchema: ScanHomeworkInputSchema,
    outputSchema: ScanHomeworkOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
