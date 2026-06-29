# calm-suite — Deployment Reconciliation TODO

> **For the agent/owner wiring up calm-suite deployments.**
>
> Context: `calm-suite` (CALM Guard + CALM Studio) was contributed to FINOS and now
> lives in `finos/architecture-as-code`. A separate pass
> (`chore/reconcile-calm-suite-ownership`) corrected **ownership/repository
> pointers** (package metadata, repo links, license links, CI badges, Docusaurus
> `organizationName`/`projectName`) to `finos/architecture-as-code`.
>
> That pass deliberately **left deployment-specific values alone**, because new
> deployment plans are in flight and those values are yours to set. They are
> listed here so they don't get lost. Each still points at OpsFlow's old,
> now-defunct infrastructure.

## Items left untouched (need a deployment decision)

### 1. CALM Guard docs site — Docusaurus deploy URL
**File:** `calm-suite/calm-guard/docs/docusaurus.config.ts` (lines 17–18)

```ts
url: 'https://finos-labs.github.io',
baseUrl: '/dtcch-2026-opsflow-llc/',
```

`organizationName`/`projectName` in the same file were already repointed to
`finos`/`architecture-as-code`. These two URL fields define where the site
actually publishes and were left for the deployment decision (GitHub Pages under
`finos/architecture-as-code`, an S3/`calm.finos.org` sub-path, or elsewhere). Set
them consistently with the corrected org/project.

### 2. CALM Studio VS Code extension — Marketplace publisher
**File:** `calm-suite/calm-studio/packages/vscode-extension/package.json` (line 3)

```json
"publisher": "opsflow",
```

This is the VS Code Marketplace publisher identity — changing it requires an owned
Marketplace publisher account, so it's a publishing decision, not a metadata
rename. For reference, the other FINOS VS Code extension
(`calm-plugins/vscode`) ships under publisher `"FINOS"`.

### 3. CALM Studio web app — hardcoded fallback URL
**Files:**
- `calm-suite/calm-studio/packages/vscode-extension/src/openInStudio.ts` (line 22)
- `calm-suite/calm-studio/packages/vscode-extension/src/test/openInStudio.test.ts` (line 72)

`openInCalmStudio()` hardcodes `https://calmstudio.opsflow.io` as the web fallback
when the desktop app isn't installed (no env-var override today). That deployment
is OpsFlow's. Update the fallback URL — and the matching test assertion — to the
new canonical Studio deployment URL once it exists.

## NOT stale — do NOT change

These reference a real, separate FINOS-Labs project (AIGF reference patterns), not
the old hackathon repo:
- `calm-suite/calm-studio/packages/mcp-server/src/tools/guide.ts:130,259`
- `calm-suite/calm-studio/docs/REQ_fluxnova_aigf_integration.md:27`

→ all point at `finos-labs/ai-reference-architecture-library`, which is correct.

## Intentionally kept (historical attribution — do NOT "fix")

Legitimate provenance/credit, not an ownership claim:
- `calm-suite/calm-guard/README.md:61` — link to the hackathon presentation PDF
- `calm-suite/calm-guard/README.md:463` — "Built for DTCC/FINOS Innovate.DTCC AI Hackathon 2026"
- `calm-suite/calm-guard/docs/docs/intro.md:65` — "built by Team OpsFlow at the DTCC/FINOS Innovate AI Hackathon"
- `calm-suite/calm-studio/docs/CALM_1.2_CONTROLS_SCHEMA.md:436` — ecosystem-layering prose mentioning CalmSentry/OpsFlow
