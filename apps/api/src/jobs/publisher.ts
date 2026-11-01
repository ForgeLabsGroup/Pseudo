import { CONTENT_SELECT, getAdminClient, toContentItem } from '@pseudo/database';
import { traced } from '@pseudo/ai';
import { getPublisher } from '@pseudo/publishers';
import { publish } from '../lib/bus';
import { traceStore } from '../lib/trace';

/**
 * Workflow E: the publishing worker. Polls due jobs every few seconds (covers both
 * "publish now" and scheduled posts), with retries + exponential backoff.
 */
export function startPublishingWorker(intervalMs = 3000) {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await processDueJobs();
    } catch (err) {
      console.error('[publisher] tick failed', err);
    } finally {
      busy = false;
    }
  }, intervalMs);
  return () => clearInterval(timer);
}

async function processDueJobs() {
  const admin = getAdminClient();
  const { data: due } = await admin
    .from('publishing_jobs')
    .select('*')
    .eq('status', 'queued')
    .lte('run_at', new Date().toISOString())
    .limit(5);
  for (const job of due ?? []) {
    // Claim atomically: only one worker tick can move queued -> running.
    const { data: claimed } = await admin
      .from('publishing_jobs')
      .update({ status: 'running', attempts: job.attempts + 1 })
      .eq('id', job.id)
      .eq('status', 'queued')
      .select('id');
    if (!claimed?.length) continue;
    await runJob(job);
  }
}

async function runJob(job: Record<string, any>) {
  const admin = getAdminClient();
  const userId = job.user_id as string;
  const emit = (status: string) =>
    publish(userId, { type: 'publish.updated', contentId: job.content_id, jobId: job.id, status });

  await admin.from('content_items').update({ status: 'publishing' }).eq('id', job.content_id);
  emit('publishing');

  const { data: row } = await admin
    .from('content_items')
    .select(CONTENT_SELECT)
    .eq('id', job.content_id)
    .single();
  const { data: account } = job.social_account_id
    ? await admin.from('social_accounts').select('*').eq('id', job.social_account_id).single()
    : { data: null };
  const content = toContentItem(row!);
  const publisher = getPublisher(job.platform, job.mode);

  try {
    // Approval is re-checked here (and enforced by a DB trigger at job creation).
    const problems = publisher.validate({ ...content, status: 'approved' });
    if (!row?.approved_at) problems.push('Content is not approved');
    if (problems.length) throw Object.assign(new Error(problems.join('; ')), { permanent: true });

    const res = await traceStore.run({ userId, runId: null, agent: 'distribution' }, () =>
      traced('publisher', job.platform, () =>
        publisher.publish({
          content,
          account: { id: account?.id ?? null, handle: account?.handle ?? 'demo', mode: job.mode },
          // Live mode: decrypt token from social_account_tokens here (Phase 10).
        }),
      ),
    );
    await admin.from('publishing_records').insert({
      user_id: userId,
      job_id: job.id,
      content_id: job.content_id,
      platform: job.platform,
      mode: job.mode,
      success: true,
      external_id: res.externalId,
      external_url: res.externalUrl,
      response: res.raw ?? null,
    });
    await admin
      .from('publishing_jobs')
      .update({ status: 'succeeded', last_error: null })
      .eq('id', job.id);
    await admin
      .from('content_items')
      .update({ status: 'published', published_at: new Date().toISOString(), error: null })
      .eq('id', job.content_id);
    emit('published');
  } catch (err) {
    const message = (err as Error).message;
    const attempts = job.attempts + 1;
    const retry = !(err as { permanent?: boolean }).permanent && attempts < job.max_attempts;
    await admin.from('publishing_records').insert({
      user_id: userId,
      job_id: job.id,
      content_id: job.content_id,
      platform: job.platform,
      mode: job.mode,
      success: false,
      error: message,
    });
    await admin
      .from('publishing_jobs')
      .update({
        status: retry ? 'queued' : 'failed',
        last_error: message,
        run_at: new Date(Date.now() + 2 ** attempts * 2000).toISOString(),
      })
      .eq('id', job.id);
    await admin
      .from('content_items')
      .update({ status: retry ? 'publishing' : 'failed', error: message })
      .eq('id', job.content_id);
    emit(retry ? 'retrying' : 'failed');
  }
}
