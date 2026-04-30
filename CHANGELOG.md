# Changelog

## [Unreleased]

### Security

- Helmet middleware for security headers
- Rate limiting on auth endpoints (5 req/min)
- Content-Security-Policy headers
- Environment variable validation on startup

### Added

- Docker HEALTHCHECK for all services
- Structured JSON logging via Pino
- Global exception filter with request ID tracing
- Compression middleware (gzip/brotli)
- Static asset caching headers
- Redis health check in health endpoint
- CI/CD pipeline (GitHub Actions)
- Database backup and recovery scripts
- Deploy and rollback convenience scripts

## [0.1.0] — 2026-04-30

### Added

- Phase 0: Documentation baseline, monorepo, Prisma, Docker Compose
- Phase 1: Player demo — search, playback, queue, favorites, playlists
- Phase 2: Mobile UI system — player screen, AI chat sheet, search sheet, atmosphere layer
- Phase 3: Auth (email verification code + JWT), persistence (PostgreSQL)
- Phase 4: AI DJ first loop — text chat, intent classification, SSE streaming, playlist generation
- Phase 5: Taste profile + recommendation — vector recall (pgvector), LLM-generated reasons, feedback nudge loop, Jamendo content catalog
- Phase 6: Voice + knowledge — MiMo TTS/Aliyun ASR, knowledge Q&A module, context snapshot enrichment
- Phase 7: Hardening — Voice ASR completion, Bing web search, request ID tracing, integration tests, CORS hardening
