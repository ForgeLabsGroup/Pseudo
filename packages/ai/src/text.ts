import OpenAI from 'openai';
import { z } from 'zod';
import { aiConfig } from './config';
import { mockGenerate } from './mock/text';

export interface GenerateJsonArgs<T extends z.ZodType> {
  /** Stable task id; also used by the mock provider to pick a fixture. */
  task: 'persona' | 'strategy' | 'content' | 'image_prompt' | 'analytics';
  system: string;
  prompt: string;
  schema: T;
  temperature?: number;
}

export interface GenerateJsonResult<T> {
  data: T;
  provider: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
}

/**
 * Structured generation that works on any OpenAI-compatible endpoint (OpenAI, Gemini's
 * OpenAI-compat endpoint, Groq...). We ask for JSON, give the JSON Schema in the prompt,
 * validate with Zod, and do ONE repair attempt with the validation errors.
 */
export async function generateJson<T extends z.ZodType>(
  args: GenerateJsonArgs<T>,
): Promise<GenerateJsonResult<z.infer<T>>> {
  if (aiConfig().text === 'mock') {
    const raw = await mockGenerate(args.task, args.prompt);
    return { data: args.schema.parse(raw), provider: 'mock', model: 'mock' };
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const jsonSchema = JSON.stringify(z.toJSONSchema(args.schema, { io: 'input' }));
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `${args.system}\n\nRespond with ONE JSON object only (no markdown) matching this JSON Schema:\n${jsonSchema}`,
    },
    { role: 'user', content: args.prompt },
  ];

  let tokensIn = 0;
  let tokensOut = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.chat.completions.create({
      model,
      messages,
      temperature: args.temperature ?? 0.8,
      response_format: { type: 'json_object' },
    });
    tokensIn += res.usage?.prompt_tokens ?? 0;
    tokensOut += res.usage?.completion_tokens ?? 0;
    const text = res.choices[0]?.message?.content ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(text));
    } catch {
      parsed = undefined;
    }
    const result = args.schema.safeParse(parsed);
    if (result.success)
      return { data: result.data, provider: 'openai', model, tokensIn, tokensOut };
    messages.push({ role: 'assistant', content: text });
    messages.push({
      role: 'user',
      content: `That JSON was invalid: ${result.error ? z.prettifyError(result.error) : 'not JSON'}. Return the corrected JSON object only.`,
    });
  }
  throw new Error(`AI output failed validation for task "${args.task}"`);
}

function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
}
