# Decisions Log

Small, sensible defaults made without blocking. Reverse any of these if you have a reason.

## Locked-in choices

- **Prisma pinned to v6** (not "latest"). Prisma 7 (released May 2026) requires moving the `url` out of `schema.prisma` into a separate `prisma.config.ts`. CLAUDE.md provides the schema with `url = env("DATABASE_URL")` inline, so we use Prisma 6 to match the spec verbatim.
- **Backend ports:** `3001` (per CLAUDE.md).
- **Frontend port:** `5173` (Vite default, per CLAUDE.md).
- **Postgres connection:** `postgresql://cedric@localhost:5432/coffeeshop` (local Homebrew install, no password).
- **Backend module type:** ES modules (`"type": "module"` in package.json) — modern Node default.
- **Currency:** Indonesian Rupiah (Rp). Stored as `Decimal(10,2)` in DB; displayed as integer (no decimal places) on frontend.
- **Low-stock threshold:** `100` units, hardcoded on the frontend Dashboard. Same number used regardless of unit (g, ml, pcs) — simple to reason about, can refine later if needed.
- **Numeric responses:** Prisma returns `Decimal` fields as strings. Frontend coerces with `Number()` at the boundary; backend service layer also coerces before arithmetic.
- **Order item validation:** `quantity` must be a positive integer (`Number.isInteger` + `> 0`). Empty `items` array → 400. Unknown `productId` → 400 with `{ missing: [...] }`.
- **Product without a recipe:** allowed. Sale goes through, no ingredient deducted (per CLAUDE.md edge case).
- **Error shape:** `{ error: string, ...details }` — for example, shortages come back as `{ error, shortages: [...] }`.

- **Subtle gradients enabled** (post-v1 addition). Reversed the original "no gradients" rule. Applied only to focal elements: body background (warm radial wash), top nav (white→stone-50), Dashboard "Total orders" card (amber-50→white→stone-50 + amber-tinted border + gradient-clipped text on the big number), and primary/success action buttons (vertical gradients). Regular cards, alerts, and inputs stay flat. See docs/BRAND.md §5.6 for the full policy.
- **Micro-animations enabled** (post-v1 addition). Reversed the original "no motion" rule. Three custom utilities in `frontend/src/index.css`: `.btn-press` (scale 96% on click, 120ms), `.animate-fade-in` (opacity + 4px slide, 200ms), `.animate-pop` (scale 1.18→1, 220ms — used on cart quantity). All gated behind `prefers-reduced-motion: reduce`.

- **Renamed to "SimplePOS"** — generic F&B base, no coffee-specific branding in the shell.
- **Renamed to "Crema"** (post-v1) — single warm Italian word for the layer of foam on a pulled shot. Replaced both the working "SimplePOS" label and the in-progress "Espresso" landing brand. Applied across UI, page title, XLSX exports, demo emails (`demo@crema.app`), and internal namespaces (`crema.tour-dismissed`, `crema:data-changed`, `crema:tour-start`, `crema:tour-end`).
- **Left sidebar navigation** replaces top nav. Collapsible (icons-only mode) via toggle at the bottom. Icons: Heroicons outline set (dashboard grid, shopping cart, cube, archive box). Sidebar is `w-56` expanded, `w-16` collapsed.
- **Modal forms** for Add Product and Add Ingredient — triggered by header buttons. Tables stay as the primary view; creation is a secondary action.
- **Quick-add ingredient** button inside the Add Product modal recipe section. Opens a nested modal so users can create a missing ingredient without leaving the product form.
- **Dev reset endpoint** — `DELETE /dev/reset` wipes all data (OrderItem → Order → Recipe → Product → Ingredient) and resets auto-increment sequences. Exposed on the Dashboard behind a confirm step. Remove before production.

- **UI/UX Pro Max — Layer 1 + 2 refinements** (post-v1). Foundation pass to align with the UI/UX Pro Max checklist without changing scope or routes:
  - **CTA token added.** `--cta: 180 83 9` (amber-700) + `--cta-hover: 146 64 14` + `--cta-soft`. Mapped in Tailwind as `bg-cta`/`text-cta`. New `Button` variant `cta` for highest-emphasis primary actions (Submit Order, Create product, Add ingredient, Export). Caramel `accent` stays as brand/secondary tone.
  - **Chart-tint tokens added.** `--chart-profit` / `--chart-loss` replace the inline `#6ee7b7` / `#fca5a5` in the donut tooltip so profit/loss tints stay in sync with the token system.
  - **Tabular-figure utility.** `.tabular` (font-variant-numeric: tabular-nums) added to `index.css` so stat readouts and `AnimatedNumber` counters don't jitter.
  - **Hit-target utility.** `.hit-target` pseudo-element expands any small icon-only button's clickable area to ≥44×44px (Pro Max critical touch-target rule) without changing visual size. Applied to Modal close, Orders +/-, Products/Inventory edit/delete, and recipe-row remove buttons.
  - **Stable hovers.** `.card-interactive` no longer applies `translateY(-1px)` — shadow/border-only transition, so neighbors don't shift. `.icon-btn` no longer applies `scale(1.08)` — color/bg-only, same reason.
  - **Centralized icons.** New `components/Icons.jsx` exports Heroicons-outline SVGs (Plus, Minus, X, Check, AlertTriangle, TrendUp/Down, Trash, Pencil, Cart, Cube, Archive, Squares, ChartBar, Chevrons, Clock, SignOut, Undo, Download). NavBar, Modal, Dashboard, Orders, Products, Inventory, and Reports migrated. Inline path duplication eliminated. All icons render with `aria-hidden="true"` so they don't pollute the SR tree.
  - **Accessibility sweep (L2).** `aria-label` on every icon-only button (sidebar collapse, sign out, modal close, +/-, edit, delete, save, expand, export). Modal gets `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (via `useId`). The donut chart's "Others" row is now keyboard-actionable (`role="button"`, `tabIndex={0}`, Enter/Space handlers, `aria-expanded`). Both SVG charts get accessible `<title>`/`<desc>`. Inline edits on Products (price save) and Inventory (stock/threshold save) now write to a visually hidden `aria-live="polite"` region so SR users hear the outcome. The Dashboard low-stock list is a real `<button>` (was a `<li onClick>`), with `AlertTriangleIcon` so danger isn't communicated by color alone. Reports Profit/ROI cards pair color with `TrendUp`/`TrendDown` icons. Inventory rows below threshold get a danger-tinted `AlertTriangleIcon` prefix.
  - **Z-index scale preserved.** Audited and kept the existing 20/30/40/50/[51] tiers (chart tooltips → navbar+toast → tour scrim/halo+spotlight → modal+tour tooltip → tour mini-panel). No conflicts.

  Layers 3 (per-page redesigns) and 4 (charts/motion) are deferred.

- **UI/UX Pro Max — Layer 3 / Dashboard.** Rebuilt the Dashboard's primary hierarchy:
  - **Hero pulse card** — single full-width section with a `clamp(3.5rem, 10vw, 6.5rem)` orders-count number in the brand serif. Holds the existing `PeriodToggle` (now with `role="group"` + `aria-pressed`). `data-tour="dashboard-pulse"` is preserved on the hero so the tour anchor still resolves.
  - **Delta line** — when period is "today", a `TrendUp`/`TrendDown` icon + colored line shows "N more/fewer than yesterday · M yesterday". Hidden for "week"/"all" to avoid uneven-window comparisons (cleaner than fudging the math). Handles 0/0 and prior=0 explicitly.
  - **Secondary KPI row** — 3-col grid: Revenue (period), Avg order value, Items sold (period). Computed locally from the full `periodOrders` list. Em-dash when no orders. Each cell uses `AnimatedNumber` so values ease in.
  - **Needs attention panel** — full-width, demoted when empty (subtle "All ingredients above threshold" with a green check), emphasized with a danger-soft chip showing the count when something is low. Each low-stock row is the same keyboard-accessible button from L2.
  - **Load-bearing contracts preserved**: `data-tour="dashboard-pulse"`, `crema:data-changed` / `crema:tour-end` listeners, Getting Started checklist, tour invitation, DevPanel collapsible, restock modal, and the production-safe data-derived onboarding visibility logic are all unchanged.

- **UI/UX Pro Max — Layer 3 / Reports (Tier A).** Conservative polish pass; structure unchanged.
  - **Bar-in-cell on ingredient costs** — tried, then **reverted**. Translucent accent bars behind each row read as background noise on the warm parchment surface; the clean Fragment grid was preferred. Ingredient costs returns to the original numerical-only layout.
  - **Scoped refetch fade** — page-level `opacity-50` during refetch removed; only the chart sections fade. The KPI cards already have per-card skeletons during `refetching`, so they stay readable instead of going translucent with everything else.
  - **Humane range label** — replaced `YYYY-MM-DD → YYYY-MM-DD` with `Intl.DateTimeFormat`-driven output (e.g. `Apr 1 → Apr 30, 2025`, or `Apr 1, 2025` for single-day, with explicit years on cross-year ranges). Local-time parsing (no UTC shift). Falls back to raw ISO if parse fails.
  - **Screen-reader table fallback** — both `MonthlySalesChart` and `ProductMixChart` now render a `<table class="sr-only">` after the SVG with the underlying data (date/revenue/orders for sales; product/quantity/revenue/share for mix). Pro Max `data-table` rule. Visually invisible.
  - **Tabular utility sweep** — replaced remaining `tabular-nums` with the `.tabular` utility in Reports + both chart components for consistency with the L1 design system.
  - **Preserved**: the 4-card KPI row, both charts' visuals, the donut Others rollup, the date range presets, the export button, and the overall layout.

- **UI/UX Pro Max — Layer 3 / Orders (Tier A + B).**
  - **Sticky cart (desktop)** — the right-column aside is now `lg:sticky lg:top-6 lg:self-start`. Scrolling a long menu keeps the cart in view; `self-start` prevents the grid item from stretching to the menu column's height. `top-6` gives a small inset from the shell's rounded edge so the cart doesn't crash into the top corner. Sticky resolves against `<main>`'s `overflow-y-auto` scroll context.
  - **Mobile sticky-bottom summary bar** — `lg:hidden sticky bottom-4 z-30`. Visible only when cart has items, mirrors `N items` + total + Submit. Rendered as a rounded pill with `backdrop-blur` so menu content shows through. Z-30 sits above page content, below modal (50) and tour scrim (40). Does **not** replace the in-cart Submit button — both are reachable, the bar is the fast path on tablet/phone POS workflows.
  - **Cart empty state** — replaced the single muted line with `CartIcon` (faded) + serif headline "Your cart is empty" + secondary "Tap a drink from the menu to start". Animated grid-rows collapse for line items still works.
  - **Cart total emphasis** — total label moved to mono micro-caps, value bumped to `font-heading text-2xl tabular`. Anchors the bottom of the cart visually.
  - **Inline submit spinner** — both the in-cart Submit button and the mobile bottom-bar Submit show a `animate-spin` ring SVG next to "Submitting…" while `submitting` is true. Pure visual feedback; no behavior change.
  - **Menu card typography** — product name now `font-heading text-lg` (Instrument Serif), price moved to `font-mono text-xs tabular`. Quantity readout uses `.tabular`. Active/qty/idle border + bg states unchanged.
  - **Preserved**: 2-col grid, keyboard model (click card to activate, Enter +1, rShift −1), toast + Undo countdown + voided morph, shortage block (L2), order history collapsible section, all `crema:*` events, the L2 hit-target/aria-label work on +/− buttons.

- **UI/UX Pro Max — Layer 3 / Products (Tier A + B).**
  - **Recipe chips** — replaced the comma-joined recipe string with small rounded pills, one per ingredient. Format: `[qty][unit] · [name]`. Pills use `bg-elevated/60` with a hairline border, the quantity is `.tabular font-medium`. Pills `flex-wrap` so long recipes don't blow out the column. Extracted as `<RecipeChips recipes={...} />` so the table and the new mobile card view share the same component.
  - **Demoted Save button** — the always-visible-but-disabled Save in the Actions cell is now conditional: renders only when there's a pending price edit (`hasPriceEdit(p.id)`). When it appears, it fades in via `animate-fade-in`. Idle rows have noticeably less visual clutter.
  - **Edit/Delete icons fade on idle** — desktop table rows have `group` + idle icons at `opacity-40`, lifting to `opacity-100` on row hover OR `group-focus-within` (keyboard focus inside the row). Mobile cards force `iconAlwaysVisible` since hover doesn't exist on touch. `focus-visible:opacity-100` on the buttons themselves keeps keyboard tab-through legible.
  - **Mobile cards** — below `md`, the table is replaced with a stacked `<ul>` of cards. Each card shows: name (font-heading), inline-editable price with mono label, recipe chips, and the same action set (icons always visible on touch). Above `md`, the table renders unchanged. Both views share `RecipeChips` and `RowActions` sub-components — no logic duplication.
  - **Modal section divider** — Add/Edit modals now have a hairline `border-t border-divider/60` separating the Identity (Name/Price) block from the Recipe block. Recipe label upgraded to `tracking-wider` mono caps.
  - **Tabular sweep** — remaining `tabular-nums` → `.tabular`.
  - **Preserved**: the inline-edit price pattern itself, modal flows (Add / Edit / Delete confirm / Quick-add ingredient nested), all `data-tour` attributes, the `crema:data-changed` subscription, all L1/L2 aria work.

- **UI/UX Pro Max — Layer 3 / Inventory (Tier A + B).**
  - **Demoted Save button** — was always-visible-but-disabled; now only renders when `hasEdits(ing.id)` is true (threshold or cost has a pending change). Fades in via `animate-fade-in`. Stock still auto-saves on blur — Save was never needed for it.
  - **Delete icon fade on idle** — desktop rows use `group` + `opacity-40 group-hover:opacity-100 group-focus-within:opacity-100`. `focus-visible:opacity-100` on the button itself keeps it legible during keyboard tab-through. Mobile cards force `iconAlwaysVisible` (no hover on touch).
  - **Low-stock row tint** — rows where `stockQuantity < lowStockThreshold` get a soft `bg-danger-soft/30` plus a 4px `border-l-danger` accent stripe on the first cell. Pairs the existing L2 `AlertTriangleIcon` prefix with stronger spatial emphasis — low items are visible from a glance across a long inventory list. Mobile cards mirror the tint via `border-danger/40 bg-danger-soft/30`.
  - **Mobile cards (below md)** — table replaced by stacked `<li>` cards. Each card: header row with serif name + AlertTriangle (if low) + unit chip + actions; below that, a 3-col grid of inline-editable Stock / Cost-per-unit / Low-alert inputs with mono micro-labels. Stock auto-save on blur is preserved (Tier B doesn't change the auto-save behavior). `data-tour-ingredient` lives on the `<li>` so the tour anchor still resolves on mobile.
  - **Add modal sectioned** — split the form into **Identity** (Name) and **Stock & pricing** (Unit + Initial stock; Total price + Low alert). Hairline divider between sections; section labels in `font-mono text-[10px] uppercase tracking-wider text-ink-tertiary`.
  - **Tabular sweep** — last `tabular-nums` → `.tabular`.
  - **Preserved**: stock auto-save-on-blur (the defining UX choice of this page), the `aria-live` save announcement region (L2), modal flow (Add / Delete confirm), the `data-tour="inventory-table"` anchor, `crema:data-changed` subscription, all L1/L2 aria work.

- **UI/UX Pro Max — Layer 3 / Auth (Login + Register, Tier A).**
  - **Tagline under wordmark** — added a single muted line *"Quietly run your business."* beneath the oversized "Crema" wordmark in `AuthLayout`. Pro Max "Minimal Single Column" landing pattern: hero + short description, no bullets. Mobile shows the tagline directly under the smaller wordmark; desktop fades it in 120ms after the wordmark, with larger text (`text-base`) to balance the giant title. Tagline copy is a single string in `AuthLayout`; change in one place.
  - **Show/hide password on Login** — Register already had this; Login now matches via the same eye/eye-off toggle, `showPassword` state, and `pr-12` input padding. `aria-label` on the toggle for SR users.
  - **Centralized eye icons** — added `EyeIcon` + `EyeOffIcon` to `components/Icons.jsx`. Both Login and Register now import them; inline SVG path duplication eliminated.
  - **SVG spinner consistency** — replaced the CSS `border-t-white` ring spinner with the new `SpinnerIcon` (SVG circle + animated arc) — same component used by the Orders Submit button. Visual consistency across all loading states in the app.
  - **Dev tools gated to `import.meta.env.DEV`** — "Fill form" / "Skip login" buttons no longer render in production builds. Same gating pattern as the tour invitation card. Chevron rotation also swapped from the `&#9654;` glyph to the centralized `ChevronRightIcon`.
  - **Preserved**: the two-column composition + stacked mobile layout in `AuthLayout`, all entrance animations (`drop-out`/`rise-in` for navigating to and from `/app`), the staggered `fade-in-up` cascade, the shake-on-invalid behavior, the success check-draw animation, the email/password form structure, the `btn-glint` hover effect that's distinctive to the landing, and the cosmetic-only navigation (no real auth — per `CLAUDE.md` constraint).

- **UI/UX Pro Max — Layer 4 (cross-cutting polish).**
  - **Reduced-motion gate broadened** — the `prefers-reduced-motion: reduce` media query in `index.css` now suppresses every custom animation we ship, including the Tailwind-config-defined keyframes (`animate-fade-in-up`, `animate-card-exit`, `animate-btn-success`, `animate-check-draw`, all four `drop-out`/`rise-in` variants for shell/title/panel/nav, both `drop-up` variants, plus `animate-spin` for spinners). Previously only the `index.css`-defined utilities were gated. Anyone with `prefers-reduced-motion: reduce` set now sees a fully still UI.
  - **Donut tooltip overflow fix** — `ProductMixChart` tooltip was `whitespace-nowrap`, so long product names could push the tooltip beyond its dynamic clamp width. Removed nowrap, capped at `max-w-[240px]`, allowed `break-words` on the name row. Metric rows below stay aligned via the existing grid. The tooltip's auto-positioning logic (which reads `tt.offsetWidth`) auto-respects the new cap.
  - **Sticky cart overflow safety** — added `lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto` to the Orders cart `<aside>`. If shortages + cart together exceed visible viewport on a short screen, the aside scrolls internally instead of clipping. `position: sticky` + `overflow-y: auto` coexist cleanly.
  - **Hover-timing audit (no change)** — swept the codebase for `duration-200` / `duration-300` to standardize to a single hover baseline. After review every match is load-bearing: sidebar collapse pacing (300ms label fade matches 400ms width animation), Orders toast color morph (300ms paces the placed → voided icon swap), cart line-item collapse (300ms grid-rows), submit-button transition-all (matches `fade-in-up` cascade). All preserved as-is.
  - **React import in Reports** — confirmed still needed: `React.Fragment` is used in the ingredient costs grid (the Tier A bar-in-cell change was reverted, restoring Fragment usage).

- **Project root cleanup.** Root was 17 entries — operational files mixed with one-time prompts, academic deliverables, and macOS detritus. Now 8 entries (5 visible + `.claude/` + `.gitignore`).
  - **Deleted outright**: `BOOTSTRAP-LITE.md` and `BOOTSTRAP-LITE-PRD.md` (both prompts described a different app — "SimplePOS Lite", frontend-only with localStorage, not Crema's actual stack). Also removed `.DS_Store` files from root and `frontend/`.
  - **Archived** to `docs/archive/`: `PRD.md`, `PRD.pdf`, `generate_prd_pdf.py`, `project-template.md`. These are the academic PRD (in Indonesian, under the old "SimplePOS" name) and the original project brief (now superseded by `CLAUDE.md`). Kept for provenance; `docs/archive/README.md` explains each.
  - **Moved** `BRAND.md` → `docs/BRAND.md`. Fixed the broken `branding.md` references in `README.md` line 86 and this file's "Subtle gradients enabled" entry to point at the new location with correct casing.
  - **Added root `.gitignore`** — covers `.DS_Store`, `node_modules/`, `dist/`, `.env` variants, common editor cruft. Backend and frontend keep their own `.gitignore`s for tool-specific patterns.
  - **Known stale path inside archive**: `generate_prd_pdf.py` has a hardcoded output path `/Users/cedric/erp-coffeeshop/PRD.pdf` (line 143) — already broken before the move (project lives elsewhere now). Noted in `docs/archive/README.md`; left as-is since the script is archive-only.

- **Subscription system — future implementation spec.** Captured here for future implementation; nothing built yet. The current app is single-tenant with cosmetic auth; this spec assumes real auth + multi-tenancy (a `workspace_id` on every existing table, scoped queries) lands first as a prerequisite (~2–4 weeks of separate work).

  **Pricing tiers (in code, on the Account row):**
  - `'founding'` — Rp 49,000/month, locked in for the lifetime of the account. Reserved for ~first 30 customers from the personal/consulting network.
  - `'standard'` — Rp 89,000/month. Everyone after the founding cohort.

  **Data model additions:**
  - **Account** gets: `subscription_until: DateTime`, `subscription_status: 'active' | 'grace' | 'lapsed' | 'comp'`, `subscription_tier: 'founding' | 'standard'`, `last_payment_at: DateTime?`, `is_platform_admin: boolean` (true only on the founder's account).
  - **Payment** (new table, immutable journal — never delete rows): `id, account_id, gateway ('tripay' | 'manual'), gateway_payment_id (nullable for manual), amount, status ('pending' | 'confirmed' | 'failed' | 'refunded'), extended_until, note?, created_at, confirmed_at`. Every renewal — automated or manual — creates a row.
  - **WebhookEvent** (new table, idempotency guard): `id, gateway, gateway_event_id (unique), payload (JSON), processed_at`. Prevents duplicate processing when Tripay retries a webhook.

  **Access control middleware (every authenticated request):**
  - `subscription_status: 'comp'` → always allow
  - `subscription_until` in the future → full access
  - 0–7 days past expiry → GRACE: full access + persistent renewal banner
  - 8–14 days past → PARTIAL LOCKOUT: read-only (POST/PATCH/DELETE blocked except `/me/subscription/*`), prominent banner
  - 15+ days past → FULL LOCKOUT: every route redirects to `/renew` except `/renew` and `/me/*`

  **Payment flow — Tripay (automated, ~95% of renewals):**
  1. Customer clicks Renew → `POST /me/subscription/initiate-payment` creates a `Payment` row with `status='pending'`
  2. Backend calls Tripay API with amount + merchant_ref (the Payment.id) + callback URL → gets back checkout URL + QRIS image data + Tripay reference
  3. Backend stores `gateway_payment_id`, returns checkout info to frontend
  4. Frontend displays QRIS code or redirects to Tripay's hosted checkout
  5. Customer pays through Tripay's flow (QRIS, VA, e-wallet, etc.)
  6. Tripay fires `POST /webhooks/tripay` → backend validates HMAC signature, checks WebhookEvent idempotency, sets `Payment.status='confirmed'`, sets `Account.subscription_until = max(now, current_until) + 30 days`
  7. Frontend polls `/me/subscription` (or uses SSE) → user sees "Extended to [date]"

  **Payment flow — manual (fallback, ~5% of renewals):**
  - Customer pays via direct bank transfer or QRIS to the founder's personal account
  - Founder goes to `/admin/accounts/:id` → "Add manual payment" → enters amount, gateway='manual', note (e.g. "BCA transfer 24 May, ref XYZ")
  - Same extension logic runs as automated path
  - Used for: bank-transfer-loyalists, founding-rate edge cases, gateway outages, comps to friends

  **Payment gateway choice: Tripay over Xendit/Midtrans for early stage:**
  - Lowest KYC barrier (individual sign-up possible without registered business)
  - Supports the right payment methods for Indonesian SMB: QRIS, virtual accounts (BCA / Mandiri / BNI / BRI), e-wallets (GoPay, OVO, Dana, ShopeePay)
  - Simple REST API, well-documented webhook with HMAC signing
  - Migrate to Xendit Recurring once founder is registered as PT/CV and volume justifies it

  **Customer-facing API endpoints:**
  - `GET /me/subscription` — current status, days remaining, next renewal action
  - `POST /me/subscription/initiate-payment` — creates Tripay payment, returns checkout info
  - `GET /me/subscription/payments` — payment history for this account

  **Admin API endpoints (gated by `is_platform_admin`):**
  - `GET /admin/accounts` — all customers with subscription status, filter by status
  - `GET /admin/accounts/:id` — detail: subscription history + payment ledger
  - `POST /admin/accounts/:id/extend` — manual extend by N days, requires reason
  - `POST /admin/accounts/:id/suspend` — force suspend regardless of date
  - `POST /admin/accounts/:id/comp` — flip to comp status (free)
  - `POST /admin/accounts/:id/change-tier` — toggle founding ↔ standard
  - `POST /admin/payments/manual` — record an external payment (bank transfer, etc.)
  - `POST /admin/payments/:id/reconcile` — mark a pending Tripay payment as confirmed when webhook fails
  - `GET /admin/metrics` — MRR, active count, grace count, lapsed count, churn this month
  - `GET /admin/audit` — every admin action with timestamp + reason

  **Webhook endpoint:**
  - `POST /webhooks/tripay` — signature-verified, idempotent via WebhookEvent table, updates Payment + Account, returns 200

  **Admin UX (in the same app, separate routes, not a separate VPS):**
  - `/admin` — dashboard with the metrics above
  - `/admin/accounts` — sortable table of all customers
  - `/admin/accounts/:id` — detail view with timeline of subscription changes + payment history + manual action buttons
  - `/admin/payments` — full payment ledger across accounts
  - `/admin/payments/pending` — payments initiated but not yet confirmed (for manual reconcile when needed)
  - `/admin/audit` — log of every admin action

  **Customer UX:**
  - **Renewal banner** — shown when `subscription_until - now < 7 days` OR status='grace'. Reads expiry date + days remaining, has "Renew (Rp [tier price])" CTA
  - **Lockout page (`/renew`)** — friendly copy, big "Pay now" via Tripay, alternative manual transfer instructions, WhatsApp "Need help" button
  - **Payment success page** — confirmation + new expiry date + receipt link

  **Email notifications (via Resend or Postmark):**
  - 7 days before expiry → friendly reminder
  - On payment confirmed → receipt (informal, not a formal kuitansi unless requested separately)
  - At day 0 expired → grace-period notice
  - At day 14 expired → final notice before full lockout
  - Admin manual action → optional customer notification

  **Edge cases (handle explicitly):**
  - **Double payment**: customer accidentally pays twice → both extend by 30 days (they get 60). Show alert in admin, don't auto-refund.
  - **Early renewal**: customer renews 10 days before expiry → extends from current `subscription_until`, not from `now`. They get the full month they paid for.
  - **Webhook delivery failure**: Tripay retries for 24h. If still missing, customer pings founder → founder checks Tripay dashboard → uses `POST /admin/payments/:id/reconcile`.
  - **Customer disputes / refund**: Tripay processes refund → founder manually decrements `subscription_until` via `/admin/accounts/:id` with refund note.
  - **Cancellation**: no auto-billing to cancel since not using card-on-file. Customer just stops renewing. Account lapses naturally after grace period.
  - **Data retention after lapse**: keep all data forever for first 90 days lapsed. Soft-archive (data preserved, login disabled) after 90 days. Optional hard-delete after 365 days with prior email warning.
  - **Gateway outage**: show maintenance banner on renewal page, instruct customer to use manual transfer fallback or wait.

  **Operational concerns:**
  - **Backups**: daily `pg_dump` including Payment + WebhookEvent + Account history. Payment rows are immutable and must never be lost.
  - **Audit log**: every admin action records timestamp + acting admin + target account + action + reason. Append-only.
  - **Data export**: every customer can `GET /me/export` to download all their data (orders, products, ingredients, expenses) as XLSX before subscription lapses. Indonesian UU PDP compliance starting point.
  - **Receipts / kuitansi**: small F&B customers occasionally want a formal kuitansi for accounting. Out of scope for v1; flag for v2.

  **Effort estimate (after auth + multi-tenancy lands):**
  - Subscription data model + middleware + admin panel core → ~1 week
  - Tripay integration + webhook handler + idempotency → ~3–5 days
  - Renewal UX (banner + flow + lockout pages) → ~2–3 days
  - Email notification system → ~2 days
  - Testing + edge case coverage → ~1 week
  - **Total subscription-layer work: ~4 weeks of focused build**, on top of the ~2–4 weeks needed for auth + multi-tenancy first.

  **Founding-cohort transition plan:**
  - Phase 1 launches with Tripay one-shot + manual admin fallback (this spec)
  - Phase 2 (later, after volume): add Xendit Recurring with card-on-file for customers who prefer it. Manual admin path stays as the perennial fallback.

- **Positioning broadened: small F&B (not coffee-only).** Crema started life as "coffee shop ERP" — that framing is now retired. The product is positioned for **small food & beverage businesses generally** (warung, café, bakery, juice bar, kiosk, food cart, etc.). The recipe → ingredient → order data model is generic; only the seed data (Espresso / Latte / Cappuccino + Coffee Beans / Milk / Cup) reflects a café example, and that's preserved as a concrete illustration of how recipes work — not a positioning statement. Updated: `README.md` title + lead, `CLAUDE.md` title + lead, this file's earlier "Indonesian café" mention. Untouched (deliberately): the tour script, seed-fixture product names, the user-flow journey illustrations — all of those use the café example because it's the simplest concrete demo of the recipe model.

- **XLSX export reframed — financial-statement style with 4 sheets.** Rebuilt `/reports/export`:
  - **Sheet 1 — Summary**: P&L waterfall (Revenue → less Ingredient cost → Gross profit → less Operating expenses → **Net Profit**). Accounting convention throughout — subtraction lines are stored as negative numbers with format `"Rp "#,##0;"Rp "(#,##0)` so they render in parentheses, thin top-rule under each subtotal, double-rule under Net Profit. Below the waterfall: Orders placed + ROI on net (`netProfit / (ingredients + expenses)`), then three Top-5 sections (Products, Expense Categories, Ingredients) each with a "see X tab for full detail →" footer when more rows exist.
  - **Sheet 2 — Orders**: every line item (Order ID, Date, Product, Qty, Unit Price, Line Total, Ingredient Cost, Line Profit). Audit trail.
  - **Sheet 3 — Ingredient Usage**: full per-ingredient breakdown sorted by total cost, with a Total row.
  - **Sheet 4 — Expenses (NEW)**: by-category summary at top (Category | Entries | Total) with a Total row, then the chronological journal (Date | Category | Amount | Note) below.
  - **Branding deprioritized**: Calibri throughout (no Instrument Serif fallback chase), deep charcoal `#0F172A` for headers, warm gold `#B45309` accent ONLY on Net Profit (turns red `#DC2626` if negative) and the "CREMA" wordmark. Body text black. Subtle zebra striping `#F8FAFC` on Orders and Ingredient Usage tables.
  - **Layout**: `showGridLines: false` on all sheets, right-aligned currency columns, mono micro-cap section headers.
  - **Picked Style 2 of 5 proposed mockups** because the audience for an exported PDF/spreadsheet is often investors or partners — the universally-recognized accounting waterfall earns more credibility than design-led layouts (Editorial / Bold / Receipt). See conversation history for the other four design proposals; reframe is reversible from one section of `routes/index.js`.

- **Dev panel — "Fill Orders" renamed to "Fill Data", expense generation added.** The dev endpoint `/dev/fill-month` is now `/dev/fill-data` (frontend method renamed to `api.fillData`). On top of the existing month-of-random-orders, it also generates a realistic batch of operating expense entries (~10–25 per month). Tuned for a small/growing Indonesian F&B business (warung, café, kiosk, food cart) — totals land Rp 3M–8M/month, not big-shop budgets. Inconsistencies built in: 30% chance Rent is skipped (home-based), 50% chance of zero Salary entries (owner-only), 10% skip rate on other "stable" categories, amounts jittered to non-round figures rounded to nearest Rp 500, ~40% of entries left without notes, ~20% of Miscellaneous entries are larger one-off events. Notes use Indonesian-flavored copy (`PLN bulan ini`, `Refill tabung 12kg`, `Indihome paket basic`, `Gaji Andi`, etc).

- **Operating expenses — journal model, no auto-anything.** Added a new top-level Expenses tab between Inventory and Reports, plus an `ExpenseEntry` table (`id, date, category, amount, note?, createdAt, updatedAt`). Designed deliberately as a *journal* — every entry is an explicit user input, never carried forward, never materialized for "future months", never inferred from a saved default.
  - **Why no defaults / auto-carry.** Real overhead amounts vary every period (busier months draw more electricity; delivery distance changes; transport gets renegotiated). A saved default would mislead more often than help. The user is willing to pay the UX cost of re-typing to keep the data honest.
  - **Soft nudge only**: a `Last entered: Rp X` ghost placeholder per category, sourced from `localStorage['crema.expense-last:<Category>']`. Updated on every successful add. The input itself stays empty — the placeholder just spares the user from looking up last month's bill.
  - **Categories are a fixed enum** (`Electricity`, `Water`, `Gas`, `Internet`, `Rent`, `Salary`, `Delivery`, `Transport`, `Packaging`, `Miscellaneous`). Validated server-side in `expenseController.js` and mirrored in `Expenses.jsx`. Adding/removing a category requires a code change in both places. The `Miscellaneous` bucket catches anything that doesn't fit. Custom categories are deliberately out of scope for v1.
  - **Reports integration**: a read-only "Operating expenses" KPI card showing the sum for the active date range (the grid expanded from 4 to 5 columns). **Profit and ROI are net** — Profit = Revenue − Ingredient cost − Operating expenses; ROI = Profit / (Ingredient cost + Operating expenses). (Earlier in the design we picked R2 — no net-profit math — but a follow-up call moved this to net since the headline Profit number was overstating reality once expense data was being captured.) Per-product profit in the donut chart stays gross since overhead doesn't allocate cleanly per product.
  - **XLSX export deliberately deferred.** No "Expenses" sheet in the current export. The XLSX format is going to be reframed wholesale by the user — adding a half-baked sheet now would be thrown out. The expense data is fully available via `GET /expenses?from=&to=&category=`, so the future XLSX has everything it needs.
  - **Dev**: `/dev/reset` wipes the expenses table along with the rest. No seed-expenses fixture in v1.
  - **Scope expansion**: `CLAUDE.md` updated to add the Expenses model, API routes, and the Expenses + Reports page descriptions. The Hard Constraints section was not loosened — this is an additive feature, not a relaxation.

- **Dashboard onboarding placement — hero takeover + slim banner.** The earlier design rendered two stacked sections above the hero (tour invitation + Getting Started checklist), pushing the pulse number below the fold for any user with even partial setup. Replaced with three data-derived states that share the hero region:
  - **Fully empty** → `WelcomeHero` *replaces* the pulse hero. "Get your shop ready" headline, 3-row checklist inline, dev-only "Start tour / Skip" footer.
  - **Partial** (1–2 of 3 categories done) → slim `SetupBanner` (one-row chip) sits *above* the regular `PulseHero`. Reads `Setup · N/3 — [next step] →` and links to the first uncompleted category.
  - **Done** → no onboarding chrome at all; just the pulse hero and the rest of the dashboard.
  - The previous standalone Tour invitation card and Getting Started panel are gone — both absorbed into the WelcomeHero. Tour dismiss/start still uses `localStorage['crema.tour-dismissed']` so a dev user's choice persists across reloads. `data-tour="dashboard-pulse"` is preserved on whichever hero variant renders. Spec updated in `CLAUDE.md` Onboarding + Onboarding tour sections.

## Future ideas (NOT in scope for v1)

- Per-ingredient low-stock thresholds (different floor for cups vs. milk).
- Authentication.
- Receipt printing.
- Cost-of-goods / margin reporting.
- Daily/weekly sales chart.
- Soft-delete / archival for products and ingredients.
- Bulk stock receive (delta + supplier).
- **Historical data viewing** — orders are stored with timestamps so no data is lost, but the UI (including the monthly sales chart) only shows the current month and resets when a new month begins. There's no in-app way to browse, filter, or compare past months. The export feature partially covers this (any date range), but a month/date-range picker on the Reports page would make historical analysis accessible without downloading spreadsheets.
- **Product modifiers / customizations** — the recipe-based inventory system assumes fixed ingredient quantities per product (e.g. every Latte = 150ml milk). In practice, customers request less ice, less sugar, extra shots, etc. The selling price stays the same but actual ingredient usage differs from the recipe. Over many orders this causes drift between recorded and actual stock levels. Most small F&B shops handle this with periodic physical stock counts and reconciliation. A full modifier system would require changes to the data model (modifier definitions, per-order-item overrides) and the order flow — significant complexity for a v1.
