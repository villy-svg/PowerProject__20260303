# Phase 4 Runbook — Automated Daily Cron (3-Wave Org-Wide Rollout)

**Goal:** Enable the automated daily cron (**09:00 AM IST**, 4 hours after the 05:00 AM night-shift rollback closes, sweeping `T - 2` so Day, Evening, and Night shifts all get a full 24h self-service window and managers are never pinged at dawn) with 7-layer anti-flood protection and optional wave scoping.
**Estimated Effort:** ~0.5 day (workflow schedule + wave monitoring)
**Risk Level:** Low (circuit-breaker protected + 1-click GitHub Actions kill switch)

---

## 1. What Ships in Phase 4

- Enabled `schedule:` trigger (`cron: '30 3 * * *'` UTC = **09:00 AM IST**, sweeping `logical_today - 2`) in `.github/workflows/unmarked-attendance-cron.yml` for Staging and Production.
- Optional repository variables for zero-code wave control & kill switches:
  - `UNMARKED_ATTENDANCE_PROD_DISABLED = 'true'` / `UNMARKED_ATTENDANCE_STAGING_DISABLED = 'true'` — instant pause switch.
  - `UNMARKED_ATTENDANCE_PROD_HUB_IDS` — optional comma-separated Hub UUIDs to scope waves without editing YAML (blank = 100% org).
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
