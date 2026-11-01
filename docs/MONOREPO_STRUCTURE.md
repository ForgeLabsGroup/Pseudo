# Monorepo structure

See the layout + ownership in `/CLAUDE.md`. Dependency direction (no cycles):

```
shared ← database ← apps/api
shared ← ai ← agents ← apps/api
shared ← publishers ← apps/api
shared ← media ← apps/web
shared ← apps/web   (web never imports database/ai/agents/publishers: those hold server secrets)
```
