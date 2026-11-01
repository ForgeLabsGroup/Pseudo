'use client';
import { PageHeader } from '@/components/page-header';

/**
 * Settings — Owner: Person C
 * Profile, connected social accounts (api.socialAccounts.connect(platform, {mode:'mock', handle})), AI/publish mode from api.session().
 * See docs/IMPLEMENTATION_PLAN.md for acceptance criteria.
 */
export default function Page() {
  return <PageHeader title="Settings" subtitle="Coming online…" />;
}
