'use client';
import type { ContentBody, ContentItem } from '@pseudo/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ErrorText } from '@/components/error-text';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const tagsToText = (tags: string[]) => tags.join(' ');
const textToTags = (s: string) => s.split(/[\s,]+/).filter(Boolean);

/** Inline editor for a content body. Saving approved content sends it back for approval (API rule). */
export function ContentEditor({ item, onDone }: { item: ContentItem; onDone: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState<ContentBody>(item.body!);
  const save = useMutation({
    mutationFn: () => api.content.update(item.id, { body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['content'] });
      onDone();
    },
  });

  return (
    <div className="space-y-3">
      {body.type === 'instagram_post' && (
        <>
          <Field label="Caption">
            <Textarea
              rows={5}
              value={body.caption}
              onChange={(e) => setBody({ ...body, caption: e.target.value })}
            />
          </Field>
          <Field label="Hashtags">
            <Input
              defaultValue={tagsToText(body.hashtags)}
              onChange={(e) => setBody({ ...body, hashtags: textToTags(e.target.value) })}
            />
          </Field>
        </>
      )}
      {body.type === 'x_post' && (
        <Field label="Post">
          <TweetInput value={body.text} onChange={(text) => setBody({ ...body, text })} />
        </Field>
      )}
      {body.type === 'x_thread' && (
        <Field label="Thread">
          <div className="space-y-2">
            {body.posts.map((p, i) => (
              <div key={i} className="flex gap-2">
                <TweetInput
                  value={p}
                  onChange={(text) =>
                    setBody({ ...body, posts: body.posts.map((x, j) => (j === i ? text : x)) })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={body.posts.length <= 2}
                  onClick={() => setBody({ ...body, posts: body.posts.filter((_, j) => j !== i) })}
                  aria-label="Remove post"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBody({ ...body, posts: [...body.posts, ''] })}
            >
              <Plus className="h-4 w-4" /> Add post
            </Button>
          </div>
        </Field>
      )}
      {body.type === 'short_video' && (
        <>
          <Field label="Hook">
            <Input value={body.hook} onChange={(e) => setBody({ ...body, hook: e.target.value })} />
          </Field>
          {body.scenes.map((s, i) => (
            <Field key={i} label={`Scene ${i + 1}`}>
              <div className="space-y-2">
                <Input
                  placeholder="On-screen text"
                  value={s.onScreenText}
                  onChange={(e) =>
                    setBody({
                      ...body,
                      scenes: body.scenes.map((x, j) =>
                        j === i ? { ...x, onScreenText: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Textarea
                  rows={2}
                  placeholder="Voiceover"
                  value={s.voiceover}
                  onChange={(e) =>
                    setBody({
                      ...body,
                      scenes: body.scenes.map((x, j) =>
                        j === i ? { ...x, voiceover: e.target.value } : x,
                      ),
                    })
                  }
                />
              </div>
            </Field>
          ))}
          <Field label="Caption">
            <Textarea
              rows={3}
              value={body.caption}
              onChange={(e) => setBody({ ...body, caption: e.target.value })}
            />
          </Field>
          <Field label="Hashtags">
            <Input
              defaultValue={tagsToText(body.hashtags)}
              onChange={(e) => setBody({ ...body, hashtags: textToTags(e.target.value) })}
            />
          </Field>
        </>
      )}
      {item.status === 'approved' && (
        <p className="text-xs text-warning">Saving sends this back for approval.</p>
      )}
      <ErrorText error={save.error} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function TweetInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex-1">
      <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      <div className={cn('text-right text-xs', value.length > 280 ? 'text-danger' : 'text-muted')}>
        {value.length}/280
      </div>
    </div>
  );
}
