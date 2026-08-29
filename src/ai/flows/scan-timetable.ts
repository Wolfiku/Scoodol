'use server';

/**
 * @fileOverview Scans an image of a timetable and extracts the schedule.
 *
 * - scanTimetable - A function that scans a timetable image.
 * - ScanTimetableInput - The input type for the scanTimetable function.
 * - ScanTimetableOutput - The return type for the scanTimetable function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScanTimetableInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a school timetable, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  language: z.string().optional().describe("The language to respond in, e.g., 'German' or 'English'."),
});
export type ScanTimetableInput = z.infer<typeof ScanTimetableInputSchema>;

const TimetableEntrySchema = z.object({
    subject: z.string().describe("The subject of the class. Use full names if recognized (e.g. 'Mathematik' instead of 'Ma')."),
    teacher: z.string().optional().describe("The teacher's name or abbreviation (e.g. 'Kup', 'Schmidt')."),
    room: z.string().optional().describe("The room number or name (e.g. '101', 'Aula')."),
    start: z.string().describe("The start time of the class in HH:mm format."),
    end: z.string().describe("The end time of the class in HH:mm format."),
    isMainSubject: z.boolean().optional().describe("Whether the subject is a main subject (Hauptfach). Main subjects are typically German, Math, English, and other languages."),
});

const DayScheduleSchema = z.array(TimetableEntrySchema);

const TimetableDataSchema = z.object({
    Montag: DayScheduleSchema.optional().describe("Schedule for Monday."),
    Dienstag: DayScheduleSchema.optional().describe("Schedule for Tuesday."),
    Mittwoch: DayScheduleSchema.optional().describe("Schedule for Wednesday."),
    Donnerstag: DayScheduleSchema.optional().describe("Schedule for Thursday."),
    Freitag: DayScheduleSchema.optional().describe("Schedule for Friday."),
});

const ScanTimetableOutputSchema = z.object({
  timetable: TimetableDataSchema.optional().describe('The extracted timetable data, structured by days of the week.'),
  error: z.string().optional().describe('An error message if the image could not be recognized as a timetable.'),
});
export type ScanTimetableOutput = z.infer<typeof ScanTimetableOutputSchema>;

export async function scanTimetable(input: ScanTimetableInput): Promise<ScanTimetableOutput> {
  return scanTimetableFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanTimetablePrompt',
  input: {schema: ScanTimetableInputSchema},
  output: {schema: ScanTimetableOutputSchema},
  prompt: `You are an absolute expert at analyzing and extracting information from German school timetables (Stundenpläne).
Your task is to analyze the provided image and convert it into a structured JSON format.
The user wants the error messages in the 'error' field to be in {{language}}.

TIMETABLE ANALYSIS RULES:
1. SUBJECTS: School subjects are often abbreviated. Map them to common names if possible (e.g., "Ma" -> "Mathe", "D" -> "Deutsch", "Ph" -> "Physik", "Eng" -> "Englisch", "Bio" -> "Biologie").
2. STRUCTURE: The output must be structured with keys for each day: "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag".
3. FIELDS: Each entry MUST have 'subject', 'start', 'end'. Extract 'teacher' and 'room' if visible.
4. DOUBLE PERIODS: If a subject spans across two or more slots in the image (a vertical block), create separate entries for each slot, using the appropriate start and end times for each.
5. TIMES: If exact clock times (e.g. 08:00) are not written but lesson numbers (1., 2., 3.) are, infer typical school times starting from 07:50 or 08:00 (45 mins per lesson + 5-15 mins breaks). Ensure HH:mm format.
6. MAIN SUBJECTS: Determine if a subject is a main subject ("isMainSubject"). Typical: Deutsch, Mathe, Englisch, Spanisch, Französisch, Latein.
7. NO BREAKS: Do not include entries named "Pause".
8. AMBIGUITY: If the image is unreadable or not a timetable, fill the 'error' field.

Timetable Image:
{{media url=photoDataUri}}
`,  
});

const scanTimetableFlow = ai.defineFlow(
  {
    name: 'scanTimetableFlow',
    inputSchema: ScanTimetableInputSchema,
    outputSchema: ScanTimetableOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
