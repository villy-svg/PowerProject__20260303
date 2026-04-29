# ✅ Checkpoint 7 — After Phase 8 (GitHub Actions Cron Setup)

> **Run this BEFORE starting Phase 9.**
> Verifies that the GitHub Actions workflows are correctly configured and can trigger the archive function on demand.

---

## Step 1: Verify Workflow Files Are Committed

```bash
ls -la .github/workflows/
```

**Expected — these 3 files must exist:**
```
archive-cron.yml
archive-log-cleanup.yml
archive-failure-alert.yml
```

If any are missing, create them from Phase 8 runbook and commit:
```bash
git add .github/workflows/
git commit -m "feat: add cold storage archive GitHub Actions workflows"
git push
```

---

## Step 2: Verify GitHub Secrets Are Set

1. Go to **GitHub → Your Repo → Settings → Secrets and variables → Actions**
2. Confirm both secrets are listed:

| Secret Name | Status |
|---|---|
| `SUPABASE_URL` | ✅ Set |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set |

**If the values are wrong, the workflows will fail silently with HTTP 401.**

To verify the URL format — it should look like:
`https://abcdefghijklmno.supabase.co`
(NOT ending with `/` and NOT including `/rest/v1` or any path)

---

## Step 3: Check Workflow Syntax

```bash
# If you have the GitHub CLI installed:
gh workflow list

# Expected output:
# Cold Storage Archive        active   archive-cron.yml
# Archive Log Retention       active   archive-log-cleanup.yml
# Archive Failure Alert       active   archive-failure-alert.yml
```

If `gh` is not installed, go to **GitHub → Actions tab** and verify all 3 workflows appear.

---

## Step 4: Trigger the Archive Manually via GitHub UI

1. Go to **GitHub → Actions → Cold Storage Archive**
2. Click **"Run workflow"** (right side, "Run workflow" button)
3. Select branch: `main` (or your default branch)
4. Click **"Run workflow"**
5. Wait ~30 seconds for the run to appear
6. Click on the run → click `archive` job → expand `Trigger Archive Edge Function` step

**Expected step output:**
```
HTTP Status: 200
{
  "run_id": "...",
  "total_duration_ms": ...,
  "results": [
    {
      "entity_type": "proof_of_work",
      "status": "skipped",
      "count": 0
    }
  ]
}
✅ Archive completed successfully
```

(Status `skipped` is expected if there's no 7-day-old hot data. The key check is HTTP 200 and `✅ Archive completed successfully`.)

---

## Step 5: Verify the Workflow Returns Failure on Bad Credentials

This is a safety test. Temporarily test what happens if the function is unreachable:

Check that the archive-cron.yml contains the HTTP status check:
```bash
grep -A 5 "Fail the workflow" .github/workflows/archive-cron.yml
```

**Expected:**
```yaml
# Fail the workflow if the function returns a non-2xx status
if [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 300 ]; then
  echo "❌ Archive function returned HTTP $HTTP_STATUS"
  exit 1
fi
```

If this block is missing, the workflow will silently pass even on errors.

---

## Step 6: Check Cron Schedule is Correct

```bash
grep "cron:" .github/workflows/archive-cron.yml
```

**Expected:**
```yaml
- cron: '0 */6 * * *'  # Every 6 hours
```

Validate the cron expression at [crontab.guru](https://crontab.guru/#0_*/6_*_*_*) to confirm it runs every 6 hours.

Adjust the interval if needed:
- Every 30 minutes: `'*/30 * * * *'`
- Every hour: `'0 * * * *'`
- Every 6 hours: `'0 */6 * * *'`
- Daily at midnight: `'0 0 * * *'`

---

## Step 7: Confirm Email Notifications Are Set Up (For Failure Alerting)

GitHub will automatically email you when a workflow run fails — IF you have notifications enabled:

1. Go to **GitHub → Settings → Notifications**
2. Under **Actions** → confirm **"Failed workflows only"** or **"All"** is selected for email
3. This is your primary failure alert mechanism

---

## ✅ Checkpoint PASSED if:
- All 3 workflow files exist and are committed
- Both GitHub Secrets are set
- Manual trigger returns HTTP 200 and `✅ Archive completed successfully`
- The HTTP status check (`exit 1` on failure) is present in the workflow
- Cron schedule is correct

## ❌ Checkpoint FAILED if:
- Workflow run shows `HTTP Status: 401` → `SUPABASE_SERVICE_ROLE_KEY` secret is wrong or not set
- Workflow run shows `HTTP Status: 404` → `SUPABASE_URL` is wrong or the function isn't deployed
- Workflow run shows `HTTP Status: 500` → archive function has an error. Check Supabase Function logs.
- Workflow doesn't appear in GitHub Actions → YAML syntax error. Run `yamllint .github/workflows/archive-cron.yml` to check.

---

**➡️ Proceed to Phase 9 only after this checkpoint passes.**
