# Phase 4 Runbook — Automated Daily Cron (3-Wave Org-Wide Rollout)

**Goal:** Enable the automated daily cron (~12:00 PM IST, after morning logins & Phase 2 Week-Off prompts) and expand from the Pilot Hub(s) to 100% of the organization in 3 controlled waves.
**Estimated Effort:** ~0.5 day (workflow schedule + wave monitoring)
**Risk Level:** Low (wave-gated + 1-click GitHub Actions kill switch)

---

## 1. What Ships in Phase 4

- Enable the `schedule:` trigger (`cron: '30 6 * * *'` UTC = **12:00 PM IST**) in `.github/workflows/unmarked-attendance-cron.yml` for Staging and Production.
- Expand coverage in 3 waves via `p_hub_ids`:

| Wave | Scope | Duration | Key Metrics to Watch |
|---|---|---|---|
| **Wave 1** | Pilot Hub(s) + 2–3 hubs (~25% workforce) | 5 business days | Cron stability, task volume per manager after Phase 2 filtering, orphan count on Master Admin |
| **Wave 2** | ~60% of hubs | 5 business days | Post-weekend/holiday spike handling, Checker 24h turnaround |
| **Wave 3** | **100% of active workforce** (`p_hub_ids: null`) | Ongoing | Org-wide daily attendance closure |

---

## 2. Pause / Rollback Lever
- **1-Click Pause:** Disable `.github/workflows/unmarked-attendance-cron.yml` in GitHub Actions UI or remove a hub ID from the wave list.
- **Zero data loss:** Already-created tasks remain fully functional; Phase 2 Self-Service Week-Off continues working independently.

---

## 3. Exit Criteria (Before Phase 5)
- [ ] 5 consecutive automated days at 100% org coverage with zero cron failures.
- [ ] >90% of unmarked attendance tasks resolved within 24–48 hours.
- [ ] Orphan fallback rate <5% of generated tasks.
