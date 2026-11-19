/** Converts Prisma Decimal/BigInt/Date values into JSON-safe values for API responses. */
export function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? Number(item) : item))) as T;
}
