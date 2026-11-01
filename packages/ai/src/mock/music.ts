/**
 * Zero-key background music: a chill lo-fi loop (chords + bass + soft drums + a bit of vinyl crackle)
 * synthesised in plain TypeScript and returned as a mono 16-bit WAV. Deterministic, ~1.5 MB per 25s.
 */
const RATE = 32000;
const BPM = 88;

// Am9 - Fmaj7 - Cmaj7 - G6 (root + chord tones, Hz)
const CHORDS = [
  { root: 110.0, notes: [164.81, 196.0, 246.94, 261.63] },
  { root: 87.31, notes: [130.81, 164.81, 220.0, 261.63] },
  { root: 130.81, notes: [196.0, 246.94, 261.63, 329.63] },
  { root: 98.0, notes: [146.83, 196.0, 246.94, 329.63] },
];

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function synthMusicWav(durationSec: number): { data: Buffer; durationSec: number } {
  const secs = Math.max(8, Math.min(90, Math.ceil(durationSec)));
  const n = secs * RATE;
  const out = new Float32Array(n);
  const rand = rng(1337);
  const beat = 60 / BPM;
  const bar = beat * 4;

  const add = (start: number, len: number, fn: (t: number) => number) => {
    const s0 = Math.floor(start * RATE);
    const s1 = Math.min(n, Math.floor((start + len) * RATE));
    for (let i = s0; i < s1; i++) out[i]! += fn((i - s0) / RATE);
  };

  const bars = Math.ceil(secs / bar);
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    const chord = CHORDS[b % CHORDS.length]!;
    // Warm pad: two slightly detuned sines per note, slow attack/release.
    for (const f of chord.notes) {
      add(t0, bar + 0.5, (t) => {
        const env = Math.min(1, t / 0.5) * Math.min(1, (bar + 0.5 - t) / 0.5);
        const w = Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.004 * t);
        return w * 0.035 * env * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.25 * t));
      });
    }
    // Bass on beat 1 and the "and" of beat 2.
    for (const off of [0, beat * 1.5]) {
      add(t0 + off, beat * 1.2, (t) => Math.sin(2 * Math.PI * chord.root * t) * 0.3 * Math.exp(-t * 3.2));
    }
    for (let k = 0; k < 4; k++) {
      const tb = t0 + k * beat;
      // Kick on 1 and 3.
      if (k % 2 === 0)
        add(tb, 0.3, (t) => Math.sin(2 * Math.PI * (45 * t + (75 * (1 - Math.exp(-t * 28))) / 28)) * 0.55 * Math.exp(-t * 14));
      // Soft snare/clap on 2 and 4.
      if (k % 2 === 1)
        add(tb, 0.18, (t) => (rand() * 2 - 1) * 0.16 * Math.exp(-t * 22) + Math.sin(2 * Math.PI * 190 * t) * 0.08 * Math.exp(-t * 30));
    }
    // Swung closed hats on eighths.
    for (let k = 0; k < 8; k++) {
      const tb = t0 + k * (beat / 2) + (k % 2 ? 0.035 : 0);
      let prev = 0;
      add(tb, 0.06, (t) => {
        const x = rand() * 2 - 1;
        const hp = x - prev;
        prev = x;
        return hp * 0.05 * Math.exp(-t * 70) * (k % 2 ? 0.7 : 1);
      });
    }
  }
  // Vinyl crackle.
  for (let i = 0; i < secs * 18; i++) {
    const at = rand() * secs;
    add(at, 0.004, (t) => (rand() * 2 - 1) * 0.05 * Math.exp(-t * 900));
  }

  // Master: gentle low-pass for warmth, soft clip, normalise, fade in/out.
  let lp = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    lp += (out[i]! - lp) * 0.42;
    out[i] = Math.tanh(lp * 1.6);
    peak = Math.max(peak, Math.abs(out[i]!));
  }
  const gain = peak > 0 ? 0.85 / peak : 1;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const fade = Math.min(1, t / 0.6) * Math.min(1, (secs - t) / 1.5);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out[i]! * gain * fade * 32767))), 44 + i * 2);
  }
  return { data: buf, durationSec: secs };
}
