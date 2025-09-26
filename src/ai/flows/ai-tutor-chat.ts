'use server';

/**
 * @fileOverview Provides a simple chat interface with a Gemini model.
 *
 * - aiTutorChat - A function that continues a chat conversation.
 * - AiTutorChatInput - The input type for the aiTutorChat function.
 * - AiTutorChatOutput - The return type for the aiTutorChat function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {Message, Part} from 'genkit';

const AiTutorChatInputSchema = z.object({
  history: z.array(z.object({
      role: z.enum(['user', 'model']),
      content: z.array(z.object({
          text: z.string(),
      })),
  })).describe('The history of the conversation.'),
});
export type AiTutorChatInput = z.infer<typeof AiTutorChatInputSchema>;


const AiTutorChatOutputSchema = z.object({
  reply: z.string().describe('The AI\'s reply to the user.'),
});
export type AiTutorChatOutput = z.infer<typeof AiTutorChatOutputSchema>;


export async function aiTutorChat(input: AiTutorChatInput): Promise<AiTutorChatOutput> {
  return aiTutorChatFlow(input);
}

const prompt = `You are a helpful and friendly AI Tutor for a student.
Your name is Scoody.
Keep your answers concise and easy to understand.
Answer in German.
`;

const aiTutorChatFlow = ai.defineFlow(
  {
    name: 'aiTutorChatFlow',
    inputSchema: AiTutorChatInputSchema,
    outputSchema: AiTutorChatOutputSchema,
  },
  async (input) => {
    const history: Message[] = input.history.map(msg => ({
      role: msg.role,
      content: msg.content as Part[],
    }));
      
    const {output} = await ai.generate({
      prompt: prompt,
      history: history,
      model: 'googleai/gemini-2.5-flash',
    });

    return { reply: output!.text! };
  }
);
