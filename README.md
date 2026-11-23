# BakerySYS

Production-oriented bakery management system built with Next.js 16, React 19, TypeScript, PostgreSQL and Prisma 7. It covers the operating cycle from purchasing and inventory through recipes, POS sales, customer balances, accounting and analytics.

The interface is bilingual (Arabic RTL / English LTR), permission-aware, and contains no hardcoded dashboard data — every number comes from PostgreSQL.

## Quick start

### Prerequisites

- Node.js 22+
- PostgreSQL 14+ (local or remote)
- npm 10+

### 1. Install and configure

```powershell
npm install
Copy-Item .env.example .env.local
```

Edit `.env.local` and set at minimum:

```dotenv
DATABASE_URL="postgresql://bakery:bakery_dev_2026@localhost:5432/bakerysys"
AUTH_SECRET="a-long-random-value"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Generate a secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### 2. Database

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
```

`db:seed` is idempotent and intended for development only. It creates the demo tenant, branches, chart of accounts, roles, users, ingredients, products, recipes, stock lots and an open cash session.

> Never run `db:reset:dev` against production data. Use `prisma migrate deploy` in production.

### 3. Run

```powershell
npm run dev
```

Open <http://localhost:3000>.

### Demo accounts

Quick local login: `admin` / `admin` (OWNER, full access). The stored email for this shortcut is `admin@bakery.local`.

Password for the other demo users: `Bakery@2026`

| Email | Role | Purpose |
| --- | --- | --- |
| `admin` | OWNER | Shortcut login with full access |
| `owner@goldencrust.demo` | OWNER | Full access to every module |
| `manager@goldencrust.demo` | GENERAL_MANAGER | Operations and reporting |
| `accountant@goldencrust.demo` | ACCOUNTANT | Accounting, expenses, reports |
| `storekeeper@goldencrust.demo` | STOREKEEPER | Inventory and purchasing |
| `cashier@goldencrust.demo` | CASHIER | POS and sales |

Demo tenant: `golden-crust`. The seeded cash session is intentionally left `OPEN` so reconciliation can be demonstrated.

## Operational workflows

| Area | Route | What it does |
| --- | --- | --- |
| Dashboard | `/` | Live KPIs, 14-day sales chart, low-stock alerts, quick actions |
| POS | `/pos` | Product search, cart, payments, offline queue, cash-session aware; cash disbursement (صرف الصندوق) from an open register |
| Sales | `/sales` | Invoice register, invoice detail, sales returns with reversing journals |
| Products/master data | `/products`, `/ingredients`, `/categories`, `/units`, `/customers`, `/warehouses`, `/branches`, `/accounts`, `/employees`, `/expense-categories` | Generic, permission-gated CRUD |
| Recipes | `/recipes` | Ingredient lines, costing snapshots, recalculation, new versions |
| Inventory | `/inventory` | Stock balances, FEFO lots, adjustments, counts, transfers, ledger |
| Purchasing | `/purchases` | Purchase orders, approvals, goods receipts, vendor payments |
| Accounting | `/accounting` | Manual journals, chart of accounts, compensating reversals |
| Expenses | `/expenses` | Expense posting and voiding |
| Reports | `/reports` | P&L metrics, product sales, trial balance, CSV export |
| AI insights | `/api/ai/insights` | Deterministic recommendations derived from real ERP data |
| Admin | `/users`, `/settings` | Users, roles, permissions, branches, tenant settings |

## Architecture

```
src/
├── app/
│   ├── (app)/                 # Authenticated application routes
│   ├── api/                   # Route handlers (all mutations go through services)
│   └── login, forgot-password
├── components/
│   ├── app/                   # Shell, sidebar, topbar
│   ├── pos/                   # POS client
│   ├── resources/             # Generic master-data CRUD
│   └── workflows/             # Specialized operational screens
├── lib/
│   ├── accounting/            # Journal posting, reversal, balances
│   ├── ai/                    # Provider-agnostic insight interface
│   ├── auth/                  # Sessions, password hashing, RBAC context
│   ├── inventory/             # FEFO stock movements, counts, transfers
│   ├── notifications/         # Low-stock alerts
│   ├── offline/               # Dexie offline queue
│   ├── purchasing/            # Orders, receipts, vendor payments
│   ├── recipes/               # Recipe versions and costing
│   ├── reports/               # Report aggregation
│   ├── sales/                 # Sales, refunds, cash reconciliation
│   └── http.ts                # Authentication/validation/idempotency boundary
└── generated/prisma           # Generated Prisma client (do not edit)
```

### Security rules

- Every API route calls `apiRoute`, which enforces authentication and a server-side permission code.
- Every business query includes `tenantId`. Branch-scoped roles are further restricted with `auth.branchId`, `auth.branchIds` and `assertBranchAccess`.
- Client-supplied role, tenant or branch data is never trusted.
- Financial changes use `db.$transaction` and immutable journal lines. Reversals create compensating entries; no financial record is deleted.
- Mutating endpoints support `Idempotency-Key`. Offline POS sync uses its queue key as the idempotency key.
- Stock consumption uses FEFO ordering and refuses overallocation.

### POS and refund posting rules

- Tender is posted in full. Amounts paid above the invoice total are credited to the Customer Advances account (`2100`) and, when a customer is attached, reduce that customer's receivable balance.
- A partial refund posts a return journal and restores stock but leaves the original sale journal intact. The original journal is reversed only when every sale item is fully refunded; the sale status moves to `REFUNDED` only at that point.
- Refund quantities are validated against quantities not already returned, so repeated or excessive refunds are rejected.

## Offline POS

`src/lib/offline/db.ts` stores queued sales in IndexedDB via Dexie. The POS enqueues a sale with a stable client-generated key. `/api/offline/sync` validates each queued payload with `saleSchema`, asserts branch access, and calls `createSale` with the queue key as the idempotency key. A repeated sync returns the original sale instead of posting twice.

## AI provider interface

`src/lib/ai/provider.ts` defines `AIProvider` with a `name` and `insights(input)`. The default `LocalInsightsProvider` is deterministic and works with no API keys. A remote OpenAI-compatible provider can be injected with `setAIProvider` without changing callers. Environment variables for a future remote provider are documented in `.env.example`.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Generate Prisma client and build for production |
| `npm start` | Start the production server on port 3000 |
| `npm run typecheck` | Generate Prisma client and run TypeScript validation |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest unit tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Create and apply a development migration |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Idempotent development seed |

## Testing

Unit tests cover pure business calculations (FEFO, unit conversion, recipe costing, journal balance, yields, payment balances), sale journal balancing with overpayment, the AI provider, POS sale schema validation and API serialization.

```powershell
npm test
npm run typecheck
npm run build
```

## Troubleshooting

- **`DATABASE_URL is not configured`** — create `.env.local` from `.env.example` and restart the dev server.
- **Login returns 500** — verify PostgreSQL is reachable and migrations have been applied with `npm run db:deploy`.
- **`P1001` / connection refused** — check the host, port and credentials in `DATABASE_URL`.
- **Sale creation fails with insufficient stock** — finished lots use FEFO; receive or produce stock before selling.
- **Offline sale duplicated** — confirm the queue key is stable; sync uses it as the idempotency key.

## Development notes

- The dashboard route is `/`, not `/dashboard`.
- Prisma client is generated to `src/generated/prisma`; import it as `@/generated/prisma/client`.
- Money and quantity columns use PostgreSQL `NUMERIC`, never floating point.
- All navigation is permission-filtered server-side and again in the UI.
- The repository is not a git repository; keep changes reviewed and backed up.
