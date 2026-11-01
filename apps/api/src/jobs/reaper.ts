import { getAdminClient } from '@pseudo/database';
import type { AgentName } from '@pseudo/shared';
import { publish } from '../lib/bus';

/**
 * Jobs run in-process (ADR-003), so an API restart kills them mid-flight and they never reach
 * their own catch blocks: runs stay "running", content stays "generating", likeness training
 * stays "training". This marks such runs failed and does the cleanup each job's catch would have.
 *
 * Staleness is inactivity, not "started before this process": several API instances (local dev,
 * Render) share one database, and a restart here must not fail jobs another instance is running.
 * 15 min is longer than any single silent wait in a job (Higgsfield polling gives up at 10 min).
 */
export const STALE_AFTER_MS = 15 * 60_000;
const INTERRUPTED = 'Interrupted: the server stopped before this job finished. Try again.';

export function startRunReaper(intervalMs = 5 * 60_000) {
  const tick = () => reapStaleRuns().catch((err) => console.error('[reaper] sweep failed', err));
  void tick();
  const timer = setInterval(tick, intervalMs);
  return () => clearInterval(timer);
}

export async function reapStaleRuns(now = Date.now()) {
  const admin = getAdminClient();
  const { data: open, error } = await admin
    .from('agent_runs')
    .select('id, user_id, persona_id, agent, input, created_at, started_at')
    .in('status', ['queued', 'running']);
  if (error) throw new Error(error.message);

  const reaped: string[] = [];
  for (const run of open ?? []) {
    const { data: last } = await admin
      .from('agent_events')
      .select('created_at')
      .eq('run_id', run.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastActivity = Math.max(
      ...[run.created_at, run.started_at, last?.created_at]
        .filter(Boolean)
        .map((t) => Date.parse(t as string)),
    );
    if (now - lastActivity < STALE_AFTER_MS) continue;

    // Guarded on status so a run that finished meanwhile is left alone.
    const { data: claimed } = await admin
      .from('agent_runs')
      .update({ status: 'failed', error: INTERRUPTED, finished_at: new Date(now).toISOString() })
      .eq('id', run.id)
      .in('status', ['queued', 'running'])
      .select('id');
    if (!claimed?.length) continue;
    await cleanUp(run);
    publish(run.user_id, {
      type: 'run.failed',
      runId: run.id,
      agent: run.agent as AgentName,
      error: INTERRUPTED,
    });
    reaped.push(run.id);
  }
  if (reaped.length) console.warn(`[reaper] marked ${reaped.length} interrupted run(s) failed`);
  return reaped;
}

type Run = {
  id: string;
  user_id: string;
  persona_id: string | null;
  agent: string;
  input: Record<string, unknown> | null;
};

async function cleanUp(run: Run) {
  const admin = getAdminClient();
  const input = run.input ?? {};

  // Content generation links items by agent_run_id; regenerate and video pass contentId.
  const contentIds = new Set<string>();
  const { data: linked } = await admin
    .from('content_items')
    .select('id')
    .eq('agent_run_id', run.id)
    .eq('status', 'generating');
  for (const r of linked ?? []) contentIds.add(r.id);
  if (typeof input.contentId === 'string') contentIds.add(input.contentId);
  if (contentIds.size) {
    // A video build only adds media to a finished script, so the script goes back to review.
    const status = run.agent === 'video' ? 'awaiting_approval' : 'failed';
    const error = run.agent === 'video' ? `Video: ${INTERRUPTED}` : INTERRUPTED;
    const { data: reset } = await admin
      .from('content_items')
      .update({ status, error })
      .in('id', [...contentIds])
      .eq('status', 'generating')
      .select('id');
    for (const r of reset ?? [])
      publish(run.user_id, { type: 'content.updated', contentId: r.id, status });
  }

  if (run.persona_id && run.agent === 'persona') {
    await admin
      .from('personas')
      .update({ status: 'failed' })
      .eq('id', run.persona_id)
      .eq('status', 'generating');
    publish(run.user_id, { type: 'persona.updated', personaId: run.persona_id });
  }

  if (run.persona_id && input.step === 'train_character' && typeof input.provider === 'string') {
    const { data: persona } = await admin
      .from('personas')
      .select('character_refs')
      .eq('id', run.persona_id)
      .maybeSingle();
    const ref = persona?.character_refs?.[input.provider];
    if (ref?.status === 'training') {
      await admin
        .from('personas')
        .update({
          character_refs: {
            ...persona!.character_refs,
            [input.provider]: {
              ...ref,
              status: 'failed',
              error: INTERRUPTED,
              updatedAt: new Date().toISOString(),
            },
          },
        })
        .eq('id', run.persona_id);
      publish(run.user_id, { type: 'persona.updated', personaId: run.persona_id });
    }
  }

  const { data: usage } = await admin
    .from('provider_usage')
    .update({ status: 'failed', error: INTERRUPTED, finished_at: new Date().toISOString() })
    .eq('agent_run_id', run.id)
    .eq('status', 'pending')
    .select('provider');
  for (const provider of new Set((usage ?? []).map((u) => u.provider as string)))
    publish(run.user_id, { type: 'usage.updated', provider });
}
