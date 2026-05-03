# CALM Hub UI Diff Feature Plan

## Aim
Build a battle-ready CALM architecture diff experience in `calm-hub-ui` that can compare two architecture JSON files and identify:
- nodes added, removed, modified, unchanged
- relationships/edges added, removed, modified, unchanged
- renamed nodes and renamed edges
- structural renames where the `unique-id` changed but the node/relationship is otherwise unchanged

## Done so far
- Created diff types in `src/model/diff.ts`
- Implemented core comparison logic in `src/service/diff-service.ts`
  - node add/remove detection
  - node modification detection
  - node rename detection
  - relationship add/remove detection
  - relationship modification detection
  - relationship rename detection
- Added test fixtures in `src/fixtures/diff-test-architectures.json`
- Added `src/service/diff-service.test.ts`
- Verified the diff-service tests pass
- Add tests for harder edge cases to stress the diff logic
  - edge/relationship rename detection
  - ambiguous rename matching when multiple candidates exist
  - relationship modifications beyond destination changes
  - metadata/interface changes on nodes or relationships
  - duplicate `unique-id` handling or invalid shapes
- Polish and UX:
  - color-code added/removed/modified/renamed elements
- Integrate with UI:
  - add a `/diff` route in `src/App.tsx`
  - create a `Diff.tsx` container page
  - add `DiffGraphPanel.tsx` for side-by-side architecture graphs
  - add `DiffPanel.tsx` for diff summary and details
  - extend `parseCALMData()` and node/edge rendering to support diff status styling

## What is left

- Add unit tests for UI:
  - Ensure coverage is comprehensive on both logic and UX.
- Polish and UX:
  - optionally add a toggle to hide unchanged items
  - add a JSON diff/detail view for property-level changes
