# Approved plans

Every multi-file change starts with a plan that the maintainer approves before any code is written (`CLAUDE.md`). Claude Code keeps plans in a local file outside the repo, and each new plan overwrites the last. So once a plan is approved, it is **saved here unchanged**, and Git keeps the record of what was agreed.

| File                                                                         | Plan                    | Implemented in |
| ---------------------------------------------------------------------------- | ----------------------- | -------------- |
| [2026-10-13-phase-6-react-frontend.md](2026-10-13-phase-6-react-frontend.md) | Phase 6: React frontend | `67a66bd`      |

Phases 0–5 and 7 were planned before this convention existed, and their plans were not kept. Their approved scope, verification and deviations are recorded per phase in [progress.md](../progress.md).

**Convention:**

- File name: `YYYY-MM-DD-<short-topic>.md`, using the approval date.
- Add a one-line note under the title: when it was approved, and the commit that implemented it.
- Don't rewrite an approved plan afterwards. Record deviations in `progress.md`, or write a new plan if the scope changes.
