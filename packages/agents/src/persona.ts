import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { generateJson, playbookContext, SAFETY_BLOCK } from '@pseudo/ai';
import { PersonaIdentity, type ArchetypePlaybook } from '@pseudo/shared';
import { noProgress, type ProgressFn } from './types';

/**
 * Persona Agent: description -> PersonaIdentity.
 * Graph: draft -> review -> END. "review" enforces safety/consistency fixes the model may miss.
 */
const State = Annotation.Root({
  description: Annotation<string>,
  instructions: Annotation<string | undefined>,
  existing: Annotation<PersonaIdentity | undefined>,
  playbook: Annotation<ArchetypePlaybook | undefined>,
  identity: Annotation<PersonaIdentity | undefined>,
  meta: Annotation<{ provider: string; model: string } | undefined>,
});

const SYSTEM = `You are the Persona Agent for PSEUDO, a creative studio where users LARP as a fictional alter ego.
Create a vivid, internally consistent fictional identity for social media. The persona's face and body are the user's own
(the user will appear in generated photos), so do not describe specific facial features.
${SAFETY_BLOCK}`;

export function buildPersonaGraph(progress: ProgressFn = noProgress) {
  return new StateGraph(State)
    .addNode('draft', async (s) => {
      await progress('draft', 'Drafting identity, backstory and voice');
      const prompt = [
        `User's description of the alter ego they want to become:\n"""${s.description}"""`,
        s.existing
          ? `Existing identity (keep what is not asked to change):\n${JSON.stringify(s.existing)}`
          : '',
        s.instructions ? `Extra direction from the user: ${s.instructions}` : '',
        playbookContext(s.playbook),
      ]
        .filter(Boolean)
        .join('\n\n');
      const res = await generateJson({
        task: 'persona',
        system: SYSTEM,
        prompt,
        schema: PersonaIdentity,
      });
      return { identity: res.data, meta: { provider: res.provider, model: res.model } };
    })
    .addNode('review', async (s) => {
      await progress('review', 'Checking consistency and safety rules');
      const id = s.identity!;
      // Deterministic post-processing: handles must be clean, every bio flagged as not advice when finance-related.
      const handle = id.handle
        .replace(/^@/, '')
        .replace(/[^a-zA-Z0-9._]/g, '')
        .toLowerCase();
      return { identity: { ...id, handle } };
    })
    .addEdge(START, 'draft')
    .addEdge('draft', 'review')
    .addEdge('review', END)
    .compile();
}

export async function runPersonaAgent(
  input: {
    description: string;
    instructions?: string;
    existing?: PersonaIdentity;
    playbook?: ArchetypePlaybook;
  },
  progress: ProgressFn = noProgress,
) {
  const out = await buildPersonaGraph(progress).invoke(input);
  return { identity: PersonaIdentity.parse(out.identity), meta: out.meta! };
}
