import { z } from 'zod';
import { AgentName, RunStatus } from './enums';

export const AgentRun = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  personaId: z.uuid().nullable(),
  agent: AgentName,
  status: RunStatus,
  input: z.unknown(),
  output: z.unknown().nullable(),
  error: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AgentRun = z.infer<typeof AgentRun>;

export const AgentEvent = z.object({
  id: z.uuid(),
  runId: z.uuid(),
  step: z.string(),
  message: z.string(),
  data: z.unknown().nullable(),
  createdAt: z.string(),
});
export type AgentEvent = z.infer<typeof AgentEvent>;

/**
 * Everything pushed over SSE (GET /api/events). The web app listens and invalidates
 * TanStack Query caches based on `type`.
 */
export const LiveEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('run.started'),
    runId: z.uuid(),
    agent: AgentName,
    personaId: z.uuid().nullable(),
  }),
  z.object({
    type: z.literal('run.progress'),
    runId: z.uuid(),
    agent: AgentName,
    step: z.string(),
    message: z.string(),
  }),
  z.object({ type: z.literal('run.succeeded'), runId: z.uuid(), agent: AgentName }),
  z.object({ type: z.literal('run.failed'), runId: z.uuid(), agent: AgentName, error: z.string() }),
  z.object({ type: z.literal('persona.updated'), personaId: z.uuid() }),
  z.object({ type: z.literal('archetype.updated'), archetypeId: z.uuid() }),
  z.object({ type: z.literal('content.updated'), contentId: z.uuid(), status: z.string() }),
  z.object({ type: z.literal('media.created'), assetId: z.uuid(), personaId: z.uuid().nullable() }),
  z.object({ type: z.literal('usage.updated'), provider: z.string() }),
  z.object({
    type: z.literal('publish.updated'),
    contentId: z.uuid(),
    jobId: z.uuid(),
    status: z.string(),
  }),
]);
export type LiveEvent = z.infer<typeof LiveEvent>;
