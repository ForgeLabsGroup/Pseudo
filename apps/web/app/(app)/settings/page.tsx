'use client';
import {
  PLATFORM_LABELS,
  PLATFORMS,
  type Platform,
  type UsageOperation,
  type UsageStatus,
} from '@pseudo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, ExternalLink, Link2, Send, Unlink } from 'lucide-react';
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
import { timeAgo } from '@/lib/utils';

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
          <HiggsfieldUsage />
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

const OPERATION_LABELS: Record<UsageOperation, string> = {
  character: 'Likeness training',
  image: 'Photos',
  video: 'Video clips',
};

const USAGE_STATUS_STYLE: Record<UsageStatus, string> = {
  pending: 'text-fg animate-pulse',
  succeeded: 'text-success border-success/40',
  failed: 'text-danger border-danger/40',
};

/** Every paid Higgsfield request PSEUDO made for this user, from the API's provider_usage ledger. */
function HiggsfieldUsage() {
  const usage = useQuery({ queryKey: ['usage', 'higgsfield'], queryFn: api.usage.higgsfield });
  const personas = useQuery({ queryKey: ['personas'], queryFn: api.personas.list });
  const personaName = (id: string | null) =>
    personas.data?.personas.find((p) => p.id === id)?.name ?? null;
  const u = usage.data;
  const live = Boolean(u && (u.routes.image || u.routes.video));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Higgsfield usage</CardTitle>
        {u && (
          <Badge
            className={live ? 'border-success/40 text-success' : 'border-warning/40 text-warning'}
          >
            {live ? 'Live' : 'Off'}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {usage.isLoading && <Skeleton className="h-24" />}
        <ErrorText error={usage.error} />
        {u && (
          <>
            <p className="text-muted">
              {live
                ? `Sends ${[u.routes.image && 'photos', u.routes.video && 'video clips'].filter(Boolean).join(' and ')} to Higgsfield. Likeness training always does.`
                : 'Photos and clips use another provider, so they cost no Higgsfield credits. Likeness training still uses Higgsfield.'}
              {!u.configured && ' No Higgsfield API key is set on the server.'}
            </p>

            <dl className="grid grid-cols-2 gap-2">
              <Stat label="Requests" value={u.totals.requests} />
              <Stat label="Succeeded" value={u.totals.succeeded} />
              <Stat label="Failed" value={u.totals.failed} />
              <Stat label="Video sec" value={u.totals.videoSeconds} />
            </dl>

            <ul className="space-y-1">
              {u.byOperation.map((o) => (
                <li key={o.operation} className="flex items-center justify-between gap-2">
                  <span className="text-muted">{OPERATION_LABELS[o.operation]}</span>
                  <span className="whitespace-nowrap font-mono text-xs">
                    {o.succeeded} ok · {o.failed} failed
                  </span>
                </li>
              ))}
            </ul>

            {u.recent.length > 0 && (
              <div>
                <div className="mono-label mb-1 text-subtle">Recent requests</div>
                <ul className="max-h-64 divide-y divide-border overflow-y-auto border border-border">
                  {u.recent.map((r) => (
                    <li key={r.id} className="space-y-1 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {OPERATION_LABELS[r.operation]}
                          {r.videoSeconds !== null && ` · ${r.videoSeconds}s`}
                        </span>
                        <Badge className={USAGE_STATUS_STYLE[r.status]}>{r.status}</Badge>
                      </div>
                      <div className="truncate font-mono text-xs text-subtle">
                        {timeAgo(r.startedAt)}
                        {personaName(r.personaId) && ` · ${personaName(r.personaId)}`}
                      </div>
                      {r.error && (
                        <div className="truncate text-xs text-danger" title={r.error}>
                          {r.error}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted">
              Higgsfield charges only for successful requests. Its API doesn&apos;t report credits,
              so your balance and exact spend are in{' '}
              <a
                href={u.dashboardUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-link hover:underline"
              >
                the Higgsfield dashboard <ExternalLink className="h-3 w-3" />
              </a>
              .
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border bg-surface px-2 py-1.5">
      <dt className="mono-label text-subtle">{label}</dt>
      <dd className="font-mono text-base">{value}</dd>
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
                    className="mt-2 flex items-center justify-between gap-3 border border-border bg-surface px-3 py-2 text-sm"
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
