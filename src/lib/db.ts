import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { bakeryPrisma?: PrismaClient };

function createPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    try {
      (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.(".env.local");
    } catch {
      // environment variables supplied by the deployment take precedence
    }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("[db] DATABASE_URL is not configured");
  const pool = new Pool({ connectionString: url, max: 12 });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: process.env.LOG_LEVEL === "debug" ? ["warn", "error"] : ["error"] });
}

export const db: PrismaClient = globalForDb.bakeryPrisma ?? createPrisma();
if (process.env.NODE_ENV !== "production") globalForDb.bakeryPrisma = db;

/** Opaque type for a Prisma client or an active transaction. */
export type Db = PrismaClient | Prisma.TransactionClient;
