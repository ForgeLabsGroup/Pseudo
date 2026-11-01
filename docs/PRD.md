# PRD (short)

**Problem:** LARPing as someone you're not online means inventing an identity, a look, a voice and a steady stream of content across 4 platforms.
**Product:** PSEUDO — create an alter ego, upload your selfies, and generate content of *you* living as that persona. Review, approve, publish (mock or live), track.

**Demo story (must work end-to-end in mock mode):**
1. Sign in → 2. Create persona from a description ("Miami crypto trader") → 3. Upload selfies → 4. Persona Agent generates bio, personality, writing style, pillars, visual identity, social bios → 5. Generate a lifestyle image of the user as Alex → 6. Proof of Life: Instagram post (+image), X post/thread, TikTok script → 7. Preview/edit → 8. Approve → 9. Publish (mock) → 10. Command Center shows activity + statuses.

**Must-have:** auth, AI persona, persona editing + versions, selfie-referenced images, platform text, Content Studio with edit/approve, mock publishing, dashboard with live activity.
**Should-have:** batch generation, video (script → scene images + ElevenLabs voice → Remotion preview), scheduling, mock social accounts.
**Later:** live OAuth publishing, real analytics, MP4 server render, voice cloning.

**Out of scope:** courses, payments, marketplaces, auto account creation, follower/engagement manipulation, autonomous publishing.
**Safeguards:** see `packages/shared/src/safety.ts` — AI labels, no fake returns/credentials/testimonials, no impersonating real people (only the user's own face), approval required, sample data labelled.
