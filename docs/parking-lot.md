# Parking lot

Deferred work, open questions and ideas that are **not** being worked on yet. This is the one place to find them, instead of scattered notes in `progress.md` or code comments.

**How to use it:**

- Add an entry with today's date. Keep each line short and link to details.
- When something is picked up, open a GitHub issue (Task, Feature or Improvement template). Then move the entry to **Done / picked up**, with the issue or commit.
- Review this list at the start of each new phase or session. Delete entries that no longer matter, and say why in the commit message.
- New dependencies, scope changes or anything touching money/date rules still need a plan and approval (see `CLAUDE.md`).

## Open: needs action

| Added      | Item                                                                                | Why it's waiting                                                                                                                       | Needs                                                      | Priority |
| ---------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------- |
| 2026-10-13 | **Manual browser check of the MVP flows** ([demo checklist](demo-checklist.md) B–D) | Can only be done by a person in a real browser; the dashboard is confirmed so far                                                      | Maintainer                                                 | High     |
| 2026-10-13 | Set the GitHub **default branch** to `main`                                         | GitHub repository setting, not a code change                                                                                           | Maintainer (Settings → General)                            | Medium   |
| 2026-10-13 | **Upgrade Prisma** once a stable release fixes `deepmerge-ts` / `mysql2` advisories | Only fix today is a breaking downgrade; Prisma 8 is a release candidate ([security.md](security.md#known-advisories-as-of-2026-10-13)) | Check each Prisma release; plan + approval for the upgrade | Medium   |

## Ideas: decide later

| Added      | Idea                                                         | Notes                                                                                                                                       | Decision needed from |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 2026-10-13 | **Real-browser e2e tests** (Playwright)                      | Would automate demo-checklist sections B–D in CI. New dependency batch → needs approval.                                                    | Maintainer           |
| 2026-10-13 | **Clean URLs** (`/transactions` instead of `#/transactions`) | History API, with or without React Router. Static hosting then needs an `index.html` rewrite rule ([ADR 0005](adr/0005-frontend-stack.md)). | Maintainer           |
| 2026-10-13 | **Code-split the web bundle**                                | 150 kB gzipped today; only worth it if the app grows                                                                                        | —                    |
| 2026-10-13 | **Keyset pagination** for transactions                       | Offset pagination is fine at personal scale; keyset scales better for very deep pages (Phase 4 note)                                        | —                    |
| 2026-10-13 | **Cached/rolled-up monthly totals**                          | The summary is computed live each request; only needed for large data (Phase 5 note)                                                        | —                    |
| 2026-10-13 | **Charts** on the dashboard                                  | plan.md §7: "simple list first; charts later"                                                                                               | Maintainer           |

## Learning exercises (from each phase)

| Phase | Exercise                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------- |
| 1     | Add a `timestamp` to the health response: ✅ done                                                       |
| 2     | `EXPLAIN` a query filtered by `category_id` in pgAdmin and find the index it uses                       |
| 3     | Add `?search=` (case-insensitive name match) to `GET /categories`, with an e2e test                     |
| 4     | Add `?search=` on transaction notes that combines with `month`, with an e2e test                        |
| 5     | Write SQL for **income** by category for September 2026 and compare it with the expense breakdown query |

## Done / picked up

| Date       | Item                                                    | Where                                 |
| ---------- | ------------------------------------------------------- | ------------------------------------- |
| 2026-10-13 | Remove `X-Powered-By` header (Phase 1 known limitation) | `00b8b97` (Phase 7)                   |
| 2026-10-13 | Document the Prisma CLI audit findings                  | [security.md](security.md), `00b8b97` |
