# Customer Support Center

Baseline: origin/develop `2cae92f0bdf69280c0b191d5068a484bed5f3003`. Branch: `feature/support-center`.

## Scope and content
Public `/ho-tro` replaces the placeholder inside MainLayout. Header desktop/mobile and Footer already link there and remain unchanged. `/lien-he` remains the real chat/contact page; no duplicate contact form or auth guard is introduced.

Eight topics, nineteen FAQs: ordering, payment, delivery/statuses, cancellation, account, wishlist, reviews and product/certificate information. Static data is in `frontend/src/data/supportContent.js`. Search matches titles, content and keywords with case/accent-insensitive Vietnamese tokens (including đ and decomposed Unicode); category and search filters combine. No search API calls. Reset restores all questions and search focus.

## Source-of-truth content review
| Statements | Existing implementation inspected |
|---|---|
| Quantity persists on +/- and blur/Enter, server totals | `pages/Cart.jsx`, CommerceProvider |
| Recipient modal, snapshot only, order created on confirmation; COD → orders, bank transfer → payment | `commerce/CheckoutSummary.jsx`, OrdersController.Checkout |
| Only COD/BankTransfer; new Pending + Unpaid | OrdersController.Checkout / PaymentMethods |
| No QR; no bank data means do not transfer; button is local UI feedback only | `pages/Payment.jsx`, OrdersController.Payment |
| Completed does not automatically set Paid; no receipt-report/confirm API in this baseline | OrdersController.Transition, `pages/Payment.jsx` |
| Customer cancels own Pending only; admin Pending/Confirmed; cancellation is not a refund | OrdersController.Transition |
| Pending → Confirmed → Shipping → Completed; Cancelled separate | OrdersController.Transition |
| Editable profile fields vs read-only email/role; change password | Account.jsx, ChangePassword.jsx |
| Per-account favorites and inactive filtering | Wishlist provider/controller |
| Completed purchase eligibility, one review per customer/product, editing preserves moderation | ReviewsController.Purchased/Save, ProductReviews.jsx |
| Authority/number/document shown only if present | ProductDetail.jsx, utils/catalog.js |

Do not change FAQ to describe the separate payment-order feature until that behavior is merged into develop. In particular, do not claim the customer button sends a receipt, that QR exists, or that Completed automatically marks COD Paid.

No invented hotline/address/email, delivery guarantee/fee, refund/return/warranty period, certification guarantee, store hours or unsupported payment gateway. Undefined policies direct to Contact.

## Accessibility and responsive implementation
Native button accordions with stable aria-controls / aria-expanded and hidden closed panels; multiple answers may stay open. Visible focus, labelled search, polite result count, text alongside decorative status icons, semantic ordered status guide. Existing routes handle authentication for quick links.

Scoped support CSS uses three-column topics and four-column status guide at desktop; status becomes two columns below 800px and vertical below 540px. Topics become two columns on mobile; search and CTA wrap. No page-overflow hiding or new dependencies. Opening animation respects prefers-reduced-motion.

## Verification
Full frontend lint PASS; full frontend tests PASS (174 tests / 24 files, including 8 Support tests); frontend build PASS with existing large-chunk warning (~728 kB main JS). Backend untouched; no backend build required. Focused React coverage: rendering, Unicode/token search, content/keyword matches, combined filters/reset focus, accordion semantics and focusability, multiple-open behavior, actual link navigation, empty state, payment/cancellation/review content constraints.

**Visual check blocked, not PASS:** attempted to open localhost:2222/ho-tro with the provided browser tool. It denied access because a saved permission/managed policy blocks the origin. No alternate browser or automation workaround was used. Actual 1366px / 768px / 390px screenshots, native Enter/Space activation, and viewport overflow checks remain manual QA. CSS inspection and jsdom tests do not establish visual correctness.

Manual QA: open /ho-tro at all three widths; search `doi mat khau`, clear; combine a topic with no matching query; Tab to an FAQ and activate with Enter/Space, check focus and aria-expanded; follow quick links and Contact CTA; verify the status guide stacks and no horizontal overflow occurs.

No backend, schema, API contract or commerce behavior changed. Existing untracked product-image-list.md and payment worktree are outside this feature.
