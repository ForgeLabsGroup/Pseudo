/**
 * REST API contracts. Both apps/api (validation) and apps/web (typed client) import these.
 * Never redefine request/response shapes anywhere else.
 * All routes are under /api and require `Authorization: Bearer <supabase access token>`.
 */
import { z } from 'zod';
import { AgentEvent, AgentRun } from './agents';
import { ContentBody, ContentItem } from './content';
import { ContentStatus, ContentType, MediaCategory, Platform, PublishMode } from './enums';
import { MediaAsset } from './media';
import { Persona, PersonaIdentity, PersonaVersion } from './persona';
import { PublishingJob, PublishingRecord, SocialAccount } from './publishing';

export const Id = z.object({ id: z.uuid() });

/** Returned by every endpoint that kicks off background work. Progress arrives over SSE. */
export const RunAccepted = z.object({ runId: z.uuid() });
export type RunAccepted = z.infer<typeof RunAccepted>;

export const ApiError = z.object({ error: z.string(), details: z.unknown().optional() });
export type ApiError = z.infer<typeof ApiError>;

// ---------- Personas ----------
export const CreatePersonaRequest = z.object({
  description: z.string().min(10).max(2000),
  /** Optional overrides the user typed manually. */
  name: z.string().optional(),
  /** If true (default), the Persona Agent runs immediately. */
  generate: z.boolean().default(true),
});
export const CreatePersonaResponse = z.object({ persona: Persona, runId: z.uuid().nullable() });

export const ListPersonasResponse = z.object({ personas: z.array(Persona) });
export const GetPersonaResponse = z.object({ persona: Persona, versions: z.array(PersonaVersion) });

/** Editing creates a new persona_versions row; it never overwrites history. */
export const UpdatePersonaRequest = z.object({
  identity: PersonaIdentity.partial(),
  changeNote: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});
export const UpdatePersonaResponse = z.object({ persona: Persona });

/** Re-run the Persona Agent, optionally with extra direction. */
export const GeneratePersonaRequest = z.object({ instructions: z.string().optional() });

// ---------- Content ----------
export const ListContentQuery = z.object({
  personaId: z.uuid().optional(),
  platform: Platform.optional(),
  status: ContentStatus.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export const ListContentResponse = z.object({ items: z.array(ContentItem) });
export const GetContentResponse = z.object({ item: ContentItem });

/** Proof of Life Studio: generate N pieces for one persona/platform. */
export const GenerateContentRequest = z.object({
  personaId: z.uuid(),
  platform: Platform,
  contentType: ContentType,
  topic: z.string().max(500).optional(),
  tone: z.string().max(100).optional(),
  count: z.number().int().min(1).max(7).default(1),
  campaignId: z.uuid().optional(),
  /** Instagram only: also generate an image for each post. */
  withImage: z.boolean().default(true),
});
export const GenerateContentResponse = z.object({ runId: z.uuid(), contentIds: z.array(z.uuid()) });

export const UpdateContentRequest = z.object({
  title: z.string().optional(),
  body: ContentBody.optional(),
  platform: Platform.optional(),
  mediaAssetIds: z.array(z.uuid()).optional(),
});

export const ApproveContentRequest = z.object({ approved: z.boolean() });
export const RegenerateContentRequest = z.object({ instructions: z.string().optional() });

// ---------- Media ----------
export const ListMediaQuery = z.object({
  personaId: z.uuid().optional(),
  kind: z.enum(['image', 'video', 'audio']).optional(),
  category: MediaCategory.optional(),
});
export const ListMediaResponse = z.object({ assets: z.array(MediaAsset) });

export const GenerateImageRequest = z.object({
  personaId: z.uuid(),
  category: MediaCategory.default('lifestyle'),
  /** Scene description; the Visual Agent wraps it with persona context. */
  prompt: z.string().max(1000).optional(),
  count: z.number().int().min(1).max(4).default(1),
  /** Use the persona's reference selfies so the image features the user. */
  useReference: z.boolean().default(true),
  contentId: z.uuid().optional(),
});

export const GenerateVideoRequest = z.object({
  contentId: z.uuid(),
  withVoiceover: z.boolean().default(true),
  voiceId: z.string().optional(),
});

export const UpdateMediaRequest = z.object({
  isFavorite: z.boolean().optional(),
  category: MediaCategory.optional(),
});

// Reference selfie upload: POST /api/personas/:id/reference-photos (multipart, field "file").
export const UploadReferenceResponse = z.object({ asset: MediaAsset });

// ---------- Social accounts ----------
export const ListSocialAccountsResponse = z.object({ accounts: z.array(SocialAccount) });
export const ConnectSocialAccountRequest = z.object({
  mode: PublishMode.default('mock'),
  handle: z.string().optional(),
});
export const ConnectSocialAccountResponse = z.object({
  account: SocialAccount.nullable(),
  /** Live mode: redirect the browser here to complete OAuth. */
  authorizeUrl: z.string().nullable(),
});

// ---------- Publishing ----------
export const ListPublishingResponse = z.object({
  jobs: z.array(PublishingJob),
  records: z.array(PublishingRecord),
});
export const PublishNowRequest = z.object({ socialAccountId: z.uuid().optional() });
export const ScheduleRequest = z.object({
  runAt: z.iso.datetime(),
  socialAccountId: z.uuid().optional(),
});
export const PublishResponse = z.object({ job: PublishingJob });

// ---------- Analytics / dashboard ----------
export const DashboardResponse = z.object({
  counts: z.object({
    personas: z.number(),
    content: z.number(),
    awaitingApproval: z.number(),
    approved: z.number(),
    scheduled: z.number(),
    published: z.number(),
    failed: z.number(),
  }),
  byPlatform: z.array(z.object({ platform: Platform, total: z.number(), published: z.number() })),
  recentRuns: z.array(AgentRun),
  /** True when engagement numbers are simulated demo data. The UI MUST label them. */
  engagementIsSample: z.boolean(),
  engagement: z.array(
    z.object({ date: z.string(), platform: Platform, impressions: z.number(), likes: z.number() }),
  ),
});
export type DashboardResponse = z.infer<typeof DashboardResponse>;

// ---------- Agents ----------
export const ListRunsResponse = z.object({ runs: z.array(AgentRun) });
export const GetRunResponse = z.object({ run: AgentRun, events: z.array(AgentEvent) });

// ---------- Session ----------
export const SessionResponse = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.string().nullable(),
    displayName: z.string().nullable(),
  }),
  config: z.object({ aiMode: z.enum(['mock', 'live']), publishMode: PublishMode }),
});
