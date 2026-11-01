import type { ContentItem } from '@pseudo/shared';

/** Platform requirements shared by mock + live so mock mode catches the same problems. */
export function validateForPlatform(c: ContentItem): string[] {
  const errs: string[] = [];
  if (!c.body) return ['Content has no body'];
  if (!['approved', 'scheduled', 'publishing', 'failed'].includes(c.status))
    errs.push('Content must be approved before publishing');
  const b = c.body;
  switch (c.platform) {
    case 'instagram':
      if (b.type !== 'instagram_post') errs.push('Instagram needs an instagram_post');
      else {
        if (!c.media.some((m) => m.kind === 'image')) errs.push('Instagram posts need an image');
        if (b.caption.length > 2200) errs.push('Caption over 2200 characters');
        if (b.hashtags.length > 30) errs.push('More than 30 hashtags');
      }
      break;
    case 'x':
      if (b.type === 'x_post' && b.text.length > 280) errs.push('Post over 280 characters');
      if (b.type === 'x_thread' && b.posts.some((p) => p.length > 280))
        errs.push('A thread post is over 280 characters');
      if (b.type !== 'x_post' && b.type !== 'x_thread') errs.push('X needs an x_post or x_thread');
      break;
    case 'tiktok':
    case 'youtube_shorts':
      if (b.type !== 'short_video') errs.push('Short-form platforms need a short_video');
      break;
  }
  return errs;
}
