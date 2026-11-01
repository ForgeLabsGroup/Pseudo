/**
 * Provider selection is env-driven so the demo always works:
 *   AI_TEXT_PROVIDER  = mock | openai   (openai = any OpenAI-compatible endpoint, incl. Gemini)
 *   AI_IMAGE_PROVIDER = mock | gemini | openai
 *   AI_VOICE_PROVIDER = mock | elevenlabs
 */
export const aiConfig = () => ({
  text: (process.env.AI_TEXT_PROVIDER ?? 'mock') as 'mock' | 'openai',
  image: (process.env.AI_IMAGE_PROVIDER ?? 'mock') as 'mock' | 'gemini' | 'openai',
  voice: (process.env.AI_VOICE_PROVIDER ?? 'mock') as 'mock' | 'elevenlabs',
});

export const isMockMode = () => aiConfig().text === 'mock';
