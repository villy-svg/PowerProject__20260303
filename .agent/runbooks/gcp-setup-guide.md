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

## 6. Update Runbook Config
Once you have these, add them to your secret manager:
- `GOOGLE_SERVICE_ACCOUNT_JSON`: [Contents of your downloaded JSON file]
- `GOOGLE_DRIVE_FOLDER_ID`: [The ID from step 5.3]
