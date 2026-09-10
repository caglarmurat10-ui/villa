// src/middleware.ts VE custom-worker.mjs'in PUBLIC_API_PATH_PREFIXES dizileri bağımsız kopyalar
// (custom-worker.mjs "@/" alias çözemediği için middleware.ts'i import edemez) - villa detay
// sayfasındaki gerçek tanıtım videosu (/api/media/drive/[fileId]) public host'ta (safiradestan.com)
// çalışabilsin diye ikisine de eklendi. Senkron kaybolursa video sessizce 404 verir.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

describe("Public villa video embed route kablolaması (/api/media/drive/)", () => {
  it("middleware.ts'in PUBLIC_API_PATH_PREFIXES dizisi /api/media/drive/ içerir", () => {
    const source = readFileSync(resolve(ROOT, "src", "middleware.ts"), "utf-8");
    expect(source).toMatch(/PUBLIC_API_PATH_PREFIXES\s*=\s*\[[^\]]*"\/api\/media\/drive\/"/);
  });

  it("custom-worker.mjs'in PUBLIC_API_PATH_PREFIXES dizisi /api/media/drive/ içerir", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toMatch(/PUBLIC_API_PATH_PREFIXES\s*=\s*\[[^\]]*"\/api\/media\/drive\/"/);
  });
});
