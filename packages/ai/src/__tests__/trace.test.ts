import { afterEach, describe, expect, it } from 'vitest';
import { setCallObserver, traced, type CallTrace } from '../trace';

const record = () => {
  const traces: CallTrace[] = [];
  setCallObserver((t) => traces.push(t));
  return traces;
};

afterEach(() => setCallObserver(null));

describe('traced', () => {
  it('emits start then end with ok and the result passed through', async () => {
    const traces = record();
    const result = await traced('llm', 'strategy', async () => {
      expect(traces.map((t) => t.phase)).toEqual(['start']);
      return 42;
    });
    expect(result).toBe(42);
    expect(traces).toHaveLength(2);
    const [start, end] = traces;
    expect(start).toMatchObject({ phase: 'start', module: 'llm', label: 'strategy' });
    expect(end).toMatchObject({ phase: 'end', module: 'llm', label: 'strategy', ok: true });
    expect(end!.callId).toBe(start!.callId);
  });

  it('reports ok: false and rethrows the error', async () => {
    const traces = record();
    const boom = new Error('boom');
    await expect(
      traced('image', 'generate', async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(traces.map((t) => t.phase)).toEqual(['start', 'end']);
    expect(traces[1]).toMatchObject({ ok: false });
  });

  it('measures the call duration in ms', async () => {
    const traces = record();
    await traced('voice', 'tts', () => new Promise((r) => setTimeout(r, 40)));
    const end = traces[1] as Extract<CallTrace, { phase: 'end' }>;
    expect(end.ms).toBeGreaterThanOrEqual(30);
    expect(Number.isInteger(end.ms)).toBe(true);
  });

  it('works with no observer and survives a throwing observer', async () => {
    await expect(traced('llm', 'x', async () => 1)).resolves.toBe(1);
    setCallObserver(() => {
      throw new Error('observer down');
    });
    await expect(traced('llm', 'x', async () => 2)).resolves.toBe(2);
  });
});
