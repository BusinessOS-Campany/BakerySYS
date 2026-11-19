export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INSUFFICIENT_STOCK"
  | "INVALID_STATE"
  | "UNBALANCED_JOURNAL"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  INSUFFICIENT_STOCK: 409,
  INVALID_STATE: 409,
  UNBALANCED_JOURNAL: 500,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public messageAr: string = message,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
  get status(): number {
    return STATUS[this.code];
  }
}

export function errorPayload(error: AppError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      messageAr: error.messageAr,
      details: error.details ?? null,
    },
  };
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : "Unexpected error";
  return new AppError("INTERNAL", message, "حدث خطأ غير متوقع");
}
