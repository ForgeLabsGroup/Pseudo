/**
 * End-to-end check of the research pipeline for ONE influencer, with whatever keys are set:
 *   handles (config/archetypes.json) -> source (Apify|mock) -> download -> store -> watcher -> analysis
 *
 *   pnpm --filter @pseudo/api research:smoke --archetype trader --influencer trader-1
 *   flags: --videos 1  --platform instagram|tiktok|youtube  --no-store (skip Supabase upload)
 *          --source-only (just check the handles return videos; no download/watch)
 * Nothing is written to the DB; with the store enabled the video IS uploaded to research-videos.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { acquireVideo, getSource, getWatcher, videoKey, type VideoStore } from '@pseudo/research';
import { InfluencerHandles } from '@pseudo/shared';
import { researchVideoStore, researchVideoUrl } from '../lib/research-storage';

const { values } = parseArgs({
  options: {
    archetype: { type: 'string', default: 'trader' },
    influencer: { type: 'string', default: 'trader-1' },
    videos: { type: 'string', default: '1' },
    platform: { type: 'string' },
    'no-store': { type: 'boolean', default: false },
    'source-only': { type: 'boolean', default: false },
  },
});

const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => console.log(`  ✗ ${m}`);
const has = (k: string) => (process.env[k] ? 'set' : 'MISSING');

console.log('Config');
console.log(
  `  RESEARCH_SOURCE=${process.env.RESEARCH_SOURCE ?? 'mock'}  RESEARCH_WATCHER=${process.env.RESEARCH_WATCHER ?? 'mock'}`,
);
console.log(
  `  APIFY_TOKEN ${has('APIFY_TOKEN')} | FEATHERLESS_API_KEY ${has('FEATHERLESS_API_KEY')} | SUPABASE_SERVICE_ROLE_KEY ${has('SUPABASE_SERVICE_ROLE_KEY')}`,
);
console.log(
  `  VIDEO_MODEL_NAME=${process.env.VIDEO_MODEL_NAME ?? '(default google/gemma-3-27b-it)'}  TRANSCRIBE_PROVIDER=${process.env.TRANSCRIBE_PROVIDER ?? 'none'}`,
);

const config = JSON.parse(
  readFileSync(new URL('../../../../config/archetypes.json', import.meta.url), 'utf8'),
) as {
  archetypes: {
    slug: string;
    name: string;
    influencers: { label: string; handles: Record<string, string> }[];
  }[];
};
const archetype = config.archetypes.find((a) => a.slug === values.archetype);
const influencer = archetype?.influencers.find((i) => i.label === values.influencer);
if (!archetype || !influencer) {
  console.error(`Unknown --archetype/--influencer (${values.archetype}/${values.influencer})`);
  process.exit(1);
}
const handles = InfluencerHandles.parse(
  Object.fromEntries(
    Object.entries(influencer.handles)
      .filter(([k, v]) => v.trim() && (!values.platform || k === values.platform))
      .map(([k, v]) => [k, v.trim().replace(/^@/, '')]),
  ),
);
const limit = Math.max(1, Number(values.videos));
let failed = false;

console.log(
  `\n1. Source (${getSource().name}) -> ${influencer.label} ${JSON.stringify(Object.keys(handles))}`,
);
let videos;
try {
  videos = await getSource().getRecentVideos(handles, limit);
  videos.length
    ? ok(`${videos.length} video(s)`)
    : bad('no videos returned (wrong handle or actor input?)');
  for (const v of videos)
    console.log(
      `    ${v.platform} views=${v.views ?? '?'} file-url=${v.videoUrl ? 'yes' : 'no (will use yt-dlp)'} ${v.postUrl}`,
    );
  const posts = await getSource()
    .getRecentPosts(handles, 5)
    .catch((e: Error) => (bad(`X posts: ${e.message}`), []));
  if (handles.x) ok(`${posts.length} X post(s)`);
} catch (e) {
  bad((e as Error).message);
  process.exit(1);
}
if (!videos.length) process.exit(1);
if (values['source-only']) process.exit(0);

const watcher = getWatcher();
console.log(
  `\n2. Download + store (${values['no-store'] ? 'local only' : 'Supabase research-videos'})`,
);
const store: VideoStore | undefined = values['no-store'] ? undefined : researchVideoStore();
for (const video of videos.slice(0, limit)) {
  if (!watcher.needsMedia && getSource().name === 'mock') {
    ok('mock source + mock watcher: nothing to download');
    break;
  }
  const key = videoKey(archetype.slug, influencer.label, video);
  try {
    const a = await acquireVideo(video, { store, key });
    ok(
      `${(a.sizeBytes / 1e6).toFixed(1)} MB ${a.mimeType} sha256=${a.contentHash.slice(0, 12)}… ${a.fromStore ? '(from store)' : 'downloaded'}`,
    );
    for (const w of a.warnings) bad(w);
    if (a.storageKey) {
      ok(`stored as ${a.storageKey}`);
      console.log(
        `    signed URL (1h): ${await researchVideoUrl(a.storageKey, 3600).catch((e: Error) => `unavailable: ${e.message}`)}`,
      );
    }

    console.log(`\n3. Watcher (${watcher.name})`);
    const analysis = await watcher.watch(video, {
      archetypeName: archetype.name,
      media: a,
      onMeta: (m) =>
        console.log(
          `    meta: ${JSON.stringify({ ...m, transcript: m.transcript?.slice(0, 60) })}`,
        ),
    });
    ok('analysis parsed against VideoAnalysis');
    console.log(
      `    hookType: ${analysis.hookType}\n    hook: ${analysis.hook}\n    tone: ${analysis.tone}\n    structure: ${analysis.structure.join(' > ')}`,
    );
    await a.cleanup();
  } catch (e) {
    failed = true;
    bad((e as Error).message);
  }
}
process.exit(failed ? 1 : 0);
