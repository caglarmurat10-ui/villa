export type AiD1Stage = "ai-config" | "ai-settings" | "ai-history" | "ai-suggestions" | "regional-ideas" | "usage";

const RETRY_DELAY_MS = 20;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function aiD1ErrorCode(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  if (message.includes("timeout") || message.includes("object to be reset") || message.includes("storage operation exceeded")) {
    return "timeout-reset";
  }
  if (message.includes("no such table") || message.includes("no such index")) return "missing-schema";
  if (message.includes("d1_error") || message.includes("sqlite")) return "d1-error";
  return "unknown";
}

export function isRetryableAiD1Read(error: unknown) {
  return aiD1ErrorCode(error) === "timeout-reset";
}

export function isInternalAiD1Error(error: unknown) {
  return aiD1ErrorCode(error) !== "unknown";
}

export async function readAiD1<T>(stage: AiD1Stage, operation: () => Promise<T>): Promise<T> {
  let attempts = 0;
  while (attempts < 2) {
    attempts += 1;
    try {
      return await operation();
    } catch (error) {
      if (attempts === 1 && isRetryableAiD1Read(error)) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      console.warn(JSON.stringify({ message: "ai d1 read failed", stage, code: aiD1ErrorCode(error), attempts }));
      throw error;
    }
  }
  throw new Error("AI verisi okunamadı.");
}

export function publicAiError(error: unknown, fallback: string) {
  if (isInternalAiD1Error(error)) return fallback;
  return error instanceof Error ? error.message : fallback;
}
