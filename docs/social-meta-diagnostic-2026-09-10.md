# Social / Meta diagnostic — 2026-09-10

This note records the admin-panel state reported on 2026-09-10 and the code-level interpretation. It is intentionally read-only documentation; it does not change Meta ownership, reconnect accounts, or weaken publish gates.

## Observed admin state

- Villa Safira Instagram: connected and healthy; API quota displayed as 98/100.
- Villa Safira Facebook: connected; profile/about metadata needs sync.
- Villa Destan Facebook: connected; profile/about metadata needs sync.
- Villa Safira Facebook ↔ Instagram: relationship mismatch; the Facebook Page relationship exposed by Meta does not match the Instagram account stored for Safira.
- Villa Destan Instagram: `BLOCKED_EXTERNAL_META_OWNERSHIP`; automatic Graph API publishing is intentionally disabled while the external Meta Business Portfolio ownership/admin issue remains unresolved.
- Publish-health panel showed `Hatalı 1`, separately from the Destan IG hard-block count.

## Code interpretation

- `src/app/api/meta/health/route.ts` and `src/lib/facebook-instagram-relationship-live.ts` perform live Facebook ↔ Instagram relationship checks.
- `src/lib/facebook-instagram-relationship.ts` distinguishes a true link mismatch from missing permissions/API-read uncertainty.
- `src/lib/social-account-policy.ts` deliberately keeps Destan Instagram hard-blocked until the Meta-side ownership/admin problem is positively resolved.
- `src/components/SocialPublishHealth.tsx` excludes hard-blocked Destan Instagram posts from the generic `Hatalı` counter. Therefore the displayed `Hatalı 1` is a separate active-target publish failure and must be diagnosed independently before changing any account linkage.
- Facebook `Hakkında senkronu gerekli` is metadata drift, not a token/connectivity failure.

## Safety decision

Do not bypass or remove the Destan Instagram hard block. Do not disconnect, transfer, migrate, or remove either Instagram account or Facebook Page while diagnosing the mismatch. The next Meta-side inspection should be read-only first: verify which Instagram professional account is currently linked to the Villa Safira Facebook Page and which Business Portfolio owns/administers `@villadestanpatara` before any ownership/link mutation.

## Follow-up

1. Identify the exact `lastPublishError` behind the one active `Hatalı` item; do not assume it is related to Destan Instagram.
2. Verify Safira Page → Instagram professional-account relationship in Meta without unlinking anything.
3. Verify Destan Instagram asset ownership/admin portfolio in Meta without transferring/removing the asset.
4. Only after positive Meta-side verification should a relationship repair or Destan hard-block removal be considered.
