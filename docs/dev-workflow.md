# Reliable Windows development startup

Run from the repository root with Node.js supporting --use-system-ca (the verified machine runs Node 24):

~~~powershell
npm run dev:openai
~~~

This starts hidden background servers on API **4180** and Vite **5180**, loads the root .env.local through the existing API development entry point, and uses a process-only AI_PROVIDER=openai / MEDY_LOCAL_AI=true override. It never edits the environment file or displays the key. Vite is explicitly pointed at http://127.0.0.1:4180/api. Open http://127.0.0.1:5180.

Other commands:

~~~powershell
npm run dev
npm run dev:openai -- -Restart
npm run dev:stop
npm run test:dev
~~~

npm run dev uses the existing environment/file configuration when starting a new API. Existing healthy owned servers are reused and their actual provider is reported. Use -Restart after environment-file edits. The OpenAI command automatically restarts a verified owned API if it has a different public provider or lacks inherited system-CA configuration. -Restart deliberately restarts both owned servers.

The startup script:
- Inspects Windows listeners and complete process command lines; recognizes only Node processes whose command points inside this exact repository and identifies the Medy development API or Vite entry point.
- Checks both ports before stopping anything. Unknown or unrelated ownership causes an error; resolve that conflict explicitly instead of killing that process.
- Reuses healthy listeners; stops verified stale API watchers, with watchers stopped before their workers can respawn.
- Checks process creation time again before termination to protect against PID reuse.
- Uses a per-repository mutex to prevent simultaneous invocations from starting duplicate servers.
- Uses --strictPort for Vite and fixes the API PORT to 4180. It never searches for another port.
- Waits for both endpoints, checks local Vite API configuration, and rolls back only processes started by the failing invocation.
- Writes local, ignored logs to .medy-dev/*.log. It does not print log contents on failure.

Do not mix repeated manual workspace dev invocations with the launcher. The individual npm run dev -w @medy/api / @medy/demo commands remain available, but bypass orchestration.

## Diagnosis and verification from this session

Initially:
- Port 4180: API worker PID **4532**, parent tsx watcher **16972**, both confirmed by repository-specific loader/entry-point command lines.
- Port 5180: Vite PID **7016**, command line under this repository with --port 5180 --strictPort.
- Extra Medy tsx API watchers **10828** and **13748** had no listening worker. They were stopped as stale.
- Existing servers were already healthy. Starting more copies caused EADDRINUSE / strict-port conflicts. The previous root concurrently command also contained literal escaped quote characters; it has been replaced by the PowerShell launcher.

The existing API and frontend were restarted under the launcher. Temporary verification instances were cleaned up. No unrelated application was terminated.

Final verified listeners: API **12324** (tsx watcher **19628**), Vite **7340**, both bound to 127.0.0.1. The API worker PID can change normally on source edits. Re-running npm run dev:openai reused the same listeners without duplicates.

Both local endpoints return HTTP 200. The served Vite configuration points to http://127.0.0.1:4180/api.

The root .env.local exists, MEDY_LOCAL_AI=true and a nonempty credential are recognized. Its provider selector is deterministic; it was left untouched. The dev:openai launcher overrides the selector only for its child API process. Final /api/health reports provider=openai, publicProvider=openai and systemCA=true. These additional local diagnostics are omitted in production/Render.

Exactly **two** ordinary conversational requests were attempted through /api/chat, without any client-side provider selector. Both entered OpenAIProvider and returned sanitized 503 AI_UNAVAILABLE failures, with ai_failure events rather than deterministic answers. Neither completed. Transport diagnostics identified Node certificate-trust problems:
1. Default Node TLS failed with UNABLE_TO_VERIFY_LEAF_SIGNATURE.
2. The next completion attempt also returned 503. Inspection showed the CA flag added to the tsx watcher had not propagated to its worker, so the worker had not received the TLS fix. This is consistent with the same trust failure; no upstream HTTP status was returned.

The final launcher passes --use-system-ca through NODE_OPTIONS, which the actual worker inherits. Health confirms the worker configuration, and an independent TLS-only handshake with the same inherited setting succeeds. Certificate verification remains enabled. No additional completion request was sent after the two-attempt cap. Consequently **a successful completion, credential acceptance and billing availability remain unverified**. Neither attempt returned token usage.

The standalone optional smoke command does not inherit environment variables from an already-running launcher process. If using that command in a separate terminal on this machine, configure system CA trust for that terminal's Node process too; the running API already receives it from the launcher.

Validation:
- npm test: **96 passed**, including new provider-health and sanitized diagnostic tests.
- npm run test:dev: process-ownership, unrelated-service, unknown-PID and PID-reuse checks passed with all process actions mocked.
- npm run typecheck, npm run lint, and API build: passed.
- Actual startup, restart, failed-start rollback and duplicate-start reuse were exercised.
- No secret files were modified, and no commits, pushes, deployments or production environment changes were made.

Files changed for this follow-up: package.json, scripts/dev.ps1, scripts/dev.test.ps1, .gitignore, apps/api/src/app.ts, apps/api/src/openai-provider.ts, apps/api/src/openai-provider.test.ts, README.md and the local-development documentation.
