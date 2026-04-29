# GCP Setup Guide for Cold Storage

Follow these steps to generate the credentials and folder structure required for the Hot/Cold storage system.

## 1. Create a Project
1. Go to the [GCP Console](https://console.cloud.google.com/).
2. Click the project dropdown and select **New Project**.
3. Name it `PowerProject-Storage`.

## 2. Enable APIs
1. Go to **APIs & Services > Library**.
2. Search for **Google Drive API**.
3. Click **Enable**.

## 3. Create Service Account
1. Go to **IAM & Admin > Service Accounts**.
2. Click **Create Service Account**.
3. Name: `storage-manager`.
4. Click **Create and Continue**.
5. Assign Role: (Optional) You can leave this blank as we will share specific folders with the email.
6. Click **Done**.

## 4. Generate JSON Key
1. Click on the newly created service account email.
2. Go to the **Keys** tab.
3. Click **Add Key > Create New Key**.
4. Select **JSON** and click **Create**.
5. **CRITICAL**: Save this file safely. We will need to copy its content into Supabase secrets later.

## 5. Prepare the Drive Folder
1. Go to [Google Drive](https://drive.google.com/).
2. Create a folder named `PowerProject-ColdStorage`.
3. Open the folder and copy its ID from the URL (the string after `/folders/`).
4. Right-click the folder > **Share**.
5. Paste the **Service Account Email** (e.g., `storage-manager@...iam.gserviceaccount.com`).
6. Set permission to **Editor**.

## 6. Set Supabase Edge Function Secrets
Once you have the Google credentials, store them in your Supabase project so the Edge Functions can access them:
```bash
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<contents of downloaded JSON file>'
supabase secrets set GOOGLE_DRIVE_FOLDER_ID='<the ID from step 5.3>'
```

## 7. Set GitHub Actions Secrets
The archive cron job is triggered by GitHub Actions (not pg_cron). Store these in **GitHub Repo → Settings → Secrets and variables → Actions**:

| Secret Name | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Found in Supabase Dashboard → Project Settings → API → service_role key |

> **Why GitHub Secrets and not Supabase Vault?** The service role key is used to trigger the Edge Function from outside Supabase (via GitHub Actions). Storing it in GitHub Secrets means it is only ever transmitted over HTTPS — never stored in a database setting.
