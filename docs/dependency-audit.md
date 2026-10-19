# Dependency audit — 2026-10-16

The requested seven-package count was not reproduced. Both the baseline and final registry-backed audits report **18 affected packages: 4 critical, 13 high, 1 moderate**. The full findings are preserved in audit-before.json and audit-after.json. No npm audit fix or unrelated dependency upgrades were run. Adding the official OpenAI SDK did not change these findings. The npm install summary reported zero vulnerabilities, but independent explicit audit results take precedence.

**Production-only audit (npm audit --omit=dev): zero vulnerabilities.** All 18 reported entries belong to development tooling. They still matter for developer machines and CI; do not expose development/test servers publicly or run untrusted test/build inputs. Absence of reported production advisories is not a general security guarantee.

The root findings include brace-expansion denial of service; js-yaml merge/omap CPU denial of service; shell-quote command injection; tinypool prototype-pollution gadgets leading to code execution; and Vitest/mocker path traversal/arbitrary file reads. Other entries propagate these findings through ESLint, TypeScript ESLint and concurrently. Fixes should be evaluated in a separate development-tooling maintenance change; several entries have no fix available in the current audit response.

| Affected package | Severity | Advisory or dependency chain |
|---|---|---|
| @eslint-community/eslint-utils | high | eslint |
| @eslint/config-array | high | minimatch |
| @eslint/eslintrc | high | js-yaml; minimatch |
| @typescript-eslint/eslint-plugin | high | @typescript-eslint/parser; @typescript-eslint/type-utils; @typescript-eslint/utils; eslint |
| @typescript-eslint/parser | high | eslint |
| @typescript-eslint/type-utils | high | @typescript-eslint/utils; eslint |
| @typescript-eslint/utils | high | @eslint-community/eslint-utils; eslint |
| @vitest/mocker | moderate | Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock |
| brace-expansion | high | brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash; brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash; brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation; brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation; brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service; brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service; brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion; brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion; brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion; brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion |
| concurrently | critical | shell-quote |
| eslint | high | @eslint-community/eslint-utils; @eslint/config-array; @eslint/eslintrc; minimatch |
| eslint-plugin-react-hooks | high | eslint |
| js-yaml | high | JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported; js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources |
| minimatch | high | brace-expansion |
| shell-quote | critical | shell-quote: `quote()` command injection via a line terminator in a token after a `{ comment }` token |
| tinypool | critical | Tinypool: Prototype Pollution gadget in worker options leads to Remote Code Execution; Tinypool: Prototype Pollution Gadget to RCE in run() options |
| typescript-eslint | high | @typescript-eslint/eslint-plugin; @typescript-eslint/parser; @typescript-eslint/utils; eslint |
| vitest | critical | @vitest/mocker; Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock; tinypool |

The first audit attempt failed certificate verification. It succeeded using Node --use-system-ca, without disabling TLS checks:

~~~powershell
node --use-system-ca "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" audit --json
node --use-system-ca "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" audit --omit=dev --json
~~~

## 2026-10-19 remediation

The public-candidate work removed unused concurrently, upgraded the vulnerable test runner to Vitest 4.1.12, and applied compatible npm audit fix updates without --force. Independent final full and production audits now report zero advisories; see audit-final-2026-10-19.json and audit-production-2026-10-19.json. The earlier findings above are retained as baseline evidence. All tests, lint and type checks passed after the security updates.
