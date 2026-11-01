import type { LiveEvent } from '@pseudo/shared';

/** One human line per live event, shared by the Command Center feed and the Core HUD log. */
export function describe(e: LiveEvent): { who: string; text: string; tone?: string } {
  switch (e.type) {
    case 'run.started':
      return { who: e.agent, text: 'Started' };
    case 'run.progress':
      return { who: e.agent, text: e.message };
    case 'run.succeeded':
      return { who: e.agent, text: 'Finished' };
    case 'run.failed':
      return { who: e.agent, text: `Failed: ${e.error}`, tone: 'text-danger' };
    case 'persona.updated':
      return { who: 'persona', text: 'Identity updated' };
    case 'archetype.updated':
      return { who: 'research', text: 'Playbook refreshed' };
    case 'content.updated':
      return { who: 'content', text: e.status.replace('_', ' ') };
    case 'media.created':
      return { who: 'visual', text: 'New photo ready' };
    case 'usage.updated':
      return { who: e.provider, text: 'Paid request logged' };
    case 'publish.updated':
      return {
        who: 'distribution',
        text: e.status,
        tone:
          e.status === 'published'
            ? 'text-success'
            : e.status === 'failed'
              ? 'text-danger'
              : undefined,
      };
    case 'call.started':
      return { who: e.agent, text: `${e.module} · ${e.label}` };
    case 'call.finished':
      return {
        who: e.agent,
        text: `${e.module} · ${e.ms}ms`,
        tone: e.ok ? undefined : 'text-danger',
      };
  }
}
