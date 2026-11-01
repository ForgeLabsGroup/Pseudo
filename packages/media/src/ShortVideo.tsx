import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Video,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export interface ShortVideoScene {
  imageUrl: string | null;
  /** AI-animated clip of this scene (Higgsfield). Preferred over imageUrl when present. */
  videoUrl?: string | null;
  onScreenText: string;
  voiceover: string;
  durationSec: number;
}

export interface ShortVideoProps {
  personaHandle: string;
  hook: string;
  scenes: ShortVideoScene[];
  voiceoverUrl: string | null;
  [key: string]: unknown;
}

export const VIDEO_FPS = 30;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

export const durationInFrames = (p: Pick<ShortVideoProps, 'scenes'>) =>
  Math.max(1, Math.round(p.scenes.reduce((s, x) => s + x.durationSec, 0) * VIDEO_FPS));

function Scene({ scene }: { scene: ShortVideoScene }) {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const scale = interpolate(frame, [0, d], [1.05, 1.18]); // Ken Burns
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f14' }}>
      {scene.videoUrl ? (
        <Video
          src={scene.videoUrl}
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        scene.imageUrl && (
          <Img
            src={scene.imageUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${scale})`,
            }}
          />
        )
      )}
      <AbsoluteFill
        style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.75))' }}
      />
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: 80,
          paddingBottom: 260,
          opacity,
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: 72,
            fontWeight: 800,
            textAlign: 'center',
            fontFamily: 'Inter, sans-serif',
            textShadow: '0 4px 24px rgba(0,0,0,0.6)',
          }}
        >
          {scene.onScreenText}
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: 40,
            marginTop: 24,
            textAlign: 'center',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {scene.voiceover}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Template video: scene images with Ken Burns, captions, optional ElevenLabs voiceover. */
export function ShortVideo(props: ShortVideoProps) {
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {props.voiceoverUrl && <Audio src={props.voiceoverUrl} />}
      {props.scenes.map((scene, i) => {
        const frames = Math.max(1, Math.round(scene.durationSec * VIDEO_FPS));
        const el = (
          <Sequence key={i} from={from} durationInFrames={frames}>
            <Scene scene={scene} />
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
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-end', padding: 40 }}>
        <div
          style={{
            color: 'white',
            fontSize: 26,
            background: 'rgba(0,0,0,0.5)',
            padding: '8px 16px',
            borderRadius: 12,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          AI-generated
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
