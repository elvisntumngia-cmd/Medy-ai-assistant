# Medy public widget: WordPress integration

## Purpose and architecture

The public Medy widget is a standalone custom element. It is bundled with its runtime dependencies, uses Shadow DOM to isolate its UI from WordPress theme CSS, and always sends `mode: "public"` to the public chat API. It does not expose employee navigation, identity, dashboard data, or employee actions.

For this proof, `securemedy.ng` remains the WordPress host page and loads the standalone widget from `https://medy-ai-assistant-demo.onrender.com/medy-widget.js`. The widget sends HTTPS requests to `https://medy-ai-assistant-demo.onrender.com/api`; it does not embed the Render demo or install backend code in WordPress.

## Production embed snippet

Add this exact markup to a WordPress Custom HTML block near the end of the page, or inject it site-wide immediately before `</body>` in the theme/footer integration:

```html
<script
  src="https://medy-ai-assistant-demo.onrender.com/medy-widget.js?v=1"
  defer
></script>
<medy-assistant
  api-url="https://medy-ai-assistant-demo.onrender.com/api"
></medy-assistant>
```

Use the snippet only once per page. The query-string version is a cache-busting identifier; increment it when deploying a materially changed widget. Render's free/demo service may sleep, so the first chat request can take up to a minute while the service wakes. The widget displays a connection message during that wait and a retry-safe error if the request fails.

## WordPress placement

1. Back up the site or create a staging copy.
2. Open the target page in the block editor and add a **Custom HTML** block at the bottom, or use an approved header/footer insertion plugin for site-wide placement.
3. Paste the production snippet exactly once and publish.
4. Purge WordPress, CDN, and browser caches.
5. Verify desktop and mobile behavior, then send several public-only questions.

WordPress.com plans and some security plugins may strip script tags. In that case an administrator must place the script through the site's approved header/footer mechanism rather than a content block.

## CORS and Content Security Policy

The API explicitly permits browser API calls from:

- `https://securemedy.ng`
- `https://www.securemedy.ng`
- `https://medy-ai-assistant-demo.onrender.com`
- the repository's approved localhost origins

Additional comma-separated origins can be appended with `CLIENT_ORIGIN`; the configuration is not a wildcard. If WordPress sends a stricter Content Security Policy, add `https://medy-ai-assistant-demo.onrender.com` to at least `script-src` and `connect-src`. A representative policy addition is:

```text
script-src 'self' https://medy-ai-assistant-demo.onrender.com;
connect-src 'self' https://medy-ai-assistant-demo.onrender.com;
```

Merge these sources into the site's existing directives; do not replace its entire policy. The script does not require `unsafe-inline` or `unsafe-eval`. The widget currently inserts its isolated styles into its Shadow DOM, so a future restrictive `style-src` policy should be tested separately; SecureMedy's current public response does not send a CSP header.

## Verification checklist

- `https://medy-ai-assistant-demo.onrender.com/medy-widget.js?v=1` returns JavaScript with HTTP 200.
- The launcher appears at the lower-right and stays above ordinary theme content.
- Open, close, send, suggestions, service-request form, validation, and error states work.
- Network requests go only to `/api/chat` and `/api/leads` on the configured API host.
- Public questions return public responses; no employee sign-in, dashboard, HR, payroll, or internal actions are exposed.
- Desktop and mobile layouts do not move or restyle the WordPress page.
- Browser console shows no CSP, CORS, mixed-content, or duplicate-registration errors.

## Rollback

Remove the `<script>` and `<medy-assistant>` lines from the Custom HTML block or header/footer injection, publish the change, and purge WordPress/CDN caches. No database migration, WordPress plugin uninstall, or API rollback is required.

## Current limitations

- The Render-hosted deterministic demo backend is not the final AWS/Bedrock production service.
- Leads are demonstration records, not production CRM submissions.
- Free/demo hosting can introduce cold-start latency.
- Production telemetry, consent/legal approval, accessibility certification, and a formal SecureMedy penetration test remain future hardening work.
- Employee mode is deliberately excluded from this public artifact.
- After the proof is approved, the runtime is expected to move to SecureMedy-controlled infrastructure.
