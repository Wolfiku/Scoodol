
'use server';

/**
 * @fileOverview Analyzes a report card image and extracts relevant information.
 *
 * - analyzeReportCard - A function that analyzes a report card.
 * - AnalyzeReportCardInput - The input type for the analyzeReportCard function.
 * - AnalyzeReportCardOutput - The return type for the analyzeReportCard function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeReportCardInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a school report card, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  language: z.string().optional().describe("The language to respond in, e.g., 'German' or 'English'."),
});
export type AnalyzeReportCardInput = z.infer<typeof AnalyzeReportCardInputSchema>;

const GradeSchema = z.object({
    subject: z.string().describe("The school subject."),
    grade: z.string().describe("The grade obtained in the subject (e.g., '1', '2,5', '1-')."),
    type: z.enum(['written', 'oral', 'final', 'other']).describe("The type of grade (e.g., written, oral, final exam, other)."),
});

const AnalyzeReportCardOutputSchema = z.object({
  overallAverage: z.string().optional().describe("The calculated overall average grade."),
  mainSubjectsAverage: z.string().optional().describe("The calculated average grade for the main subjects (e.g., German, Math, English)."),
  summary: z.string().optional().describe("A summary of any textual comments or remarks on the report card."),
  statistics: z.object({
    oralAverage: z.string().optional().describe("The average of all oral grades."),
    writtenAverage: z.string().optional().describe("The average of all written grades."),
  }).optional().describe("Statistics about the grades."),
  grades: z.array(GradeSchema).optional().describe("A list of all individual grades found on the report card."),
  error: z.string().optional().describe("An error message if the analysis failed or the document is not a report card."),
});
export type AnalyzeReportCardOutput = z.infer<typeof AnalyzeReportCardOutputSchema>;

export async function analyzeReportCard(input: AnalyzeReportCardInput): Promise<AnalyzeReportCardOutput> {
  return analyzeReportCardFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeReportCardPrompt',
  input: {schema: AnalyzeReportCardInputSchema},
  output: {schema: AnalyzeReportCardOutputSchema},
  prompt: `You are an expert in analyzing German school report cards. Your task is to extract detailed information from the provided image.
The user wants the response in {{language}}.

- Analyze the entire document to identify all subjects and their corresponding grades. Differentiate between oral, written, and final grades if possible.
- Calculate the overall average grade.
- Identify the main subjects (typically German, Math, English, and other languages) and calculate their separate average.
- Look for any textual comments, remarks, or assessments (Kopfnoten/Bemerkungen) and provide a concise summary.
- Calculate the average of all oral grades and all written grades separately.
- If the document is not a recognizable school report card or if you cannot extract any meaningful information, set the 'error' field.

Report Card Image:
{{media url=photoDataUri}}
`,  
});

const analyzeReportCardFlow = ai.defineFlow(
  {
    name: 'analyzeReportCardFlow',
    inputSchema: AnalyzeReportCardInputSchema,
    outputSchema: AnalyzeReportCardOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
