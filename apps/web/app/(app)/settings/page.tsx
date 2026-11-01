'use client';
import { PLATFORM_LABELS, PLATFORMS, type Platform } from '@pseudo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Link2, Send, Unlink } from 'lucide-react';
import { useState } from 'react';
import { ErrorText } from '@/components/error-text';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useUI } from '@/lib/store';

/** Settings: which modes the backend runs in, and the (mock) social accounts to publish to. */
export default function SettingsPage() {
  const session = useQuery({ queryKey: ['session'], queryFn: api.session });
  const config = session.data?.config;

  return (
    <>
      <PageHeader title="Settings" subtitle="Accounts and how PSEUDO is running." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {session.isLoading && <Skeleton className="h-20" />}
              <ErrorText error={session.error} />
              {config && (
                <>
                  <ModeRow
                    icon={<Bot className="h-4 w-4" />}
                    label="AI"
                    live={config.aiMode === 'live'}
                    mockText="Built-in sample generations. No API keys used."
                    liveText="Real models generate text, images and voice."
                  />
                  <ModeRow
                    icon={<Send className="h-4 w-4" />}
                    label="Publishing"
                    live={config.publishMode === 'live'}
                    mockText="Posts are simulated. Nothing leaves PSEUDO."
                    liveText="Approved posts go to the real platforms."
                  />
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {session.data ? (
                <div className="text-muted">
                  Signed in as <span className="text-fg">{session.data.user.email}</span>
                </div>
              ) : (
                <Skeleton className="h-5 w-48" />
              )}
            </CardContent>
          </Card>
        </div>
        <SocialAccounts />
      </div>
    </>
  );
}

function ModeRow({
  icon,
  label,
  live,
  mockText,
  liveText,
}: {
  icon: React.ReactNode;
  label: string;
  live: boolean;
  mockText: string;
  liveText: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          <Badge
            className={live ? 'border-success/40 text-success' : 'border-warning/40 text-warning'}
          >
            {live ? 'Live' : 'Mock'}
          </Badge>
        </div>
        <p className="mt-0.5 text-muted">{live ? liveText : mockText}</p>
      </div>
    </div>
  );
}

function SocialAccounts() {
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: ['social-accounts'], queryFn: api.socialAccounts.list });
  const personas = useQuery({ queryKey: ['personas'], queryFn: api.personas.list });
  const activePersonaId = useUI((s) => s.activePersonaId);
  const defaultHandle =
    personas.data?.personas.find((p) => p.id === activePersonaId)?.handle ??
    personas.data?.personas.find((p) => p.handle)?.handle ??
    '';

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['social-accounts'] });
  const connect = useMutation({
    mutationFn: ({ platform, handle }: { platform: Platform; handle: string }) =>
      api.socialAccounts.connect(platform, { mode: 'mock', handle: handle || undefined }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.socialAccounts.remove(id),
    onSuccess: invalidate,
  });

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Social accounts</CardTitle>
        <Badge className="border-warning/40 text-warning">Mock connections</Badge>
      </CardHeader>
      <CardContent>
        <ErrorText error={accounts.error ?? connect.error ?? remove.error} className="mb-3" />
        <ul className="divide-y divide-border">
          {PLATFORMS.map((platform) => {
            const linked = accounts.data?.accounts.filter((a) => a.platform === platform) ?? [];
            return (
              <li key={platform} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-medium">{PLATFORM_LABELS[platform]}</div>
                  {accounts.isLoading ? (
                    <Skeleton className="h-8 w-48" />
                  ) : (
                    linked.length === 0 && (
                      <ConnectForm
                        defaultHandle={defaultHandle}
                        busy={connect.isPending && connect.variables?.platform === platform}
                        onConnect={(handle) => connect.mutate({ platform, handle })}
                      />
                    )
                  )}
                </div>
                {linked.map((a) => (
                  <div
                    key={a.id}
                    className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span>@{a.handle}</span>
                      <Badge className={a.status === 'connected' ? 'text-success' : 'text-danger'}>
                        {a.status}
                      </Badge>
                      <Badge>{a.mode}</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(a.id)}
                    >
                      <Unlink className="h-4 w-4" /> Disconnect
                    </Button>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Without a connected account, publishing still works in mock mode under a demo handle.
        </p>
      </CardContent>
    </Card>
  );
}

function ConnectForm({
  defaultHandle,
  busy,
  onConnect,
}: {
  defaultHandle: string;
  busy: boolean;
  onConnect: (handle: string) => void;
}) {
  const [handle, setHandle] = useState<string | null>(null);
  const value = handle ?? defaultHandle;
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onConnect(value.replace(/^@/, '').trim());
      }}
    >
      <Input
        aria-label="Handle"
        className="h-8 w-40"
        placeholder="handle"
        value={value}
        onChange={(e) => setHandle(e.target.value)}
      />
      <Button size="sm" type="submit" disabled={busy}>
        <Link2 className="h-4 w-4" /> Connect
      </Button>
    </form>
  );
}
