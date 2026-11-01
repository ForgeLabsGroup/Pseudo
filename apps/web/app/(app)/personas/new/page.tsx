'use client';
import { PageHeader } from '@/components/page-header';

/**
 * New Persona — Owner: Person B
 * Description textarea -> api.personas.create({ description }) -> selfie upload (api.personas.uploadReference) -> redirect to /personas/[id] and show live generation progress.
 * See docs/IMPLEMENTATION_PLAN.md for acceptance criteria.
 */
export default function Page() {
  return <PageHeader title="New Persona" subtitle="Coming online…" />;
}
