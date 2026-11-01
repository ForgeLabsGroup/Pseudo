/**
 * One billable Marketing Studio image (1k, ~$0.011). Optional arg: a public selfie URL to test edit mode.
 *   pnpm --filter @pseudo/ai smoke:higgsfield:image [selfieUrl]
 * Prints size/mime only; never prints credentials.
 */
import { higgsfieldImage } from '../src/higgsfield';

const selfie = process.argv[2];
try {
  const img = await higgsfieldImage({
    prompt: selfie
      ? 'Same person standing on a luxury yacht off South Beach Miami at golden hour, photoreal'
      : 'A luxury yacht off South Beach Miami at golden hour, photoreal',
    referenceUrls: selfie ? [selfie] : undefined,
    aspectRatio: '4:5',
  });
  console.log(`OK ${img.model} ${img.mimeType} ${img.data.length} bytes`);
  const { writeFileSync } = await import('node:fs');
  const out = process.env.SMOKE_OUT ?? 'higgsfield-smoke.png';
  writeFileSync(out, img.data);
  console.log('saved', out);
} catch (e) {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
}
