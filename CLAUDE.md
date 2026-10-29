# CLAUDE.md

## Grep before you write

Before implementing any new function or type, grep the codebase for something that already does this. Reuse or extend it instead of adding a second version.

Shared code lives here, so check these first:

- `src/lib/types.ts`: every domain type and status list
- `src/lib/utils.ts`: formatting (dates, money, ports), refs, calculations, search / date-range filters, file helpers
- `src/lib/store.tsx`: all state changes go through the store's actions
- `src/components/ui.tsx`: buttons, cards, tables, KPI cards, filter bar, modals, row menus
- `src/components/inputs.tsx`: multi email / phone inputs, document and image uploads

## How to approach work

### 1. Prompt chaining: plan, implement, verify

Use for large features, migrations and multi-page UI work. First inspect the codebase, then plan the change, implement it, and verify the result. Keep these stages explicit when the task is complex.

### 2. Routing: choose the right approach

Use different workflows for bugs, features, refactors and UI work. A bug fix needs diagnosis; a feature needs requirements and acceptance criteria; a visual overhaul needs design inspection and responsive verification.

### 3. Parallelization: independent reviews

Use for large changes where independent checks add value. For example, review accessibility, API integration and regression risks separately, then reconcile the findings. Don't parallelize tasks with shared dependencies unnecessarily.

### 4. Agent loop: act, observe, adjust

Use for debugging and tasks requiring tools. Run the relevant checks, inspect actual results, correct failures, and repeat until the acceptance criteria are met or a genuine blocker remains.

### 5. Evaluator-optimizer: implement, critique, improve

Use when quality can be assessed against clear criteria. Review the implementation against requirements, run deterministic checks, fix real issues, and stop when the criteria pass. Avoid endless subjective redesign.
