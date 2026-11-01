import { AuthGate } from '@/components/auth-gate';
import { Sidebar } from '@/components/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="bg-glow flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1 px-6 py-8 md:px-10">{children}</main>
      </div>
    </AuthGate>
  );
}
