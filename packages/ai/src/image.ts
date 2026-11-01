import { GoogleGenAI } from '@google/genai';
import OpenAI, { toFile } from 'openai';
import { aiConfig } from './config';
import { mockImage } from './mock/image';

export interface ReferenceImage {
  data: Buffer;
  mimeType: string;
}

export interface GenerateImageArgs {
  prompt: string;
  /** The user's own selfies. Used to keep the persona's face = the user's face. */
  references?: ReferenceImage[];
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9';
}

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
  provider: string;
  model: string;
}

/** How many of the user's selfies to send as references. More = better likeness on Pro-tier models. */
export const maxReferenceImages = () => Number(process.env.MAX_REFERENCE_IMAGES ?? 4);

export async function generateImage(args: GenerateImageArgs): Promise<GeneratedImage> {
  const provider = aiConfig().image;
  if (provider === 'gemini') return geminiImage(args);
  if (provider === 'openai') return openaiImage(args);
  return mockImage(args);
}

async function geminiImage(args: GenerateImageArgs): Promise<GeneratedImage> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.5-flash-image';
  const refs = (args.references ?? []).slice(0, maxReferenceImages());
  const prompt = refs.length
    ? `${args.prompt}\n\nThe person in this photo must be the same person shown in the reference photo(s): keep their face, skin tone, hair and build recognisable. Photorealistic.`
    : args.prompt;
  const res = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          ...refs.map((r) => ({
            inlineData: { mimeType: r.mimeType, data: r.data.toString('base64') },
          })),
          { text: prompt },
        ],
      },
    ],
    config: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: args.aspectRatio ?? '4:5' },
    },
  });
  const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data)
    throw new Error('Gemini returned no image (possibly blocked by safety filters)');
  return {
    data: Buffer.from(part.inlineData.data, 'base64'),
    mimeType: part.inlineData.mimeType ?? 'image/png',
    provider: 'gemini',
    model,
  };
}

async function openaiImage(args: GenerateImageArgs): Promise<GeneratedImage> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';
  const size =
    args.aspectRatio === '16:9'
      ? '1536x1024'
      : args.aspectRatio === '1:1'
        ? '1024x1024'
        : '1024x1536';
  const refs = args.references ?? [];
  const res = refs.length
    ? await client.images.edit({
        model,
        prompt: args.prompt,
        size,
        image: await Promise.all(
          refs.slice(0, 3).map((r, i) => toFile(r.data, `ref${i}.png`, { type: r.mimeType })),
        ),
      })
    : await client.images.generate({ model, prompt: args.prompt, size });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image');
  return { data: Buffer.from(b64, 'base64'), mimeType: 'image/png', provider: 'openai', model };
}
