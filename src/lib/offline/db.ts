import Dexie, { type Table } from "dexie";

export type QueuedSale = {
  key: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

class PosOfflineDatabase extends Dexie {
  queuedSales!: Table<QueuedSale, string>;

  constructor() {
    super("bakery_pos_offline");
    this.version(1).stores({ queuedSales: "key, createdAt" });
  }
}

let instance: PosOfflineDatabase | null = null;
function getDb() {
  if (!instance) instance = new PosOfflineDatabase();
  return instance;
}

export async function enqueueSale(payload: Record<string, unknown>, key: string) {
  await getDb().queuedSales.put({ key, payload, createdAt: new Date().toISOString(), attempts: 0 });
}

export async function listQueuedSales() {
  return getDb().queuedSales.orderBy("createdAt").toArray();
}

export async function removeQueuedSale(key: string) {
  await getDb().queuedSales.delete(key);
}

export async function updateQueuedSale(key: string, patch: Partial<QueuedSale>) {
  await getDb().queuedSales.update(key, patch);
}
