# Controlled order shipping edits

Baseline: origin/develop `f30ba63d43bf15193deaa163e72bd70c5a8f4089`, fetched 2026-11-03 (Asia/Saigon).
Branch: `feature/order-shipping-edit`, implemented in a separate worktree so the uncommitted Dashboard realtime fix is excluded.

## Business explanation (for documentation/PPT)

> Đơn hàng không cho phép CRUD tự do. Hệ thống chỉ cho phép cập nhật thông tin giao nhận trước khi đơn bước sang trạng thái giao hàng. Các dữ liệu giao dịch như sản phẩm, số lượng, đơn giá và tổng tiền được giữ nguyên để đảm bảo tính toàn vẹn lịch sử.

## Permissions and editable fields

Only **Pending** and **Confirmed** orders are editable. Shipping, Completed and Cancelled return 409. Payment state does not alter this shipping eligibility: a paid Confirmed order may still receive an address correction, without touching payment data.

- `PUT /api/orders/{id}/shipping-info`: authenticated owner only; other users receive 404.
- `PUT /api/orders/admin/{id}/shipping-info`: Admin role required; non-admin receives 403.

Both accept exactly:

```json
{
  "recipientName": "Người nhận",
  "recipientPhone": "0901234567",
  "shippingAddress": "Địa chỉ giao hàng",
  "note": null
}
```

Name, phone and address are required and trimmed. Maximum lengths match the existing schema: 100, 20 and 500; optional note is trimmed, maximum 500, empty becomes null. Phone uses the same server PhoneAttribute as checkout. DTO rejects unknown JSON members, so status/userId/payment/items/timestamps cannot be supplied through this API. Validation returns 400. A successful update returns the order ID; clients reload the authoritative detail.

## Concurrency, audit and integrity

Uses the same transaction-owned SQL `order:{id}` application lock as order transitions/cancellation. After acquiring it, the server loads the current DB status and ownership, then conditionally updates only the four allowed fields plus existing UpdatedAt. This also works across API instances sharing the database.

If Shipping commits first, the edit returns 409; if the edit commits first, Shipping sees the newly saved delivery snapshot. Identical retries while still eligible are no-ops: no timestamp rewrite or duplicate notification. Concurrent different eligible edits serialize; last successful edit wins. No new rowversion/version-history system was introduced.

UpdatedAt is written with server UTC time for a real change. No existing order-specific audit-log/UpdatedBy infrastructure was found; no audit subsystem or schema was added. CreatedAt, PaidAt, payment fields, CheckoutReceipts, OrderDetails snapshots, quantities, total, inventory, cart and account profile are untouched.

## UI and realtime

Customer/Admin Order Detail share OrderShippingEditor, beside recipient information and separate from status/payment/cancellation actions. The existing DeliveryDialog and NotificationToast are reused. It prefills the order snapshot, validates inline in Vietnamese (no native browser bubbles), supports cancellation, disables controls while submitting, and prevents duplicate requests. Success closes the dialog, reloads detail, and shows “Đã cập nhật thông tin giao hàng”. Errors preserve the draft; a 409 reloads order state and blocks stale retries. If an incoming event already reveals Shipping, the open dialog explains that editing is locked.

After commit, the existing secure OrderEvents publisher sends **OrderUpdated** to the owner and active Admins only. CommerceProvider listens on its existing connection and refreshes order views. There are no client-selected groups or second realtime connections. Publication failure remains logged/non-fatal by the existing publisher. UI ignores responses from previous sessions/unmounted order views. Dense order lists keep their existing row navigation and have no inline editor.

## Verification

- Backend build: PASS, zero warnings/errors.
- Full frontend lint: PASS.
- Frontend tests: **188 PASS / 25 files**.
- Frontend build: PASS; existing >500 kB main-bundle warning remains.
- Integration: order-shipping, person3, payment, wishlist, catalog, product-removal, reviews/Q&A, analytics, consultation and chat all PASS.
- Shipping tests use disposable local fixtures and clean up in finally. They cover ownership/roles, eligible/locked states for customer/Admin, stale Shipping saves, concurrent edit/Shipping, duplicate no-op updates, whitespace/phone/length validation, unknown-member rejection, optional note and maximum-length boundaries; they compare totals/details/payment/stock/cart/profile/receipt before and after. Secure owner/Admin notifications and exclusion of another customer are checked.
- React tests exercise flows A–E through the actual OrderDetailView, including success, conflict, cancellation, server/network errors, duplicate clicks, accessibility errors, previous-session responses and the provider's OrderUpdated handler.

Run integration with PERSON3_API_URL set to the intended local test API; existing PERSON3_SQL_SERVER / PERSON3_SQL_DATABASE select SQL Server/database. Do not use production data.

## Manual verification and deployment

The browser currently denies localhost under its saved permission/managed policy. Manual browser visual verification is **not claimed as PASS**; API and React interaction tests are the evidence above. Verify the modal, keyboard focus, toast and the two-session Confirmed→Shipping conflict in a browser before marking the draft PR ready.

No SQL script, schema change, scaffold edit or new dependency is required. No Admin create-order/hard-delete functionality was added. Current develop payment rules are preserved; PR #17's manual QR/COD changes and the separate pending Dashboard realtime work are not included. Shared OrdersController partial declaration, OrderDetailView and CommerceProvider should be reviewed when those branches are integrated, preserving both features.
