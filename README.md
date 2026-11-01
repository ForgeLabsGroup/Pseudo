# PSEUDO

**Your alter ego.**

Create a fictional persona, upload your selfies, and let PSEUDO generate content of *you* living as them: Instagram posts, X threads, TikTok/Shorts scripts and videos. Review, approve and publish (mock or live) from one command center.

- Start here: [`CLAUDE.md`](CLAUDE.md) (rules + ownership) and [`docs/DEVELOPMENT_SETUP.md`](docs/DEVELOPMENT_SETUP.md)
- Team plan: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)

```bash
pnpm install
cp .env.example .env && cp apps/web/.env.example apps/web/.env.local   # fill Supabase keys
pnpm --filter @pseudo/api seed
pnpm dev
```

Everything works in **mock mode** with no AI or social API keys.


<img width="588" height="326" alt="image" src="https://github.com/user-attachments/assets/e50cc2f5-0734-4b55-8b44-1edd1a739722" />
