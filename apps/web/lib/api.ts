'use client';
/**
 * Typed API client. Request/response types come from @pseudo/shared — never redefine them here.
 */
import type {
  ApproveContentRequest,
  ConnectSocialAccountRequest,
  ConnectSocialAccountResponse,
  CreatePersonaRequest,
  CreatePersonaResponse,
  DashboardResponse,
  GenerateContentRequest,
  GenerateContentResponse,
  GenerateImageRequest,
  GeneratePersonaRequest,
  GenerateVideoRequest,
  GetContentResponse,
  GetPersonaResponse,
  GetRunResponse,
  ListContentQuery,
  ListContentResponse,
  ListMediaQuery,
  ListMediaResponse,
  ListPersonasResponse,
  ListPublishingResponse,
  ListRunsResponse,
  ListSocialAccountsResponse,
  PublishNowRequest,
  PublishResponse,
  RegenerateContentRequest,
  RunAccepted,
  ScheduleRequest,
  SessionResponse,
  UpdateContentRequest,
  UpdateMediaRequest,
  UpdatePersonaRequest,
  UpdatePersonaResponse,
  UploadReferenceResponse,
} from '@pseudo/shared';
import type { z } from 'zod';
import { supabase } from './supabase';

type In<T extends z.ZodType> = z.input<T>;
type Out<T extends z.ZodType> = z.output<T>;

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await accessToken();
  const isForm = body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !isForm ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? res.statusText, json.details);
  return json as T;
}

const qs = (q?: Record<string, unknown>) => {
  const p = new URLSearchParams();
  Object.entries(q ?? {}).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  session: () => request<Out<typeof SessionResponse>>('GET', '/api/auth/session'),

  personas: {
    list: () => request<Out<typeof ListPersonasResponse>>('GET', '/api/personas'),
    get: (id: string) => request<Out<typeof GetPersonaResponse>>('GET', `/api/personas/${id}`),
    create: (b: In<typeof CreatePersonaRequest>) =>
      request<Out<typeof CreatePersonaResponse>>('POST', '/api/personas', b),
    update: (id: string, b: In<typeof UpdatePersonaRequest>) =>
      request<Out<typeof UpdatePersonaResponse>>('PATCH', `/api/personas/${id}`, b),
    generate: (id: string, b: In<typeof GeneratePersonaRequest> = {}) =>
      request<RunAccepted>('POST', `/api/personas/${id}/generate`, b),
    uploadReference: (id: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return request<Out<typeof UploadReferenceResponse>>(
        'POST',
        `/api/personas/${id}/reference-photos`,
        fd,
      );
    },
  },

  content: {
    list: (q?: Partial<In<typeof ListContentQuery>>) =>
      request<Out<typeof ListContentResponse>>('GET', `/api/content${qs(q)}`),
    get: (id: string) => request<Out<typeof GetContentResponse>>('GET', `/api/content/${id}`),
    generate: (b: In<typeof GenerateContentRequest>) =>
      request<Out<typeof GenerateContentResponse>>('POST', '/api/content/generate', b),
    update: (id: string, b: In<typeof UpdateContentRequest>) =>
      request<Out<typeof GetContentResponse>>('PATCH', `/api/content/${id}`, b),
    approve: (id: string, b: In<typeof ApproveContentRequest> = { approved: true }) =>
      request<Out<typeof GetContentResponse>>('POST', `/api/content/${id}/approve`, b),
    regenerate: (id: string, b: In<typeof RegenerateContentRequest> = {}) =>
      request<RunAccepted>('POST', `/api/content/${id}/regenerate`, b),
  },

  media: {
    list: (q?: Partial<In<typeof ListMediaQuery>>) =>
      request<Out<typeof ListMediaResponse>>('GET', `/api/media${qs(q)}`),
    update: (id: string, b: In<typeof UpdateMediaRequest>) =>
      request('PATCH', `/api/media/${id}`, b),
    setAvatar: (id: string) => request('POST', `/api/media/${id}/set-avatar`),
    generateImage: (b: In<typeof GenerateImageRequest>) =>
      request<RunAccepted>('POST', '/api/media/images/generate', b),
    generateVideo: (b: In<typeof GenerateVideoRequest>) =>
      request<RunAccepted>('POST', '/api/media/videos/generate', b),
  },

  socialAccounts: {
    list: () => request<Out<typeof ListSocialAccountsResponse>>('GET', '/api/social-accounts'),
    connect: (platform: string, b: In<typeof ConnectSocialAccountRequest> = {}) =>
      request<Out<typeof ConnectSocialAccountResponse>>(
        'POST',
        `/api/social-accounts/${platform}/connect`,
        b,
      ),
    remove: (id: string) => request('DELETE', `/api/social-accounts/${id}`),
  },

  publishing: {
    list: () => request<Out<typeof ListPublishingResponse>>('GET', '/api/publishing'),
    publishNow: (contentId: string, b: In<typeof PublishNowRequest> = {}) =>
      request<Out<typeof PublishResponse>>('POST', `/api/publishing/${contentId}/publish`, b),
    schedule: (contentId: string, b: In<typeof ScheduleRequest>) =>
      request<Out<typeof PublishResponse>>('POST', `/api/publishing/${contentId}/schedule`, b),
  },

  analytics: () => request<DashboardResponse>('GET', '/api/analytics'),
  runs: {
    list: (personaId?: string) =>
      request<Out<typeof ListRunsResponse>>('GET', `/api/agents/runs${qs({ personaId })}`),
    get: (id: string) => request<Out<typeof GetRunResponse>>('GET', `/api/agents/runs/${id}`),
  },
};
