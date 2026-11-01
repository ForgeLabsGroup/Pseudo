'use client';
import { durationInFrames, ShortVideo, VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from '@pseudo/media';
import type { ContentItem } from '@pseudo/shared';
import { Player } from '@remotion/player';
import { AiBadge } from '@/components/ui/badge';

/** In-browser preview of a short_video content item (scene images + voiceover + captions). Owner: Person C. */
export function VideoPreview({ item, handle }: { item: ContentItem; handle: string }) {
  if (item.body?.type !== 'short_video') return null;
  const sceneMedia = item.media.filter((m) => m.role === 'scene');
  const clips = item.media.filter((m) => m.role === 'scene_clip');
  const voice = item.media.find((m) => m.role === 'voiceover');
  const props = {
    personaHandle: handle,
    hook: item.body.hook,
    voiceoverUrl: voice?.url ?? null,
    scenes: item.body.scenes.map((s, i) => ({
      imageUrl: sceneMedia[i]?.url ?? null,
      videoUrl: clips[i]?.url ?? null,
      onScreenText: s.onScreenText,
      voiceover: s.voiceover,
      durationSec: s.durationSec,
    })),
  };
  return (
    <div className="relative">
      <Player
        component={ShortVideo}
        inputProps={props}
        durationInFrames={durationInFrames(props)}
        fps={VIDEO_FPS}
        compositionWidth={VIDEO_WIDTH}
        compositionHeight={VIDEO_HEIGHT}
        style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 16, overflow: 'hidden' }}
        controls
      />
      <AiBadge className="absolute right-2 top-2" />
    </div>
  );
}
