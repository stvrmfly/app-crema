# Project Brief — Coffee Shop ERP

> Source of truth for project scope, stack, and boundaries.
> Claude Code must read this file at the start of every session.

---

## Quick Summary

| Field | Value |
|---|---|
| Product name | Coffee Shop ERP |
| What it does | Recipe-based inventory management with simple POS and automatic stock deduction |
| Primary user | Small coffee shop owner/barista |
| Stack | React 18 + Vite / Express 4 + Prisma / PostgreSQL |
| AI integration | No |
| Default mode | Light only |
| Current phase | Phase 1 — Backend Foundation |
| Last updated | 2026-05-05 |

---

## 1. Project Identity

| Field | Value |
|---|---|
| Product name | Coffee Shop ERP |
| Tagline | Minimal ERP for a small coffee shop |
| Client / Company | Internal tool — single-shop operation |
| Version | 1.0 |

---

## 2. What Is This?

A lightweight ERP system for a single coffee shop location. It manages ingredient inventory, product recipes (how much of each ingredient goes into each drink), and order processing. When an order is placed, the system automatically deducts ingredient stock based on recipes. It should feel simple, fast, and obvious — like a paper system that happens to be digital.

---

## 3. Users

| User type | Who they are | What they need most |
|---|---|---|
| Shop owner/barista | Single person running the shop | Place orders quickly, know when stock is low, manage menu items |

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS v3 (PostCSS) |
| Backend | Node.js 20+ + Express 4 |
| ORM | Prisma (latest) |
| Database | PostgreSQL |
| Hosting | Local development |
| Package manager | npm |
| HTTP client | Native `fetch` only |
| State management | React useState/useEffect only |

---

## 5. AI Integration

None. This is a pure CRUD application with transactional business logic.

---

## 6. Core Features

1. **Ingredient inventory** — track stock quantities (g, ml, pcs) with inline editing
2. **Product management** — create products with prices and multi-ingredient recipes
3. **Order processing** — select products + quantities, submit order, auto-deduct stock
4. **Stock validation** — reject orders when ingredients are insufficient, show shortages
5. **Dashboard** — total order count + low-stock ingredient alerts

**Out of scope for v1.0:**
- Authentication / user accounts / roles
- Analytics beyond order count + low-stock list
- Docker / CI / automated tests
- Dark mode / theme switching
- Print receipts / exports / charts
- Multi-location support
- Supplier management
- Cost/margin calculations

---

## 7. Pages / Screens

| Route | Page name | Purpose | Status |
|---|---|---|---|
| `/` | Dashboard | Order count (big number) + low-stock ingredient list | [ ] not started |
| `/orders` | Orders | POS interface — product list + cart + submit | [ ] not started |
| `/products` | Products | Product table with recipes + add product form | [ ] not started |
| `/inventory` | Inventory | Ingredient table with inline stock edit + add form | [ ] not started |

---

## 8. Data Model

**Product:**
- `id` — autoincrement
- `name` — string
- `price` — decimal (10,2) in Rupiah
- `recipes[]` — what ingredients it uses and how much

**Ingredient:**
- `id` — autoincrement
- `name` — string
- `unit` — 'g' | 'ml' | 'pcs'
- `stockQuantity` — decimal (10,2)
- `costPerUnit` — optional decimal

**Recipe (join table):**
- `productId` + `ingredientId` — unique pair
- `quantityRequired` — decimal

**Order:**
- `id` — autoincrement
- `total` — decimal (computed server-side from product prices)
- `items[]` — line items with quantity and snapshotted unitPrice
- `createdAt` — timestamp

---

## 9. API Endpoints

| Method | Path | Purpose | Built? |
|---|---|---|---|
| GET | `/products` | List products with recipes + ingredient names | [ ] |
| POST | `/products` | Create product + recipes in one transaction | [ ] |
| GET | `/ingredients` | List all ingredients | [ ] |
| POST | `/ingredients` | Create new ingredient | [ ] |
| PATCH | `/ingredients/:id` | Update stock quantity (absolute set) | [ ] |
| POST | `/recipes` | Upsert recipe (productId + ingredientId) | [ ] |
| GET | `/orders` | List orders with items + product names, newest first | [ ] |
| POST | `/orders` | Place order — validate stock, deduct, create | [ ] |

---

## 10. Design Direction

| Decision | Value |
|---|---|
| Default mode | Light only |
| Primary accent color | #92400e (amber-800) |
| Success color | #047857 (emerald-700) |
| Density | Spacious |
| Tone | Approachable, utilitarian, earthy |
| Reference branding file | `branding.md` in project root |

**Personality in one sentence:**
"Feels like a well-organized chalkboard menu — warm, clear, and no-nonsense."

---

## 11. Folder Structure

```
erp-coffeeshop/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/        ← orderService.js lives here
│   │   └── server.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           ← Dashboard, Orders, Products, Inventory
│   │   ├── components/      ← NavBar, Card, Button, etc.
│   │   ├── services/        ← api.js (ALL fetch calls)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   └── package.json
├── branding.md
├── project-template.md      ← this file
├── CLAUDE.md
├── DECISIONS.md
└── README.md
```

---

## 12. Reference Files

Claude Code must read these at the start of every session:

1. `CLAUDE.md` — hard constraints, build phases, exact schema, order logic
2. `branding.md` — design system, color tokens, component patterns
3. `project-template.md` — this file, for full project context

---

## 13. Known Risks & Open Questions

| Item | Type | Status |
|---|---|---|
| No auth — anyone on the network can place orders | Decision | ✅ resolved (out of scope for v1) |
| Currency is Rupiah (Rp) — format as integer, no decimals shown | Decision | ✅ resolved |
| Low-stock threshold hardcoded at 100 units | Decision | ✅ resolved (noted in DECISIONS.md) |
| PostgreSQL must be running locally | Prerequisite | ⚠️ user responsibility |

---

## 14. Notes & Constraints

- No authentication — the app is for a single trusted user on a local network
- Currency: Indonesian Rupiah (Rp). Prices stored as decimal but displayed as whole numbers (e.g., "Rp 25,000")
- All text in English
- No TypeScript on frontend — plain JSX only
- No state management libraries — useState/useEffect only
- No axios — native fetch only
- Ambiguous decisions go in DECISIONS.md, never block on asking
- Build phases must be completed in order (Backend → Orders → Frontend → README)
- Correctness of business logic (especially order stock deduction) matters more than UI polish
