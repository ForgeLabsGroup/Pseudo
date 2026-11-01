import { getAdminClient } from '@pseudo/database';
import type { AgentName } from '@pseudo/shared';
import { publish } from './bus';

/**
 * Agent execution tracking. Every background workflow is wrapped in a run:
 * agent_runs row (queued -> running -> succeeded|failed) + agent_events rows + SSE events.
 */
export async function createRun(
  userId: string,
  agent: AgentName,
  personaId: string | null,
  input: unknown,
) {
  const { data, error } = await getAdminClient()
    .from('agent_runs')
    .insert({ user_id: userId, agent, persona_id: personaId, input, status: 'queued' })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export interface RunCtx {
  runId: string;
  userId: string;
  agent: AgentName;
  progress: (step: string, message: string, data?: unknown) => Promise<void>;
}

/**
 * Executes `fn` in the background (does not block the request). Errors are recorded, never thrown.
 * Hackathon decision: in-process jobs instead of Inngest — see docs/DECISIONS.md (ADR-003).
 */
export function runInBackground(
  userId: string,
  runId: string,
  agent: AgentName,
  personaId: string | null,
  fn: (ctx: RunCtx) => Promise<{ output?: unknown; provider?: string; model?: string } | void>,
) {
  const admin = getAdminClient();
  const ctx: RunCtx = {
    runId,
    userId,
    agent,
    progress: async (step, message, data) => {
      await admin
        .from('agent_events')
        .insert({ user_id: userId, run_id: runId, step, message, data: data ?? null });
      publish(userId, { type: 'run.progress', runId, agent, step, message });
    },
  };
  void (async () => {
    try {
      await admin
        .from('agent_runs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', runId);
      publish(userId, { type: 'run.started', runId, agent, personaId });
      const res = (await fn(ctx)) ?? {};
      await admin
        .from('agent_runs')
        .update({
          status: 'succeeded',
          output: res.output ?? null,
          provider: res.provider ?? null,
          model: res.model ?? null,
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId);
      publish(userId, { type: 'run.succeeded', runId, agent });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[run ${runId} ${agent}] failed:`, err);
      await admin
        .from('agent_runs')
        .update({ status: 'failed', error: message, finished_at: new Date().toISOString() })
        .eq('id', runId);
      publish(userId, { type: 'run.failed', runId, agent, error: message });
    }
  })();
}
