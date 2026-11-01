import { AuthGate } from '@/components/auth-gate';
import { Sidebar } from '@/components/sidebar';
import { TopBar } from '@/components/top-bar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1 px-4 pb-24 pt-8 md:px-8 md:pb-12 md:pt-9">
            <div className="max-w-[1240px]">{children}</div>
          </main>
        </div>
      </div>
    </AuthGate>
  );
}
