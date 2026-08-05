# Hot-Cold Archival & Hybrid Mobile Deployment

Standards for managing long-term data storage and mobile app deployments.

## 1. Capacitor Build Sync
- **Mandatory Sync**: After ANY web build (`npm run build`), you MUST run `npx cap sync android` before building APKs or testing on mobile devices. Failing to sync leaves stale web code in the native wrapper.

## 2. Mobile Platform Guards
- **Guard Native APIs**: Native Capacitor plugins or APIs MUST be wrapped in `if (Capacitor.isNativePlatform()) { ... }`.
- **Crash Prevention**: Calling native APIs in a web context (GitHub Pages) will throw runtime errors and crash the app.

## 3. Hot-Cold Archival Engine
- **Keyset Pagination**: Archival Edge Functions must always use Keyset Pagination (`WHERE id > last_cursor ORDER BY id`), never `OFFSET`, to prevent performance degradation on large tables.
- **Partial Success Handling**: Functions must gracefully handle HTTP 206 Partial Content if execution time limits are reached mid-batch.
- **No Cold Storage Caching**: As specified in the RBAC rules, never cache cold storage JSON blobs in the Service Worker.
