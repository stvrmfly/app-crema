# Crema

Minimal ERP for small F&B businesses: recipe-based inventory, simple POS, automatic stock deduction. Sample data uses a café (Espresso / Latte / Cappuccino) but the model fits any small F&B operation — warung, bakery, juice bar, kiosk, food cart.

## Prerequisites

- **Node.js 20+** (run `node -v` to check)
- **PostgreSQL 16** running locally on port 5432

If Postgres isn't installed (macOS):

```bash
brew install postgresql@16
brew services start postgresql@16
```

Then create the database:

```bash
createdb coffeeshop
```

## Quickstart

```bash
git clone https://github.com/stvrmfly/app-crema.git
cd app-crema
npm install            # installs concurrently for the root dev script
npm run setup          # copies .env.example → .env, installs both subdirs, runs migrations, seeds data
```

If your Postgres user isn't your macOS username, edit `backend/.env` before running `setup` (or re-run `npm run db:setup` after editing).

Then start both servers with one command:

```bash
npm run dev            # backend on :3001, frontend on :5173
```

Open http://localhost:5173.

### Root scripts

| Script | What it does |
| --- | --- |
| `npm run setup` | Full first-time setup: `.env`, install, migrate, seed |
| `npm run dev` | Run backend + frontend together (Ctrl+C stops both) |
| `npm run dev:backend` / `npm run dev:frontend` | Run just one side |
| `npm run install:all` | Install dependencies for both subdirs |
| `npm run db:setup` | Re-run Prisma migrate + seed only |
| `npm run env:init` | Copy `backend/.env.example` → `backend/.env` if missing |
| `npm run build` | Production build of the frontend |
| `npm run start` | Run the backend without `--watch` (production-style) |

## API

### Resources

| Method | Path                | Body                                                                       | Description                                    |
| ------ | ------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| GET    | `/products`         | —                                                                          | List products with recipes                     |
| POST   | `/products`         | `{ name, price, recipe: [{ ingredientId, quantityRequired }] }`            | Create product + recipes (single transaction)  |
| PATCH  | `/products/:id`     | `{ name?, price?, recipe? }`                                               | Update product / recipe                        |
| DELETE | `/products/:id`     | —                                                                          | Blocked if the product has existing orders     |
| GET    | `/ingredients`      | —                                                                          | List ingredients                               |
| POST   | `/ingredients`      | `{ name, unit, stockQuantity, costPerUnit?, lowStockThreshold? }`          | Create ingredient                              |
| PATCH  | `/ingredients/:id`  | `{ stockQuantity, lowStockThreshold?, costPerUnit? }`                      | Absolute set (not delta)                       |
| DELETE | `/ingredients/:id`  | —                                                                          | Delete ingredient                              |
| GET    | `/orders`           | —                                                                          | List orders, newest first                      |
| POST   | `/orders`           | `{ items: [{ productId, quantity }] }`                                     | Place order, auto-deduct stock                 |
| DELETE | `/orders/:id`       | —                                                                          | Void order (restores stock)                    |
| GET    | `/expenses`         | query: `from`, `to`, `category` (all optional)                             | List expense journal entries, newest first    |
| POST   | `/expenses`         | `{ date, category, amount, note? }`                                        | Add a journal entry                            |
| PATCH  | `/expenses/:id`     | `{ date?, category?, amount?, note? }`                                     | Partial update                                 |
| DELETE | `/expenses/:id`     | —                                                                          | Hard delete                                    |

### Reports

| Method | Path                       | Query                                       | Description                                            |
| ------ | -------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| GET    | `/reports/monthly-sales`   | `from`, `to` (optional; defaults to WIB MTD)| Daily revenue + order count + summary                  |
| GET    | `/reports/export`          | `from`, `to`                                | XLSX download (Summary, Orders, Ingredient Usage, Expenses) |
| GET    | `/reports/earliest-order`  | —                                           | WIB date of the oldest order (for "All Time" preset)   |

### Dev (gated by `NODE_ENV !== 'production'`)

| Method | Path                | Description                                                  |
| ------ | ------------------- | ------------------------------------------------------------ |
| DELETE | `/dev/reset`        | Wipe all data, reset auto-increment sequences                |
| POST   | `/dev/seed`         | Load Espresso / Latte / Cappuccino + 3 ingredients           |
| POST   | `/dev/seed-full`    | Load a larger catalog beyond the three defaults              |
| POST   | `/dev/drain-stock`  | Force all ingredient stocks to zero                          |
| POST   | `/dev/refill-stock` | Restore ingredient stocks to seed quantities                 |
| POST   | `/dev/fill-data`    | `?month=YYYY-MM` — generate random orders + expenses for the month |

`unit` ∈ `'g' | 'ml' | 'pcs'`. All money fields are integers (Indonesian Rupiah).

### Order behavior

`POST /orders` runs in a single Prisma `$transaction` (Serializable isolation):

1. Sum required ingredients across all line items.
2. If any ingredient is short → respond `400` with `{ error, shortages: [...] }` and abort. Stock unchanged.
3. Otherwise decrement stock, snapshot current product prices into `OrderItem.unitPrice` and computed ingredient cost into `OrderItem.ingredientCost`, create the `Order`.
4. Products without a recipe are allowed — the sale goes through without deducting anything.

## Pages

The app lives under the `/app` prefix; `/` is the cosmetic landing page.

- `/app` — Dashboard: hero pulse card with order count + delta, KPI row (revenue / AOV / items), low-stock attention panel, data-derived onboarding states (WelcomeHero / SetupBanner), dev tools.
- `/app/orders` — POS: pick products, build a cart, submit. Shortage details render inline on 400. Sticky cart on desktop, sticky-bottom summary on mobile. Collapsible order history.
- `/app/products` — Product table (desktop) / cards (mobile) with inline-editable prices, recipe chips, add / edit / delete modals, quick-add ingredient from within the product modal.
- `/app/inventory` — Ingredient list with inline-editable stock (auto-saves on blur), threshold, cost. Low-stock rows tinted.
- `/app/expenses` — Operating-expense journal with add-entry form, date-range + category filters, range total, edit / delete per row. Strict journal — no defaults, no auto-carry.
- `/app/reports` — 5 KPI cards (Revenue / Ingredient cost / Operating expenses / Profit / ROI), monthly sales chart, product-mix donut, ingredient costs table, XLSX export with a 4-sheet financial-statement layout.

## Stack

- Backend: Node 20 + Express 4 + Prisma 6 + PostgreSQL 16
- Frontend: Vite + React 19 + Tailwind v3 (PostCSS) + React Router DOM v7
- XLSX export: ExcelJS
- HTTP client: native `fetch`
- No auth, no tests, no Docker (per `CLAUDE.md` hard constraints)

See [DECISIONS.md](DECISIONS.md) for small judgment calls made during the build, and [docs/BRAND.md](docs/BRAND.md) for the full design system. The user-flow map lives at [docs/user-flow.html](docs/user-flow.html).
