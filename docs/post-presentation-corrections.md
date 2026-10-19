# Post-presentation public assistant corrections

The standalone WordPress widget and React demo now wrap multiline messages, distinguish speakers, offer Shift+Enter composition, and use the Securemedy conversational brand and first-person company voice. The welcome is short; privacy and emergency information remains accessible in a compact disclosure. Existing server safety and consent requirements remain in place.

Public conversations are restored from same-origin, same-tab sessionStorage, scoped to the API URL. Up to 40 turns are saved; the context window remains bounded. Saved sessions expire after 12 hours of inactivity. New conversation removes saved history and cancels pending requests/animations. Storage failures are nonfatal. Form fields and response data are excluded; common contact details and secrets in chat are redacted. This is a convenience feature, not a secure place for sensitive information.

Responses use fast progressive reveal with a three-dot waiting indicator and reduced-motion support. Supported official HTTPS links become inert navigation buttons, never business actions. Existing consent-based lead forms remain separate.

## Recruitment source limitation

The official Careers page and seven linked role-detail pages were refreshed on 2026-10-19. They provide published role titles and details, but no reliable machine-readable live vacancy status or expiry feed. Medy identifies this uncertainty and directs visitors to the individual official role/application-details pages and Careers page. It does not promise that a published role is still accepting applications. Job records expire after 24 hours and then fall back to Careers guidance; they need a verified source refresh through the existing knowledge workflow:

```sh
npm run knowledge -w @medy/api -- refresh
```

No external scraping service, database, dependency, model change, environment change, spending-limit change, or paid API test was introduced.

## Validation

- Unit/integration: 228 tests passed across 13 files, including existing provider, financial-cap, rate-limit and lead-safety tests.
- Playwright: 21 tests passed, including desktop/mobile wrapping, refresh/navigation continuity, reset races and reduced motion.
- Lint, typecheck and production build passed.
- Local desktop/mobile screenshots were reviewed; generated test artifacts are not published.

Production verification uses health and static artifact requests only, without a paid OpenAI conversation. The existing WordPress snippet continues to load the Render-hosted widget/API.
