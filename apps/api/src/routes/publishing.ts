import {
  CONTENT_SELECT,
  getAdminClient,
  toContentItem,
  toPublishingJob,
  toPublishingRecord,
  toSocialAccount,
} from '@pseudo/database';
import { getPublisher } from '@pseudo/publishers';
import {
  ConnectSocialAccountRequest,
  Id,
  Platform,
  PublishNowRequest,
  ScheduleRequest,
} from '@pseudo/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env } from '../env';
import { publish } from '../lib/bus';
import { db, HttpError, must, parse } from '../lib/http';

export default async function publishingRoutes(app: FastifyInstance) {
  // ---------- social accounts ----------
  app.get('/api/social-accounts', async (req) => {
    const rows = db(await req.db.from('social_accounts').select('*').order('created_at'));
    return { accounts: rows.map(toSocialAccount) };
  });

  /** Mock mode: instantly "connects" a demo account. Live mode: returns the OAuth authorize URL (Phase 10). */
  app.post('/api/social-accounts/:platform/connect', async (req, reply) => {
    const { platform } = parse(z.object({ platform: Platform }), req.params);
    const body = parse(ConnectSocialAccountRequest, req.body ?? {});
    if (body.mode === 'live')
      throw new HttpError(501, `Live OAuth for ${platform} is not configured yet`);
    const row = db(
      await req.db
        .from('social_accounts')
        .upsert(
          {
            user_id: req.user.id,
            platform,
            handle: body.handle ?? 'demo',
            display_name: `${body.handle ?? 'demo'} (mock)`,
            mode: 'mock',
            status: 'connected',
          },
          { onConflict: 'user_id,platform,handle' },
        )
        .select('*')
        .single(),
    );
    reply.code(201);
    return { account: toSocialAccount(row), authorizeUrl: null };
  });

  app.delete('/api/social-accounts/:id', async (req, reply) => {
    const { id } = parse(Id, req.params);
    db(await req.db.from('social_accounts').delete().eq('id', id));
    reply.code(204);
  });

  // ---------- publishing ----------
  app.get('/api/publishing', async (req) => {
    const jobs = db(
      await req.db
        .from('publishing_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
    );
    const records = db(
      await req.db
        .from('publishing_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
    );
    return { jobs: jobs.map(toPublishingJob), records: records.map(toPublishingRecord) };
  });

  app.post('/api/publishing/:contentId/publish', async (req, reply) => {
    const body = parse(PublishNowRequest, req.body ?? {});
    const job = await createJob(req, new Date(), body.socialAccountId);
    reply.code(202);
    return { job };
  });

  app.post('/api/publishing/:contentId/schedule', async (req, reply) => {
    const body = parse(ScheduleRequest, req.body);
    const runAt = new Date(body.runAt);
    if (runAt.getTime() < Date.now() - 60_000) throw new HttpError(400, 'runAt is in the past');
    const job = await createJob(req, runAt, body.socialAccountId);
    reply.code(202);
    return { job };
  });

  app.post('/api/publishing/jobs/:id/cancel', async (req) => {
    const { id } = parse(Id, req.params);
    const job = must(
      db(
        await req.db
          .from('publishing_jobs')
          .select('*')
          .eq('id', id)
          .eq('status', 'queued')
          .maybeSingle(),
      ),
      'Queued job',
    );
    db(await req.db.from('publishing_jobs').update({ status: 'cancelled' }).eq('id', id));
    db(
      await req.db
        .from('content_items')
        .update({ status: 'approved', scheduled_at: null })
        .eq('id', job.content_id),
    );
    return { ok: true };
  });
}

/** Distribution Agent rules: approved only, validated against platform requirements, one active job per item. */
async function createJob(req: FastifyRequest, runAt: Date, socialAccountId?: string) {
  const { contentId } = parse(z.object({ contentId: z.uuid() }), req.params);
  const row = must(
    db(await req.db.from('content_items').select(CONTENT_SELECT).eq('id', contentId).maybeSingle()),
    'Content',
  );
  if (!row.approved_at || !['approved', 'failed'].includes(row.status))
    throw new HttpError(409, 'Content must be approved before it can be published');
  const content = toContentItem(row);

  let account: Record<string, any> | null = null;
  if (socialAccountId) {
    account = must(
      db(await req.db.from('social_accounts').select('*').eq('id', socialAccountId).maybeSingle()),
      'Social account',
    );
    if (account!.platform !== content.platform)
      throw new HttpError(400, 'Account platform does not match content');
  } else {
    account = db(
      await req.db
        .from('social_accounts')
        .select('*')
        .eq('platform', content.platform)
        .limit(1)
        .maybeSingle(),
    );
  }
  const mode = (account?.mode as 'mock' | 'live' | undefined) ?? env.publishMode;
  const problems = getPublisher(content.platform, mode).validate({
    ...content,
    status: 'approved',
  });
  if (problems.length)
    throw new HttpError(422, 'Content does not meet platform requirements', problems);

  const scheduled = runAt.getTime() > Date.now() + 5_000;
  const { data: job, error } = await getAdminClient()
    .from('publishing_jobs')
    .insert({
      user_id: req.user.id,
      content_id: contentId,
      social_account_id: account?.id ?? null,
      platform: content.platform,
      mode,
      run_at: runAt.toISOString(),
    })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505')
      throw new HttpError(409, 'This content already has an active publishing job');
    throw new HttpError(500, error.message);
  }
  db(
    await req.db
      .from('content_items')
      .update({
        status: scheduled ? 'scheduled' : 'publishing',
        scheduled_at: scheduled ? runAt.toISOString() : null,
      })
      .eq('id', contentId),
  );
  publish(req.user.id, {
    type: 'publish.updated',
    contentId,
    jobId: job.id,
    status: scheduled ? 'scheduled' : 'queued',
  });
  return toPublishingJob(job);
}
