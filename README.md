# scm-crm

Construction management platform — multi-tenant SaaS for the full project
lifecycle from lead capture to post-delivery warranty.

[![CI](https://github.com/atremura/scm-crm/actions/workflows/ci.yml/badge.svg)](https://github.com/atremura/scm-crm/actions/workflows/ci.yml)

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript strict mode
- **UI**: Tailwind CSS 4 + shadcn/ui + radix-ui
- **Auth**: NextAuth v5 beta + Prisma adapter
- **Database**: PostgreSQL (Neon) + Prisma 6
- **AI**: Anthropic Claude (Opus 4.7)
- **Storage**: Vercel Blob
- **Deploy**: Vercel
- **Testing**: Vitest with happy-dom

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — Project context and conventions for AI agents
- [`docs/architecture-EN.md`](./docs/architecture-EN.md) — Full modular architecture (English)
- [`docs/architecture-PT.md`](./docs/architecture-PT.md) — Full modular architecture (Portuguese)
- [`docs/cowork-import-schema.md`](./docs/cowork-import-schema.md) — Cowork import file specification
- [`docs/audit-2026-05.md`](./docs/audit-2026-05.md) — Codebase audit report (May 2026)

## Development

```bash
npm install
npm run dev           # Start dev server
npm run test          # Run tests
npm run test:watch    # Tests in watch mode
npm run test:coverage # Coverage report
npm run lint          # ESLint
npm run build         # Production build
```

## Status

Currently in production for one tenant (JMO Carpentry). The architecture is
multi-tenant from day one. See `CLAUDE.md` for module status.
