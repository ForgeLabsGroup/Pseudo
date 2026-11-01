import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const FONT = 'Inter, sans-serif';

/** Glass card in the upper part of the frame, clear of the mid-screen captions. */
function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 140 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 230 }}>
      <div
        style={{
          width: 900,
          padding: 36,
          borderRadius: 36,
          background: 'rgba(12,14,18,0.62)',
          border: '1.5px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
          transform: `translateY(${interpolate(pop, [0, 1], [40, 0])}px) scale(${interpolate(pop, [0, 1], [0.94, 1])})`,
          opacity: pop,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/**
 * Candlestick chart that draws itself left to right and trends up, for "markets / green day" moments.
 * Illustrative only: no prices, balances, P&L or percentages (never fabricate results).
 */
export function ChartOverlay({ seed = 7, delay = 10 }: { seed?: number; delay?: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const rand = seeded(seed * 9973 + 11);
  const N = 30;
  let price = 100;
  const candles = Array.from({ length: N }, (_, i) => {
    const drift = i > N * 0.45 ? 0.9 : -0.15; // chop first, then the move
    const open = price;
    const close = open + drift + (rand() - 0.45) * 3.2;
    const high = Math.max(open, close) + rand() * 1.6;
    const low = Math.min(open, close) - rand() * 1.6;
    price = close;
    return { open, close, high, low };
  });
  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const W = 828;
  const H = 400;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const shown = Math.floor(interpolate(frame, [delay, Math.max(delay + 1, d * 0.75)], [6, N], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const step = W / N;
  const last = candles[shown - 1]!;
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);
  return (
    <Card delay={delay - 6}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, fontFamily: FONT }}>
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 30, fontWeight: 700 }}>Chart · 5m</span>
        <span style={{ color: '#22c55e', fontSize: 30, fontWeight: 700 }}>▲ trending</span>
      </div>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="rgba(255,255,255,0.07)" strokeWidth={2} />
        ))}
        {candles.slice(0, shown).map((c, i) => {
          const up = c.close >= c.open;
          const color = up ? '#22c55e' : '#ef4444';
          const x = i * step + step / 2;
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={3} />
              <rect
                x={x - step * 0.32}
                width={step * 0.64}
                y={y(Math.max(c.open, c.close))}
                height={Math.max(3, Math.abs(y(c.open) - y(c.close)))}
                fill={color}
                rx={2}
              />
            </g>
          );
        })}
        <line x1={0} x2={W} y1={y(last.close)} y2={y(last.close)} stroke="#22c55e" strokeDasharray="8 8" strokeWidth={2} opacity={0.6} />
        <circle cx={(shown - 1) * step + step / 2} cy={y(last.close)} r={9 + pulse * 5} fill="#22c55e" opacity={0.35} />
      </svg>
    </Card>
  );
}

/** Steps/checklist that tick in one by one (routines, "3 things I check", etc.). */
export function ListOverlay({ items, delay = 10 }: { items: string[]; delay?: number }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: d } = useVideoConfig();
  const list = items.slice(0, 4);
  const gap = Math.max(8, Math.floor((d * 0.6) / Math.max(1, list.length)));
  return (
    <Card delay={delay - 6}>
      {list.map((item, i) => {
        const p = spring({ frame: frame - delay - i * gap, fps, config: { damping: 14 } });
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              padding: '14px 0',
              opacity: p,
              transform: `translateX(${interpolate(p, [0, 1], [-30, 0])}px)`,
              fontFamily: FONT,
            }}
          >
            <span
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                background: '#22c55e',
                color: '#06210f',
                fontSize: 30,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${p})`,
              }}
            >
              ✓
            </span>
            <span style={{ color: 'white', fontSize: 44, fontWeight: 700 }}>{item}</span>
          </div>
        );
      })}
    </Card>
  );
}
