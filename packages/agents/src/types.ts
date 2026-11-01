/** Agents report progress through this callback; apps/api persists it to agent_events + SSE. */
export type ProgressFn = (step: string, message: string, data?: unknown) => void | Promise<void>;
export const noProgress: ProgressFn = () => {};
