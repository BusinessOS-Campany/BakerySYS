import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["password", "passwordHash", "authorization", "DATABASE_URL", "AI_API_KEY"],
});
