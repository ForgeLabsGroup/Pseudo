import type { AgentName, CallModule, LiveEvent } from '@pseudo/shared';

/**
 * Static graph for the Core view: the user at the centre, agents on an inner ring, and the
 * modules they call on an outer Fibonacci shell. Positions are fixed; only light moves.
 */

export type Vec3 = [number, number, number];
export type GraphAgent = Extract<
  AgentName,
  'persona' | 'research' | 'strategy' | 'content' | 'visual' | 'video' | 'distribution'
>;
export type GraphModule = CallModule | 'database';
export type NodeKind = 'core' | 'agent' | 'module';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  position: Vec3;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  /** Control point of the quadratic bezier: the midpoint pushed outward so edges bow. */
  control: Vec3;
}

export const CORE_ID = 'core';
export const agentId = (a: GraphAgent) => `agent:${a}`;
export const moduleId = (m: GraphModule) => `module:${m}`;

const AGENTS: { id: GraphAgent; label: string }[] = [
  { id: 'persona', label: 'Persona' },
  { id: 'research', label: 'Research' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'content', label: 'Content' },
  { id: 'visual', label: 'Visual' },
  { id: 'video', label: 'Video' },
  { id: 'distribution', label: 'Distribution' },
];

const MODULES: { id: GraphModule; label: string }[] = [
  { id: 'llm', label: 'LLM' },
  { id: 'image', label: 'Image gen' },
  { id: 'voice', label: 'Voice' },
  { id: 'video', label: 'Video gen' },
  { id: 'social', label: 'Social scraper' },
  { id: 'watcher', label: 'Video watcher' },
  { id: 'publisher', label: 'Publisher' },
  { id: 'database', label: 'Database' },
];

/** Which modules each agent calls. */
const CALLS: Record<GraphAgent, GraphModule[]> = {
  persona: ['llm', 'database'],
  research: ['social', 'watcher', 'llm', 'database'],
  strategy: ['llm'],
  content: ['llm', 'database'],
  visual: ['llm', 'image', 'database'],
  video: ['voice', 'video', 'database'],
  distribution: ['publisher', 'database'],
};

const AGENT_RADIUS = 2.1;
const MODULE_RADIUS = 4.1;

function agentPosition(i: number, n: number): Vec3 {
  const a = (i / n) * Math.PI * 2;
  return [Math.cos(a) * AGENT_RADIUS, i % 2 ? 0.45 : -0.45, Math.sin(a) * AGENT_RADIUS];
}

/** Evenly spread points on a sphere (golden-angle spiral). */
function fibonacciPosition(i: number, n: number): Vec3 {
  const y = 1 - ((i + 0.5) / n) * 2;
  const r = Math.sqrt(1 - y * y);
  const theta = i * Math.PI * (3 - Math.sqrt(5));
  return [
    Math.cos(theta) * r * MODULE_RADIUS,
    y * MODULE_RADIUS * 0.8,
    Math.sin(theta) * r * MODULE_RADIUS,
  ];
}

function bowedControl(a: Vec3, b: Vec3, bow: number): Vec3 {
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const len = Math.hypot(...mid) || 1;
  // A spoke from the centre has a near-zero midpoint: bow it upward instead.
  if (len < 0.01) return [mid[0], mid[1] + bow, mid[2]];
  const k = (len + bow) / len;
  return [mid[0] * k, mid[1] * k, mid[2] * k];
}

export const NODES: GraphNode[] = [
  { id: CORE_ID, kind: 'core', label: 'You', position: [0, 0, 0] },
  ...AGENTS.map((a, i) => ({
    id: agentId(a.id),
    kind: 'agent' as const,
    label: a.label,
    position: agentPosition(i, AGENTS.length),
  })),
  ...MODULES.map((m, i) => ({
    id: moduleId(m.id),
    kind: 'module' as const,
    label: m.label,
    position: fibonacciPosition(i, MODULES.length),
  })),
];

export const NODE_INDEX = new Map(NODES.map((n, i) => [n.id, i]));
const pos = (id: string) => NODES[NODE_INDEX.get(id)!]!.position;

function edge(from: string, to: string, bow: number): GraphEdge {
  return { id: `${from}->${to}`, from, to, control: bowedControl(pos(from), pos(to), bow) };
}

export const EDGES: GraphEdge[] = [
  ...AGENTS.map((a) => edge(CORE_ID, agentId(a.id), 0.35)),
  ...AGENTS.flatMap((a) => CALLS[a.id].map((m) => edge(agentId(a.id), moduleId(m), 0.9))),
];

const EDGE_INDEX = new Map(EDGES.map((e, i) => [e.id, i]));

/** Edge index for a hop in either direction; `reverse` says the pulse runs to -> from. */
export function findEdge(from: string, to: string): { index: number; reverse: boolean } | null {
  const fwd = EDGE_INDEX.get(`${from}->${to}`);
  if (fwd !== undefined) return { index: fwd, reverse: false };
  const back = EDGE_INDEX.get(`${to}->${from}`);
  return back !== undefined ? { index: back, reverse: true } : null;
}

const GRAPH_AGENTS = new Set<string>(AGENTS.map((a) => a.id));
const isGraphAgent = (a: string): a is GraphAgent => GRAPH_AGENTS.has(a);

/** generateJson task -> the agent that really asked for it (sub-agents run inside parent runs). */
const LLM_TASK_AGENT: Record<string, GraphAgent> = {
  persona: 'persona',
  strategy: 'strategy',
  content: 'content',
  image_prompt: 'visual',
  research: 'research',
};

/** Module -> its usual caller, when the run's own agent has no edge to it. */
const MODULE_OWNER: Record<GraphModule, GraphAgent> = {
  llm: 'content',
  image: 'visual',
  voice: 'video',
  video: 'video',
  social: 'research',
  watcher: 'research',
  publisher: 'distribution',
  database: 'content',
};

/** run.progress step -> the agent doing that step. */
const STEP_AGENT: Record<string, GraphAgent> = {
  plan: 'strategy',
  write: 'content',
  finalize: 'content',
  draft: 'persona',
  review: 'persona',
  prompt: 'visual',
  render: 'visual',
  train: 'visual',
  upload: 'visual',
  save: 'visual',
  image_failed: 'visual',
  voice: 'video',
  animate: 'video',
  research: 'research',
  fetch: 'research',
  download: 'research',
  watch: 'research',
  synthesize: 'research',
};

/** The agent that actually did the work behind `event`, or null if it isn't agent work. */
export function resolveSource(event: LiveEvent): GraphAgent | null {
  switch (event.type) {
    case 'call.started':
    case 'call.finished': {
      if (event.module === 'llm' && LLM_TASK_AGENT[event.label])
        return LLM_TASK_AGENT[event.label]!;
      if (isGraphAgent(event.agent) && CALLS[event.agent].includes(event.module))
        return event.agent;
      return MODULE_OWNER[event.module];
    }
    case 'run.progress':
      return STEP_AGENT[event.step] ?? (isGraphAgent(event.agent) ? event.agent : null);
    case 'run.started':
    case 'run.succeeded':
    case 'run.failed':
      return isGraphAgent(event.agent) ? event.agent : null;
    case 'content.updated':
      return 'content';
    case 'media.created':
      return 'visual';
    case 'persona.updated':
      return 'persona';
    case 'archetype.updated':
      return 'research';
    case 'publish.updated':
      return 'distribution';
    default:
      return null;
  }
}

export const MODULE_LABEL: Record<GraphModule, string> = Object.fromEntries(
  MODULES.map((m) => [m.id, m.label]),
) as Record<GraphModule, string>;
export const AGENT_LABEL: Record<GraphAgent, string> = Object.fromEntries(
  AGENTS.map((a) => [a.id, a.label]),
) as Record<GraphAgent, string>;
