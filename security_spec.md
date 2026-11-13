# Security Specification — Bia Prompts IA (Acesso Exclusivo para Assinantes)

## 1. Data Invariants
1. **Strict Paid-Only Gate**: Non-admin users start with `planStatus == 'pending'` and expired `accessExpiresAt <= request.time`. They cannot read `/prompts`, write `/favorites`, or save `/generations` unless `hasActiveSubscription()` is true (`planStatus == 'active' && accessExpiresAt > request.time`). Admins (`biancaborbado123@gmail.com`, `luanasantosarodrigues@gmail.com`) have unlimited access (`isAdmin()`).
2. **PII & Subscription Isolation**: `users/{userId}` contains `email` and `planStatus`. Only the owner (`request.auth.uid == userId`) or a verified admin (`isAdmin()`) may `get` a user profile; only `isAdmin()` may `list` all users.
3. **No Self-Elevation**: Non-admin users cannot set `planStatus == 'active'` on creation or update (when pending or expired) UNLESS a verified `/approved_purchases/{emailKey}` document exists for their verified Google email.
4. **Verified Admin Control**: Only verified admins (`email_verified == true` for `biancaborbado123@gmail.com`, `luanasantosarodrigues@gmail.com`, or `/admins/{uid}` marker) have unlimited access and can manage `/prompts/{promptId}`, `/approved_purchases/{emailKey}`, and member subscriptions.
5. **Private Subcollections**: `/users/{userId}/favorites/{promptId}` and `/users/{userId}/generations/{genId}` enforce `userId == request.auth.uid`, `isOwner(userId)`, and `hasActiveSubscription()`.
6. **Temporal Integrity**: `createdAt`, `updatedAt`, and `savedAt` must equal `request.time` on creation/update.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Admin Shadow Field**: `POST /users/{uid}` with `isAdmin: true` -> Rejected by `keys().hasOnly(...)`.
2. **Self-Grant Active Plan Without Purchase**: `POST /users/{uid}` with `planStatus: "active"` when no `/approved_purchases/{emailKey}` exists -> Rejected by `hasPreapprovedPurchase()`.
3. **Subscription Escalation Update**: `PATCH /users/{uid}` changing `planStatus` to `"active"` without pre-approval -> Rejected by `affectedKeys().hasOnly(['displayName', 'updatedAt'])`.
4. **Unpaid Prompt Scraping**: `LIST /prompts` or `GET /prompts/{id}` by a `pending` or `expired` user -> Rejected by `hasActiveSubscription()`.
5. **Cross-User Profile Snooping**: `GET /users/{otherUid}` by non-admin -> Rejected by `isOwner(userId) || isAdmin()`.
6. **User Collection Scraping**: `LIST /users` by non-admin -> Rejected by `allow list: if isAdmin()`.
7. **Unverified Email Admin Spoof**: Write to `/prompts/{id}` where `email_verified == false` -> Rejected by `isVerifiedUser()`.
8. **Fake Pre-Approval Injection**: `CREATE /approved_purchases/{emailKey}` by non-admin -> Rejected by `isAdmin()`.
9. **ID Poisoning**: `CREATE /prompts/bad$id` -> Rejected by `isValidId(promptId)`.
10. **Resource Exhaustion**: `CREATE /prompts/{id}` with `promptText` > 4000 chars -> Rejected by `promptText.size() <= 4000`.
11. **Unpaid Generation Write**: `CREATE /users/{uid}/generations/{gid}` by `pending` user -> Rejected by `hasActiveSubscription()`.
12. **Generation Owner Spoofing**: `CREATE /users/{uid}/generations/{gid}` with `userId: "other"` -> Rejected by `data.userId == request.auth.uid`.
