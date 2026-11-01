import OpenAI from 'openai';
import { z } from 'zod';
import { aiConfig } from './config';
import { mockGenerate } from './mock/text';

export interface GenerateJsonArgs<T extends z.ZodType> {
  /** Stable task id; also used by the mock provider to pick a fixture. */
  task: 'persona' | 'strategy' | 'content' | 'image_prompt' | 'analytics' | 'research';
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
 * OpenAI-compat endpoint, Groq, Featherless...). We ask for JSON, give the JSON Schema in the prompt,
 * validate with Zod, and do ONE repair attempt with the validation errors.
 */
export async function generateJson<T extends z.ZodType>(
  args: GenerateJsonArgs<T>,
): Promise<GenerateJsonResult<z.infer<T>>> {
  if (aiConfig().text === 'mock') {
    const raw = await mockGenerate(args.task, args.prompt);
    return { data: args.schema.parse(raw), provider: 'mock', model: 'mock' };
  }

  const { client, model, provider, busyRetryDelaysMs } = textClient();
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
  // Some OpenAI-compatible hosts (open models) reject response_format; the prompt already asks for JSON.
  let jsonMode = true;
  const complete = async () => {
    const body = { model, messages, temperature: args.temperature ?? 0.8 };
    if (!jsonMode) return client.chat.completions.create(body);
    try {
      return await client.chat.completions.create({
        ...body,
        response_format: { type: 'json_object' },
      });
    } catch (err) {
      if ((err as { status?: number }).status !== 400) throw err;
      jsonMode = false;
      return client.chat.completions.create(body);
    }
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await retryWhileBusy(complete, busyRetryDelaysMs);
    tokensIn += res.usage?.prompt_tokens ?? 0;
    tokensOut += res.usage?.completion_tokens ?? 0;
    const text = res.choices[0]?.message?.content ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(text));
    } catch {
      parsed = undefined;
    }
    const result = args.schema.safeParse(parsed);
    if (result.success)
      return { data: result.data, provider, model, tokensIn, tokensOut };
    messages.push({ role: 'assistant', content: text });
    messages.push({
      role: 'user',
      content: `That JSON was invalid: ${result.error ? z.prettifyError(result.error) : 'not JSON'}. Return the corrected JSON object only.`,
    });
  }
  throw new Error(`AI output failed validation for task "${args.task}"`);
}

function textClient(): {
  client: OpenAI;
  model: string;
  provider: string;
  busyRetryDelaysMs: number[];
} {
  if (aiConfig().text === 'featherless') {
    if (!process.env.FEATHERLESS_API_KEY)
      throw new Error('AI_TEXT_PROVIDER=featherless needs FEATHERLESS_API_KEY');
    return {
      client: new OpenAI({
        apiKey: process.env.FEATHERLESS_API_KEY,
        baseURL: process.env.FEATHERLESS_BASE_URL || 'https://api.featherless.ai/v1',
      }),
      model: process.env.FEATHERLESS_MODEL || 'deepseek-ai/DeepSeek-V3-0324',
      provider: 'featherless',
      // Featherless plans cap concurrent "units" across the whole key (big models take all 4),
      // so a 429 means "wait for the other request to finish", not "slow down a little".
      busyRetryDelaysMs: [15_000, 30_000, 60_000, 90_000],
    };
  }
  return {
    client: new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    }),
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    provider: 'openai',
    busyRetryDelaysMs: [],
  };
}

async function retryWhileBusy<T>(fn: () => Promise<T>, delaysMs: number[]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const delay = delaysMs[attempt];
      if (delay === undefined || (err as { status?: number }).status !== 429) throw err;
      console.warn(`[text] provider busy (429), retry ${attempt + 1} in ${delay / 1000}s`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/** The JSON object in a model reply: drops reasoning (<think>), code fences and any prose around it. */
export function extractJson(s: string): string {
  const text = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text.trim();
}
