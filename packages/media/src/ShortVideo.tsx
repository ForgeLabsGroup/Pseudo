import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Video,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { ChartOverlay, ListOverlay } from './overlays';

export interface ShortVideoScene {
  imageUrl: string | null;
  /** AI-animated clip of this scene (Higgsfield). Preferred over imageUrl when present. */
  videoUrl?: string | null;
  onScreenText: string;
  voiceover: string;
  durationSec: number;
  /** Animated graphic over the clip. */
  overlay?: 'chart' | 'list' | null;
  overlayItems?: string[];
}

export interface ShortVideoProps {
  personaHandle: string;
  hook: string;
  scenes: ShortVideoScene[];
  voiceoverUrl: string | null;
  /** Instrumental background track. Ducked under the voiceover. */
  musicUrl?: string | null;
  [key: string]: unknown;
}

export const VIDEO_FPS = 30;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

export const durationInFrames = (p: Pick<ShortVideoProps, 'scenes'>) =>
  Math.max(1, Math.round(p.scenes.reduce((s, x) => s + x.durationSec, 0) * VIDEO_FPS));

/** Frames each scene overlaps the previous one while fading in, so a cut never shows a black frame. */
const CROSSFADE = 9;

function Scene({ scene, first, index }: { scene: ShortVideoScene; first: boolean; index: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const scale = interpolate(frame, [0, d], [1.05, 1.16]); // Ken Burns, only when there is no real clip
  // Fade in over the previous scene (which is still on screen underneath); the first scene just appears.
  const fadeIn = first ? 1 : interpolate(frame, [0, CROSSFADE], [0, 1], { extrapolateRight: 'clamp' });
  const fill = { width: '100%', height: '100%', objectFit: 'cover' } as const;
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      {/* Always render the still underneath: if the clip is still loading or ends early we never show black. */}
      {scene.imageUrl && (
        <Img
          src={scene.imageUrl}
          style={{ ...fill, transform: scene.videoUrl ? undefined : `scale(${scale})` }}
        />
      )}
      {scene.videoUrl && <Video src={scene.videoUrl} muted style={{ ...fill, position: 'absolute', inset: 0 }} />}
      {/* Soft dim behind the captions so white text stays readable on any photo. */}
      <AbsoluteFill
        style={{ background: 'radial-gradient(ellipse 80% 45% at 50% 55%, rgba(0,0,0,0.38), transparent 75%)' }}
      />
      {scene.overlay === 'chart' && <ChartOverlay seed={index + 3} delay={CROSSFADE + 4} />}
      {scene.overlay === 'list' && scene.overlayItems?.length ? (
        <ListOverlay items={scene.overlayItems} delay={CROSSFADE + 4} />
      ) : null}
      <Captions scene={scene} />
    </AbsoluteFill>
  );
}

/**
 * TikTok-style captions near the middle: the on-screen label pops in, and the spoken line appears a few
 * words at a time across the scene (reads like real burned-in subtitles instead of a static paragraph).
 */
function Captions({ scene }: { scene: ShortVideoScene }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: d } = useVideoConfig();
  const pop = spring({ frame: frame - CROSSFADE, fps, config: { damping: 12, stiffness: 160 } });
  const words = scene.voiceover.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 3) chunks.push(words.slice(i, i + 3).join(' '));
  const start = CROSSFADE + 4;
  const per = Math.max(1, (d - start - 6) / Math.max(1, chunks.length));
  const idx = Math.min(chunks.length - 1, Math.max(0, Math.floor((frame - start) / per)));
  const chunkFrame = frame - start - idx * per;
  const chunkPop = spring({ frame: chunkFrame, fps, config: { damping: 14, stiffness: 220 } });
  const stroke = '0 0 2px rgba(0,0,0,0.9), 0 3px 16px rgba(0,0,0,0.65)';
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 70px',
        transform: 'translateY(9%)', // just below centre: clears faces and the upper overlays
      }}
    >
      {scene.onScreenText && (
        <div
          style={{
            color: 'white',
            fontSize: 74,
            fontWeight: 900,
            lineHeight: 1.05,
            textAlign: 'center',
            fontFamily: 'Inter, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            textShadow: stroke,
            opacity: pop,
            transform: `scale(${interpolate(pop, [0, 1], [0.7, 1])})`,
          }}
        >
          {scene.onScreenText}
        </div>
      )}
      {frame >= start && chunks.length > 0 && (
        <div
          style={{
            marginTop: 30,
            padding: '10px 22px',
            borderRadius: 18,
            background: 'rgba(0,0,0,0.45)',
            color: '#fff',
            fontSize: 50,
            fontWeight: 800,
            textAlign: 'center',
            fontFamily: 'Inter, sans-serif',
            textShadow: stroke,
            transform: `scale(${interpolate(chunkPop, [0, 1], [0.88, 1])})`,
          }}
        >
          {chunks[idx]}
        </div>
      )}
    </AbsoluteFill>
  );
}

/**
 * Template video: scene clips/images with crossfades, mid-screen captions, voiceover + background music.
 * No burned-in AI label: disclosure is the #AIgenerated caption tag (Content Agent finalize) + <AiBadge/> in the app.
 */
export function ShortVideo(props: ShortVideoProps) {
  const total = durationInFrames(props);
  const musicVolume = props.voiceoverUrl ? 0.14 : 0.45; // duck under speech
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {props.voiceoverUrl && <Audio src={props.voiceoverUrl} />}
      {props.musicUrl && (
        <Audio
          src={props.musicUrl}
          loop
          volume={(f) =>
            musicVolume *
            interpolate(f, [0, 20, total - 45, total], [0, 1, 1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      )}
      {props.scenes.map((scene, i) => {
        const frames = Math.max(1, Math.round(scene.durationSec * VIDEO_FPS));
        const lead = i > 0 ? CROSSFADE : 0; // start early so the fade happens over the previous scene
        const el = (
          <Sequence key={i} from={from - lead} durationInFrames={frames + lead} premountFor={VIDEO_FPS}>
            <Scene scene={scene} first={i === 0} index={i} />
          </Sequence>
        );
        from += frames;
        return el;
      })}
      <AbsoluteFill style={{ padding: 60, alignItems: 'flex-start' }}>
        <div
          style={{ color: 'white', fontSize: 34, fontFamily: 'Inter, sans-serif', opacity: 0.85 }}
        >
          @{props.personaHandle}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
