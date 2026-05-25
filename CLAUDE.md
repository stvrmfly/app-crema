# Crema — small F&B ERP

A minimal, working ERP for small food & beverage businesses: recipe-based inventory, simple POS, automatic stock deduction, and basic financial reporting. The sample seed (Espresso / Latte / Cappuccino) reflects a café use case, but the underlying recipe → ingredient → order model is generic enough for any small F&B operation (warung, bakery, juice bar, food cart, kiosk, etc.).

**Correctness of business logic matters more than UI polish.** Scope is fixed — do not add features beyond what is in this file.

---

## Hard constraints

- No real authentication, no user accounts, no roles. The landing page (`LoginPage`, `RegisterPage`) is cosmetic only — it does not call any auth backend, and clicking "Sign in" simply navigates into `/app`.
- No Docker, no CI, no automated tests unless explicitly asked.
- No TypeScript on the frontend (plain JSX).
- No state-management library (React `useState` / `useEffect` only).
- HTTP client: native `fetch` — do not install axios.
- If any small decision is ambiguous (ports, seed values, threshold numbers), pick a sensible default and log it in `DECISIONS.md` at the repo root. Do not stop to ask.

---

## Stack (exact versions)

- Node 20+
- Frontend: Vite + React 19, React Router DOM v7 for client-side routing
- Backend: Express **4** (not 5) + Prisma 6 (not 7 — v7 requires separate `prisma.config.ts`) + PostgreSQL
- Styling: Tailwind CSS **v3** via PostCSS — **not v4**
- XLSX export: ExcelJS
- Default ports: backend `3001`, frontend `5173`, Postgres `5432`.

---

## Folder layout

```
/backend
  /src
    /routes/index.js   # all routes in one file (resource + reports + dev)
    /controllers       # productController, ingredientController, orderController, recipeController
    /services          # orderService.js — order transaction logic
    /prisma.js         # shared PrismaClient instance
    server.js
  /prisma
    schema.prisma
    seed.js
  .env.example
  package.json
/frontend
  /src
    /pages             # Dashboard.jsx, Orders.jsx, Products.jsx, Inventory.jsx, Reports.jsx
    /components        # NavBar, Modal, AnimatedNumber, Skeleton, MonthlySalesChart, ProductMixChart
    /services          # api.js — ALL fetch calls live here, nothing scattered in pages
    App.jsx
    main.jsx
    index.css
  tailwind.config.js
  package.json
README.md
DECISIONS.md
```

---

## Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Product {
  id         Int         @id @default(autoincrement())
  name       String
  price      Decimal     @db.Decimal(10, 2)
  recipes    Recipe[]
  orderItems OrderItem[]
  createdAt  DateTime    @default(now())
}

model Ingredient {
  id                Int      @id @default(autoincrement())
  name              String
  unit              String   // 'g' | 'ml' | 'pcs'
  stockQuantity     Decimal  @db.Decimal(10, 2)
  costPerUnit       Decimal? @db.Decimal(10, 2)
  lowStockThreshold Decimal  @default(100) @db.Decimal(10, 2)
  recipes           Recipe[]
}

model Recipe {
  id               Int        @id @default(autoincrement())
  product          Product    @relation(fields: [productId], references: [id])
  productId        Int
  ingredient       Ingredient @relation(fields: [ingredientId], references: [id])
  ingredientId     Int
  quantityRequired Decimal    @db.Decimal(10, 2)

  @@unique([productId, ingredientId])
}

model Order {
  id        Int         @id @default(autoincrement())
  total     Decimal     @db.Decimal(10, 2)
  items     OrderItem[]
  createdAt DateTime    @default(now())
}

model OrderItem {
  id             Int      @id @default(autoincrement())
  order          Order    @relation(fields: [orderId], references: [id])
  orderId        Int
  product        Product  @relation(fields: [productId], references: [id])
  productId      Int
  quantity       Int
  unitPrice      Decimal  @db.Decimal(10, 2)
  ingredientCost Decimal? @db.Decimal(10, 2)
}

model ExpenseEntry {
  id        Int      @id @default(autoincrement())
  date      DateTime
  category  String   // server-validated against EXPENSE_CATEGORIES enum (see below)
  amount    Decimal  @db.Decimal(10, 2)
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Expense categories (fixed enum, validated server-side):** `Electricity`, `Water`, `Gas`, `Internet`, `Rent`, `Salary`, `Delivery`, `Transport`, `Packaging`, `Miscellaneous`. Defined in `backend/src/controllers/expenseController.js` and mirrored in `frontend/src/pages/Expenses.jsx`. No custom categories — adding one requires a code change in both places.

---

## API

### Resource endpoints

| Method | Path               | Body                                                              | Notes                                              |
| ------ | ------------------ | ----------------------------------------------------------------- | -------------------------------------------------- |
| GET    | `/products`        | —                                                                 | include recipes with ingredient names              |
| POST   | `/products`        | `{ name, price, recipe: [{ ingredientId, quantityRequired }] }`   | create product + recipes in one transaction        |
| PATCH  | `/products/:id`    | `{ name?, price?, recipe? }`                                      | update product name/price/recipe                   |
| DELETE | `/products/:id`    | —                                                                 | blocked if product has existing orders              |
| GET    | `/ingredients`     | —                                                                 |                                                    |
| POST   | `/ingredients`     | `{ name, unit, stockQuantity, costPerUnit?, lowStockThreshold? }` |                                                    |
| PATCH  | `/ingredients/:id` | `{ stockQuantity, lowStockThreshold?, costPerUnit? }`             | absolute set, not delta. `costPerUnit: null` or `''` clears the value |
| DELETE | `/ingredients/:id` | —                                                                 |                                                    |
| GET    | `/orders`          | —                                                                 | include items + product names, newest first        |
| POST   | `/orders`          | `{ items: [{ productId, quantity }] }`                            | see Order Logic below                              |
| GET    | `/expenses`        | query: `from=YYYY-MM-DD&to=YYYY-MM-DD&category=<enum>` (all optional) | list expense entries, newest first              |
| POST   | `/expenses`        | `{ date, category, amount, note? }`                               | journal entry; category must be one of the fixed enum |
| PATCH  | `/expenses/:id`    | `{ date?, category?, amount?, note? }`                            | partial update                                     |
| DELETE | `/expenses/:id`    | —                                                                 | hard delete (no soft-delete in v1)                 |

### Report endpoints

| Method | Path                    | Query params               | Notes                                                    |
| ------ | ----------------------- | -------------------------- | -------------------------------------------------------- |
| GET    | `/reports/monthly-sales`  | `from=YYYY-MM-DD&to=YYYY-MM-DD` (optional, defaults to current WIB month-to-date) | daily breakdown + summary (totalRevenue, totalOrders, avgDailyRevenue, peakDay) |
| GET    | `/reports/export`         | `from=YYYY-MM-DD&to=YYYY-MM-DD` | XLSX download with 4 sheets: Summary (P&L waterfall + Top 5s), Orders, Ingredient Usage, Expenses |
| GET    | `/reports/earliest-order` | —                          | WIB date of the oldest order (for the "All Time" range preset) |

### Dev endpoints (gated by `NODE_ENV !== 'production'`)

| Method | Path                 | Notes                                                              |
| ------ | -------------------- | ------------------------------------------------------------------ |
| DELETE | `/dev/reset`         | wipe all data, reset auto-increment sequences                      |
| POST   | `/dev/seed`          | load default products (Espresso, Latte, Cappuccino)                |
| POST   | `/dev/seed-full`     | load a larger catalog beyond the three defaults                    |
| POST   | `/dev/drain-stock`   | force all ingredient stocks to zero (for empty-state testing)      |
| POST   | `/dev/refill-stock`  | restore ingredient stocks to their seed quantities                 |
| POST   | `/dev/fill-month`    | `?month=YYYY-MM` (optional) — generate random orders for the month |

All responses JSON. Errors: `{ error: string, ...details }` with appropriate 4xx status.

---

## Order Logic (the only non-trivial part — get this right)

On `POST /orders`, inside a single Prisma `$transaction` (Serializable isolation):

1. Load all referenced products with their recipes and ingredients.
2. Build a map `{ ingredientId -> totalRequired }` by summing `recipe.quantityRequired * item.quantity` across every item and every recipe line.
3. For every ingredient in the map, check `stockQuantity >= required`. If **any** ingredient is short, abort the transaction and return `400` with:
   ```json
   {
     "error": "Insufficient stock",
     "shortages": [
       { "ingredientId": 1, "name": "Milk", "required": 3000, "available": 2000, "unit": "ml" }
     ]
   }
   ```
4. Deduct stock for each ingredient (`update` with `decrement`).
5. Compute `total` from **current product prices on the server** — do not trust client-sent prices. Snapshot each product's price into `OrderItem.unitPrice`. Also snapshot the computed ingredient cost into `OrderItem.ingredientCost`.
6. Create the `Order` and its `OrderItem`s.
7. Return the created order with items and product names included.

Edge cases:

- Product has no recipe → allow the sale, deduct nothing.
- `quantity <= 0` or unknown `productId` → `400`.
- Empty `items` array → `400`.

This logic must live in `/backend/src/services/orderService.js`. The controller should be thin.

---

## Frontend

### Shell

The app lives under the `/app` prefix (`/app`, `/app/orders`, `/app/products`, `/app/inventory`, `/app/reports`). The root path `/` shows the cosmetic landing/login page.

Fixed left sidebar (`NavBar`) with five links (Dashboard, Orders, Products, Inventory, Reports). Sidebar is collapsible (wide: `w-60`, collapsed: `w-16`). Main content area is a fixed panel with `rounded-2xl` and padding. Keyboard navigation: Arrow keys or A/D to cycle between pages. Page transitions use a fade-up animation.

### Pages

1. **Dashboard** — total order count (animated big number card), and a list of ingredients where `stockQuantity < lowStockThreshold`. Each ingredient has its own configurable threshold. Dev tools section (Seed/Fill month/Reset buttons, non-production only). Inline restock modal for quick stock adjustments.
2. **Orders** — two columns. Left: list of products, each with `−` / quantity / `+` controls. Right: cart summary with line items, computed total, and a Submit button. On submit, if the server returns a 400 with `shortages`, render those inline above the cart with shake animation. On success, clear the cart and show an animated checkmark confirmation. Collapsible order history section below.
3. **Products** — table of existing products with inline-editable prices (input + Save button) and recipes shown as a comma-separated list. Modal form to add a new product: name, price, plus repeatable rows to add ingredient + `quantityRequired` pairs. Edit product modal. Delete product with confirmation modal. Quick-add ingredient from within the product modal.
4. **Inventory** — table of ingredients with name, unit, stock (inline-editable), low-stock threshold (inline-editable), and cost. Modal form to add a new ingredient. Delete ingredient with confirmation modal.
5. **Expenses** — journal of operating expense entries (electricity, transport, packaging, etc.). Top: add-entry form (date, category, amount, note). Below: filter row (date range + category) and entries list — table on `md+`, cards on mobile. Edit + delete actions per row. Range total at the bottom. **No defaults / no auto-carry / no per-period materialization** — every entry is an explicit user input. The amount field shows a `Last entered: Rp X` ghost placeholder per category (read from `localStorage['crema.expense-last:<Category>']`) but never auto-fills.
6. **Reports** — five summary cards (Revenue, Ingredient cost, Operating expenses, Profit, ROI). Monthly Sales line chart (SVG-based, showing daily revenue + order count). Product Mix donut chart (SVG-based, showing revenue breakdown by percentage). Ingredient Costs breakdown table sorted by total cost. Export button opens a modal with date range picker (Today / This month / Custom range), downloads as XLSX. **Profit is net**: Revenue − Ingredient cost − Operating expenses. **ROI is net** too: Profit / (Ingredient cost + Operating expenses). The Operating expenses card is read-only — editing happens on `/app/expenses`. Per-product profit in the donut chart stays gross (Revenue − Ingredient cost only) since overhead doesn't allocate cleanly to individual products.

### Components

- **NavBar** — fixed left sidebar, collapsible toggle, 6 nav links with active state (Dashboard, Orders, Products, Inventory, Expenses, Reports)
- **Modal** — reusable overlay with title, close button, Escape key support
- **AnimatedNumber** — animates number changes with easing
- **Skeleton** — shimmer loading placeholder
- **MonthlySalesChart** — SVG line chart for daily revenue + order count
- **ProductMixChart** — SVG donut chart for product revenue breakdown
- **AuthLayout** — wrapper shared by `LoginPage` / `RegisterPage` (cosmetic landing only)
- **Tour** — onboarding tour engine (see below)

### Onboarding

The Dashboard hero adapts to three data-derived states. The welcome takeover and the slim banner are both production-safe; only the embedded tour CTA is dev-gated.

- **Fully empty** (`ingredientCount === 0 && productCount === 0 && orderCount === 0`). The hero card itself becomes a **WelcomeHero**: "Get your shop ready" headline, the 3-row checklist inline, and a dev-only "Start tour / Skip" footer (gated by `TOUR_ENABLED` + `crema.tour-dismissed` in localStorage). Keeps the `data-tour="dashboard-pulse"` anchor.
- **Mid-setup** (at least one category > 0 but not all). A slim **SetupBanner** above the regular pulse hero, single row: `Setup · N/3 — [next-step label] →`. Links to whichever category is still 0.
- **Done** (all three > 0). No onboarding chrome — just the pulse hero, KPIs, and Needs Attention.

The standalone "Tour invitation" card and "Getting started" panel from the earlier design are gone — both functions are absorbed into the WelcomeHero. Tour dismiss/start still uses `localStorage['crema.tour-dismissed']` so once a dev user has chosen, the tour CTA never reappears.

### Onboarding tour

Interactive guided tour. Gated to dev builds (`import.meta.env.DEV`) so production users see only the data-derived onboarding states (WelcomeHero / SetupBanner) without the tour CTA.

- **Tour CTA** lives inside the WelcomeHero, visible only when *all* hold: `TOUR_ENABLED` is true, `localStorage['crema.tour-dismissed']` is unset, and the app is fully empty (no ingredients, products, or orders). Skip and Start both set the dismissed flag; the CTA never reappears.
- **Tour flow** (7 stops, action per stop): Welcome → Add Coffee Beans → Add Milk → Add Cups → Create Espresso → Place sample order → Reports. Each non-welcome stop has a `primaryLabel` button that calls the relevant API. Pre-filled values come from CLAUDE.md's seed table.
- **Mid-tour resume**: when the user exits the tour partway, the Dashboard checklist becomes interactive — clicking an unchecked row in dev calls `startTour(n)` with the computed first-incomplete step in that category, instead of plain navigation. Resume is data-derived (no saved index), so manual edits between sessions never desync.
- **Floating progress panel** (top-right, mounted inside `<Tour>`) shows live progress on Ingredients / Product / Sale. Disappears with the tour.
- **Cross-page data sync**: tour actions dispatch `crema:data-changed` on window; Dashboard/Inventory/Products/Orders/Reports all subscribe via `onDataChanged(load)` so freshly-created rows render immediately. `crema:tour-end` is also dispatched so Dashboard can refresh its counts.
- **localStorage key**: `crema.tour-dismissed`. Only sanctioned localStorage usage. Cleared by Dev Panel → Reset, re-offering the tour.
- **Error handling**: per-step. If an API call fails the tour shows the error inline in the tooltip and changes the primary button to `Retry`. No auto-advance.
- **Load-bearing `data-tour` attributes**: `inventory-table` (Inventory), `products-table` (Products), `orders-cart` (Orders), `reports-summary` (Reports), `dashboard-pulse` (Dashboard, currently unused by the interactive tour but kept for future steps). Refactors that remove these will downgrade the tour to centered tooltips but won't break it.
- **Soft revert**: flip `TOUR_ENABLED` to `false` in `components/Tour.jsx`. **Hard revert**: delete `Tour.jsx`, the `{/* TOUR: ... */}` blocks in `Dashboard.jsx`, the `data-tour` attributes, the `onDataChanged(load)` lines in the 4 pages, and this section.

### UI style — warm parchment aesthetic

Custom design token system via CSS variables in `index.css`, extended through `tailwind.config.js`. Uses Google Fonts (Plus Jakarta Sans for body, Instrument Serif for headings, JetBrains Mono for monospace).

**CSS variable tokens:**
- **Backgrounds:** `--bg-page` (warm parchment), `--bg-card` (white), `--bg-elevated`, `--bg-divider`
- **Text (ink):** `--ink-primary` (warm charcoal), `--ink-secondary`, `--ink-tertiary`
- **Accent:** `--accent` (caramel macchiato), `--accent-hover`, `--accent-soft`
- **Semantic:** `--success`, `--danger` with hover and soft variants

**Tailwind utility classes (mapped from CSS vars):**
- Colors: `text-ink`, `text-ink-secondary`, `bg-accent`, `bg-success`, `bg-danger`, etc.
- Fonts: `font-heading` (Instrument Serif), `font-mono` (JetBrains Mono)

**Surface treatments (defined in index.css):**
- `card-gradient` — subtle warm white→cream gradient for cards
- `surface-shell` — gradient for the main content panel
- `shadow-ambient`, `shadow-lifted`, `shadow-overlay` — layered warm shadow system

**Micro-interactions (defined in index.css):**
- `btn-press` — scale to 97% on active
- `card-interactive` — lift on hover with shadow transition
- `icon-btn` — scale to 108% on hover
- `row-hover` — subtle background highlight
- `animate-fade-in`, `animate-pop`, `animate-fade-up`, `animate-shake` — keyframe animations
- `skeleton` — shimmer loading animation
- All animations respect `prefers-reduced-motion: reduce`

**Shape:** `rounded-2xl`, generous spacing (`p-6`, `gap-6`, `space-y-4`)

---

## Seed data

- **Ingredients:**
  - Coffee Beans: `1000 g`, costPerUnit `150`, lowStockThreshold `200`
  - Milk: `2000 ml`, costPerUnit `30`, lowStockThreshold `500`
  - Cup: `50 pcs`, costPerUnit `500`, lowStockThreshold `10`
- **Products:**
  - Espresso (Rp 25,000) → 20 g beans + 1 cup
  - Latte (Rp 35,000) → 20 g beans + 150 ml milk + 1 cup
  - Cappuccino (Rp 32,000) → 20 g beans + 100 ml milk + 1 cup

---

## Stop conditions

Do not add features beyond what is documented here (no auth, no dark mode, no tests, no Dockerfile). If you think of something that "would be nice," put it in `DECISIONS.md` under a "Future ideas" section and move on.
