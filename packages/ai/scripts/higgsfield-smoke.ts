/**
 * One billable Kling 3.0 generation (shortest clip). Run once to verify credentials:
 *   pnpm --filter @pseudo/ai smoke:higgsfield
 * Text-to-video, 3s, 16:9. Prints the video URL only; never prints credentials.
 */
import { KLING_T2V_MODEL, subscribeVideo } from '../src/higgsfield';

try {
  const { url, requestId } = await subscribeVideo(KLING_T2V_MODEL, {
    prompt: 'A cinematic scene at sunset',
    duration: 3,
    aspect_ratio: '16:9',
    sound: 'off',
  });
  console.log(`OK request=${requestId}\n${url}`);
} catch (e) {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
}
