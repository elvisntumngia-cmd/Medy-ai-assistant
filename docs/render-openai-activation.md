# Render OpenAI activation

Production remains deterministic by default. To explicitly activate the existing
OpenAI provider, enter these settings in the existing Render service's Environment
page, then save and deploy:

```text
AI_PROVIDER=openai
MEDY_PRODUCTION_AI=true
OPENAI_MODEL=gpt-4.1-mini
```

Configure `OPENAI_API_KEY` separately as a secret in Render. Never paste it into
chat, source code, Git, browser settings or screenshots. Remove `MEDY_LOCAL_AI`
from production, or set it to `false`. Do not copy the local `.env.local` file to
Render. Production reads its environment directly.

Keep the existing `AI_*` rate, history, input, output, timeout, daily request/token
budget and cost settings unchanged. The existing daily counters remain per process
and reset on restart/UTC midnight; they do not coordinate replicas or replace an
account-level spending limit. This activation does not increase any limits or
change the model, retries, logging, privacy, consent or lead workflow.

On `NODE_ENV=production` or `RENDER=true`, a request to enable OpenAI without the
production opt-in, without a key, with a conflicting provider setting, or with
`MEDY_LOCAL_AI=true` fails startup with a configuration error containing no secret
values. It does not silently select the deterministic provider. An absent opt-in
and non-OpenAI provider retain the deterministic default. Outside production,
`MEDY_LOCAL_AI=true` and the existing local credential-free fallback still work.

After deployment, GET
`https://medy-ai-assistant-demo.onrender.com/api/health` must report:

```json
{"status":"ok","publicProvider":"openai","provider":"openai"}
```

Health makes no OpenAI request and exposes no credentials. Provider selection does
not itself verify key validity, billing or a successful model response. Do not run
a paid chat/smoke test without authorization. The existing WordPress embed already
targets this service's `/api`; no snippet change is needed.

To roll back activation, set `MEDY_PRODUCTION_AI=false` and
`AI_PROVIDER=deterministic` together, then deploy. Setting only one leaves an
intentional configuration error rather than silently changing providers.

This document supersedes the earlier reports' local-only provider restriction.
