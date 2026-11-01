'use client';
import { PageHeader } from '@/components/page-header';

/**
 * Proof of Life Studio — Owner: Person B
 * Persona + platform + content type + topic + tone + count -> api.content.generate. Show placeholders updating live via SSE.
 * See docs/IMPLEMENTATION_PLAN.md for acceptance criteria.
 */
export default function Page() {
  return <PageHeader title="Proof of Life Studio" subtitle="Coming online…" />;
}
