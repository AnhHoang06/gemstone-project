# Contact messages

## Deployment (Database First)

Run ContactMessages.sql against the existing application database BEFORE starting this version:

    sqlcmd -S '.\SQLEXPRESS' -d GemstoneShop -E -C -b -i backend/GemstoneShop/GemstoneShop/Database/ContactMessages.sql

The script creates only ContactMessages and its indexes, defaults, status check, and optional Users FK. It is repeatable and preserves existing messages. It does not change Person3, Wishlist, Payment, CategoryHierarchy, ProductSearch or Reviews schemas. No cascade delete is enabled. No scaffolded file was edited: mapping is in Data/ContactContext.cs, wired through the existing handwritten CommerceContext.cs extension.

Dates are UTC. Contact rows retain sender snapshots; deleting a referenced user requires an explicit separate retention decision. This module does not delete accounts or contact history.

## API and privacy

- POST /api/contact: guest or authenticated user. Body: fullName, email, optional phone, subject, message. Valid JWT determines UserId; client UserId/status/AdminNote fields are ignored. Invalid/expired/inactive supplied sessions return 401, not anonymous fallback. Success: 201 with only a confirmation message.
- GET /api/admin/contacts?status=New&page=1: Admin only, newest first; 20 records per page. Omit status for all.
- GET /api/admin/contacts/{id}: Admin only, sender snapshot and internal note.
- PUT /api/admin/contacts/{id}: Admin only, {status, adminNote}; changes only status, note and UpdatedAt.
- Statuses: New, InProgress, Resolved. All three are selectable; no extra transition rules are invented.
- No public listing, customer history endpoint, email delivery, or automatic replies.

Validation: name 1–100, email required/email-format/max 254, optional phone max 20 with optional leading + and digits/spaces/parentheses/hyphens (at least seven digits), subject 1–100, message 10–4000 trimmed characters (raw max 4000), admin note max 2000. Required text cannot be whitespace. Public request body limit: 32 KiB.

frontend/src/config/site.js is the sole business contact source. Configure only verified phone/email/address/openingHours/socialLinks; absent values are hidden.

## Verification

    dotnet build backend/GemstoneShop/GemstoneShop/GemstoneShop.csproj --nologo -p:NuGetAudit=false
    cd frontend
    npm ci
    npm run lint
    npm test
    npm run build

For integration, start the API against a disposable/local development SQL Express database with existing project scripts applied. Configure its connection and JWT via the existing User Secrets/environment setup. Then from repository root:

    $env:CONTACT_API_URL='http://localhost:5127'
    node tests/contact.integration.mjs

The test applies the Contact script, creates unique synthetic accounts/messages, checks authorization/validation/ownership/internal-note privacy/updates/script rerun, and deletes only its own fixtures in finally. Never point test suites at production.

## Scope and limitations

Submit is disabled while pending and guarded synchronously against double clicks. This is not cross-request idempotency: a retry after an uncertain network failure can create another message. No rate limiter currently exists in the baseline; no CAPTCHA, large dependency, or external mail provider was introduced. Before Internet deployment, consider a small rate limit and a retention policy separately.

Admin edits use last-write-wins for status/note. Rich HTML is never rendered. No sample data script is included; integration fixtures are temporary and removed.
