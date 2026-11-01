'use client';
import { CoreHome } from '@/components/core/core-home';
import { ViewToggle } from '@/components/core/view-toggle';
import { ClassicHome } from '@/components/home/classic-home';
import { useUI } from '@/lib/store';

/** Home: the live agent graph (Core) or the classic Command Center, toggled and remembered. */
export default function Home() {
  const view = useUI((s) => s.homeView);
  if (view === 'core') return <CoreHome />;
  return (
    <div className="relative">
      <div className="mb-4 flex justify-end md:absolute md:right-0 md:top-0 md:mb-0">
        <ViewToggle />
      </div>
      <ClassicHome />
    </div>
  );
}
