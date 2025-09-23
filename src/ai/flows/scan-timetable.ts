
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
});
export type ScanTimetableInput = z.infer<typeof ScanTimetableInputSchema>;

const TimetableEntrySchema = z.object({
    subject: z.string().describe("The subject of the class."),
    teacher: z.string().optional().describe("The teacher's name."),
    room: z.string().optional().describe("The room number or name."),
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
  prompt: `You are an expert at analyzing and extracting information from German school timetables (Stundenpläne).
Your task is to analyze the provided image and convert it into a structured JSON format.

- The output must be structured with keys for each day of the week: "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag".
- For each day, provide an array of entries. Each entry must contain the subject ("subject"), start time ("start"), and end time ("end").
- If available in the image, also extract the teacher's name ("teacher") and the room number ("room").
- Determine if a subject is a main subject ("isMainSubject"). Main subjects are typically German, Math, English, and any other language.
- Pay close attention to the time slots. Ensure the "start" and "end" times are in "HH:mm" format.
- The output fields MUST be named 'subject', 'teacher', 'room', 'start', 'end', 'isMainSubject'.
- Do not include breaks ("Pause") in the output.
- If the image is not a timetable or is unreadable, set the 'error' field with a descriptive message in German.

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
