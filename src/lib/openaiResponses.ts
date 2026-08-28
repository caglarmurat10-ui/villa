import type { D1Database } from "@cloudflare/workers-types";
import type { z } from "zod";
import {
  aiCircuitOpen,
  assertAiBudget,
  logAiUsage,
  recordAiServiceResult,
} from "./aiDb";
import { isPaidAiFallbackAllowed, requireOpenAiApiKey } from "./aiConfiguration";
import type { Villa } from "./types";

const RESPONSES_URL = "https://api.openai.com/v1/responses";

type ResponseSource = { url: string; title: string };
type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    action?: { sources?: Array<{ url?: string; title?: string }> };
    content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url?: string; title?: string }> }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
};

export type StructuredResponseResult<T> = {
  value: T;
  sources: ResponseSource[];
  model: string;
};

function outputText(response: OpenAiResponse) {
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("AI geçerli bir içerik döndürmedi.");
}

function safeHttps(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function responseSources(response: OpenAiResponse) {
  const sources = new Map<string, ResponseSource>();
  const add = (urlValue: unknown, titleValue: unknown) => {
    const url = safeHttps(urlValue);
    if (!url) return;
    sources.set(url, { url, title: typeof titleValue === "string" ? titleValue.slice(0, 240) : new URL(url).hostname });
  };
  for (const item of response.output ?? []) {
    for (const source of item.action?.sources ?? []) add(source.url, source.title);
    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) add(annotation.url, annotation.title);
    }
  }
  return [...sources.values()].slice(0, 12);
}

export async function callStructuredResponse<T>(input: {
  db: D1Database;
  env: CloudflareEnv;
  villa: Villa;
  operation: "text" | "research";
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  validator: z.ZodType<T>;
  system: string;
  prompt: string;
  webSearch?: boolean;
  fetcher?: typeof fetch;
}): Promise<StructuredResponseResult<T>> {
  if (!isPaidAiFallbackAllowed(input.env)) throw new Error("OpenAI ücretli alternatifi kapalı.");
  const service = input.operation === "research" ? "openai-web" : "openai-text";
  const model = input.env.OPENAI_TEXT_MODEL || "gpt-5.6-terra";
  const key = requireOpenAiApiKey(input.env);
  await assertAiBudget(input.db, input.villa, input.operation);
  if (await aiCircuitOpen(input.db, service)) {
    throw new Error("AI servisi geçici olarak dinlenmede. Mevcut şablonlar kullanılabilir.");
  }

  let units = 0;
  let success = false;
  try {
    const response = await (input.fetcher ?? fetch)(RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        instructions: input.system,
        input: input.prompt,
        text: { format: { type: "json_schema", name: input.schemaName, strict: true, schema: input.jsonSchema } },
        ...(input.webSearch ? { tools: [{ type: "web_search" }], tool_choice: "auto", max_tool_calls: 4,
          include: ["web_search_call.action.sources"] } : {}),
      }),
    });
    if (!response.ok) throw new Error("AI servisi isteği tamamlayamadı.");
    const raw = await response.json() as OpenAiResponse;
    units = raw.usage?.total_tokens ?? (raw.usage?.input_tokens ?? 0) + (raw.usage?.output_tokens ?? 0);
    let parsed: unknown;
    try { parsed = JSON.parse(outputText(raw)); }
    catch { throw new Error("AI çıktısı güvenli biçimde ayrıştırılamadı."); }
    const value = input.validator.parse(parsed);
    success = true;
    await recordAiServiceResult(input.db, service, true);
    return { value, sources: responseSources(raw), model };
  } catch (error) {
    await recordAiServiceResult(input.db, service, false);
    if (error instanceof Error && /yapılandırılmadı|limit|dinlenmede|geçerli|güvenli/.test(error.message)) throw error;
    throw new Error("AI servisine şu anda ulaşılamıyor. Hazır şablonlarla devam edebilirsiniz.");
  } finally {
    await logAiUsage(input.db, { service, operation: input.operation, model, villa: input.villa,
      estimatedUnits: units, success }).catch(() => undefined);
  }
}
