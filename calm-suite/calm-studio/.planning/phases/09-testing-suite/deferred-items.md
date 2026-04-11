# Deferred Items — Phase 09 Testing Suite

## Pre-Existing Test Failures (Out of Scope)

### src/tests/io/export.test.ts — 7 failing tests

**Found during:** Plan 09-03 Task 2

**Issue:** `URL.revokeObjectURL is not a function` — jsdom environment does not implement
`URL.revokeObjectURL`, which is called in `export.ts:113` inside a `setTimeout` callback
during the `exportAsCalm` Blob download flow.

**Status:** Pre-existing before Plan 09-03. Confirmed via `git stash` test run —
7 tests in `src/tests/io/export.test.ts` were already failing before any changes in this plan.

**Tests failing:**
- `exportAsCalm — AIGF decorator injection > injects AIGF governance decorator when AI nodes are present`
- `exportAsCalm — AIGF decorator injection > decorator type is "aigf-governance"`
- `exportAsCalm — AIGF decorator injection > decorator has unique-id "aigf-governance-overlay"`
- `exportAsCalm — AIGF decorator injection > decorator applies-to includes AI node IDs`
- `exportAsCalm — AIGF decorator injection > decorator data has governance-score between 0 and 100`
- `exportAsCalm — AIGF decorator injection > decorator data includes FINOS AIGF framework reference`
- `exportAsCalm — CALM field preservation > preserves node controls in AI arch output`

**Fix required:** Add `vi.stubGlobal('URL', { ...URL, revokeObjectURL: vi.fn() })` in the
export test setup, OR mock the download side-effect in `export.ts` for the test environment.

**Scope boundary:** These tests are in `src/tests/io/export.test.ts` which was created in
a previous phase (09-02). This plan (09-03) only creates component tests in `src/tests/components/`.
Per the scope boundary rule, only issues DIRECTLY caused by current task's changes are auto-fixed.
