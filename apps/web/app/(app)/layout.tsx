import { AuthGate } from '@/components/auth-gate';
import { Sidebar } from '@/components/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="bg-glow flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-8 md:px-10 md:pb-8">{children}</main>
      </div>
    </AuthGate>
  );
}
