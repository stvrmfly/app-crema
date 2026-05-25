# Crema

Minimal ERP for small F&B businesses: recipe-based inventory, simple POS, automatic stock deduction. Sample data uses a café (Espresso / Latte / Cappuccino) but the model fits any small F&B operation — warung, bakery, juice bar, kiosk, food cart.

## Prerequisites

- Node.js 20+
- PostgreSQL 16 running locally on port 5432
- A database named `coffeeshop`

If Postgres isn't installed:

```bash
brew install postgresql@16
brew services start postgresql@16
createdb coffeeshop
```

## Setup

### Backend

```bash
cd backend
cp .env.example .env          # then edit DATABASE_URL with your Postgres user
npm install
npx prisma migrate dev        # creates tables
node prisma/seed.js           # seeds Espresso + Latte + 3 ingredients
npm run dev                   # starts on http://localhost:3001
```

`.env`:
```
DATABASE_URL="postgresql://YOUR_USER@localhost:5432/coffeeshop"
PORT=3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev                   # starts on http://localhost:5173
```

Open http://localhost:5173.

## API

| Method | Path               | Body                                                            | Description                              |
| ------ | ------------------ | --------------------------------------------------------------- | ---------------------------------------- |
| GET    | `/products`        | —                                                               | List products with recipes               |
| POST   | `/products`        | `{ name, price, recipe: [{ ingredientId, quantityRequired }] }` | Create product + recipes (transaction)   |
| GET    | `/ingredients`     | —                                                               | List ingredients                         |
| POST   | `/ingredients`     | `{ name, unit, stockQuantity, costPerUnit? }`                   | Create ingredient                        |
| PATCH  | `/ingredients/:id` | `{ stockQuantity }`                                             | Set stock quantity (absolute)            |
| POST   | `/recipes`         | `{ productId, ingredientId, quantityRequired }`                 | Upsert a recipe line                     |
| GET    | `/orders`          | —                                                               | List orders, newest first                |
| POST   | `/orders`          | `{ items: [{ productId, quantity }] }`                          | Place order, auto-deduct stock           |

`unit` ∈ `'g' | 'ml' | 'pcs'`. All money fields are integers (Rupiah).

### Order behavior

A `POST /orders` runs in a single Prisma transaction:

1. Sum required ingredients across all line items.
2. If any ingredient is short → respond `400` with `{ error, shortages: [...] }` and abort. Stock unchanged.
3. Otherwise decrement stock, snapshot current product prices into `OrderItem.unitPrice`, create the `Order`.
4. Products without a recipe are allowed — the sale goes through without deducting anything.

## Pages

- `/` — Dashboard: total order count + low-stock list (< 100 units).
- `/orders` — POS: pick products, build a cart, submit. Shortage details render inline on 400.
- `/products` — Product table + form to add a product with a multi-line recipe.
- `/inventory` — Ingredient table with inline-editable stock + form to add an ingredient.

## Stack

- Backend: Node 20 + Express 4 + Prisma 6 + PostgreSQL
- Frontend: Vite + React 18 + Tailwind v3 (PostCSS) + react-router-dom
- HTTP client: native `fetch`
- No auth, no tests, no Docker

See [DECISIONS.md](DECISIONS.md) for small judgment calls made during the build, and [docs/BRAND.md](docs/BRAND.md) for the full design system. The user-flow map lives at [docs/user-flow.html](docs/user-flow.html).
