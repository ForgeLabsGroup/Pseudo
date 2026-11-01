import { getAdminClient } from '@pseudo/database';
import type { UsageOperation } from '@pseudo/shared';
import { publish } from './bus';
import type { RunCtx } from './runs';

/**
 * Records one paid Higgsfield request in provider_usage (pending -> succeeded|failed) around `fn`.
 * Higgsfield has no usage/balance API, so this ledger is what the Settings usage card shows.
 */
export async function trackHiggsfield<T>(
  ctx: RunCtx,
  entry: { operation: UsageOperation; personaId: string; videoSeconds?: number },
  fn: () => Promise<T>,
): Promise<T> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('provider_usage')
    .insert({
      user_id: ctx.userId,
      persona_id: entry.personaId,
      agent_run_id: ctx.runId,
      provider: 'higgsfield',
      operation: entry.operation,
      video_seconds: entry.videoSeconds ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  publish(ctx.userId, { type: 'usage.updated', provider: 'higgsfield' });

  const finish = async (status: 'succeeded' | 'failed', message: string | null) => {
    await admin
      .from('provider_usage')
      .update({ status, error: message, finished_at: new Date().toISOString() })
      .eq('id', data.id);
    publish(ctx.userId, { type: 'usage.updated', provider: 'higgsfield' });
  };
  try {
    const result = await fn();
    await finish('succeeded', null);
    return result;
  } catch (err) {
    await finish('failed', (err as Error).message);
    throw err;
  }
}
