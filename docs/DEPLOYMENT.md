# Deployment guide

## Production checklist

1. Provision PostgreSQL 14+ and create a dedicated database/user.
2. Set environment variables in the hosting platform. Never commit `.env.local`.
3. Generate a strong `AUTH_SECRET`:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
4. Set `NEXT_PUBLIC_APP_URL` to the public HTTPS origin.
5. Run migrations with `npm run db:deploy`. Do **not** use `db:reset:dev` or `prisma migrate reset` in production.
6. Create the first OWNER user and tenant by running the seed only in a fresh non-production database, or provision them through an approved administrative process.
7. Run `npm run build`, then `npm start` (or deploy the build output to a Node 22+ runtime).
8. Verify `/login`, `/`, `/pos`, `/reports` and a low-risk read API after deployment.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Session/cookie signing material |
| `NEXT_PUBLIC_APP_URL` | Yes | Public origin used by links |
| `LOG_LEVEL` | No | `info` by default; `debug` for troubleshooting |
| `AI_PROVIDER` | No | Enables a remote provider when implemented |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | No | Remote AI provider configuration |
| `UPLOAD_DIR` | No | Local attachment storage path |

## Backups

- Use `pg_dump` for logical backups and restore into a new database before applying a forward migration.
- Journal entries, stock movements and audit records are append-only. Reversals are compensating records; never delete historical rows.
- Test a restore before every production migration.

## Operational notes

- Sessions are stored in the database and cookies use `httpOnly`, `sameSite=lax`, and `secure` when `NODE_ENV=production`.
- Branch restrictions come from the server-side auth context. A user with no explicit branch access sees all branches; a user with one or more branch assignments is limited to those branches.
- The deterministic AI provider requires no external network calls.
