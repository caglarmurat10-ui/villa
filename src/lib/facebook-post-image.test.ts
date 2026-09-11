import { afterEach, describe, expect, it, vi } from "vitest";
import { publishFacebookPost } from "./facebook";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

describe("publishFacebookPost image upload", () => {
  it("görsel URL'sini Worker indirir ve Meta /photos'a source Blob olarak yükler", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      calls.push({ url, init });
      if (url === "https://admin.safiradestan.com/api/public/social-assets/safira_special-day_2026-09-11/feed") {
        return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "Content-Type": "image/png" } });
      }
      const form = init?.body as FormData;
      expect(form).toBeInstanceOf(FormData);
      expect(form.get("caption")).toBe("Hayırlı Cumalar");
      expect(form.get("published")).toBe("true");
      expect(form.get("source")).toBeInstanceOf(Blob);
      expect(form.get("url")).toBeNull();
      expect(init?.headers).toBeUndefined();
      return Response.json({ id: "photo_123", post_id: "page_1_123" });
    }) as typeof fetch;

    await expect(publishFacebookPost(
      "page_1",
      "secret-token",
      "Hayırlı Cumalar",
      "https://admin.safiradestan.com/api/public/social-assets/safira_special-day_2026-09-11/feed",
    )).resolves.toBe("page_1_123");
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain("/page_1/photos");
  });

  it("metin-only paylaşımı eski /feed akışını korur", async () => {
    globalThis.fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.body).toBeInstanceOf(URLSearchParams);
      return Response.json({ id: "feed_123" });
    }) as typeof fetch;
    await expect(publishFacebookPost("page_1", "secret-token", "Merhaba")).resolves.toBe("feed_123");
  });
});
