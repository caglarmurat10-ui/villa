import { describe, expect, it, vi } from "vitest";
import { managedInstagramMediaKey } from "@/lib/instagramMedia";
import {
  MAX_SCHEDULE_ATTEMPTS,
  processScheduledQueue,
  scheduledRetryDecision,
  staleProcessingAction,
  type ScheduledInstagramPost,
} from "@/lib/instagramSchedule";
import { parseScheduleRequestBody } from "@/lib/instagramSchedule";
import { validateInstagramPublishInput } from "@/lib/instagramTypes";

const now = new Date("2026-08-24T10:00:00.000Z");

function post(
  overrides: Partial<ScheduledInstagramPost> = {},
): ScheduledInstagramPost {
  return {
    id: "schedule-1",
    villa: "Destan",
    type: "IMAGE",
    caption: "Deneme",
    mediaUrls: [
      "https://villa.example/api/meta/instagram/media/instagram-media/destan/a.jpg",
    ],
    shareToFeed: true,
    scheduledAt: "2026-08-24T09:00:00.000Z",
    timezone: "Europe/Istanbul",
    status: "scheduled",
    createdAt: "2026-08-24T08:00:00.000Z",
    updatedAt: "2026-08-24T08:00:00.000Z",
    publishedAt: null,
    instagramMediaId: null,
    attemptCount: 0,
    lastError: null,
    lockedAt: null,
    mediaCount: 1,
    nextAttemptAt: null,
    publishStartedAt: null,
    ...overrides,
  };
}

describe("planlama zamanı", () => {
  it("geçmiş zamanı reddeder", () => {
    expect(() =>
      parseScheduleRequestBody(
        {
          villa: "Destan",
          type: "IMAGE",
          mediaUrls: ["https://villa.example/media.jpg"],
          caption: "",
          shareToFeed: true,
          scheduledAt: "2026-08-24T12:59",
          timezone: "Europe/Istanbul",
        },
        now,
      ),
    ).toThrow("en az 2 dakika");
  });

  it("Europe/Istanbul yerel saatini UTC olarak kayda hazırlar", () => {
    const parsed = parseScheduleRequestBody(
      {
        villa: "Destan",
        type: "IMAGE",
        mediaUrls: ["https://villa.example/media.jpg"],
        caption: "",
        scheduledAt: "2026-08-24T13:30",
        timezone: "Europe/Istanbul",
      },
      now,
    );
    expect(parsed.scheduledAt.toISOString()).toBe("2026-08-24T10:30:00.000Z");
  });
});

describe("medya ve metin doğrulaması", () => {
  it("IMAGE için tam bir medya ister", () => {
    expect(() =>
      validateInstagramPublishInput(
        {
          villa: "Destan",
          type: "IMAGE",
          mediaUrls: [],
          caption: "Metin",
          shareToFeed: true,
        },
        { captionRequired: true },
      ),
    ).toThrow("tam 1 JPEG");
  });

  it("CAROUSEL için 2-10 medya kabul eder", () => {
    const base = {
      villa: "Destan" as const,
      type: "CAROUSEL" as const,
      caption: "Metin",
      shareToFeed: true,
    };
    expect(() =>
      validateInstagramPublishInput(
        { ...base, mediaUrls: ["1"] },
        { captionRequired: true },
      ),
    ).toThrow("2-10 JPEG");
    expect(() =>
      validateInstagramPublishInput(
        { ...base, mediaUrls: Array.from({ length: 10 }, (_, i) => String(i)) },
        { captionRequired: true },
      ),
    ).not.toThrow();
  });

  it("REELS için tam bir medya ister", () => {
    expect(() =>
      validateInstagramPublishInput(
        {
          villa: "Safira",
          type: "REELS",
          mediaUrls: ["video"],
          caption: "Metin",
          shareToFeed: false,
        },
        { captionRequired: true },
      ),
    ).not.toThrow();
  });

  it("2200 üzeri metni reddeder", () => {
    expect(() =>
      validateInstagramPublishInput(
        {
          villa: "Destan",
          type: "IMAGE",
          mediaUrls: ["image"],
          caption: "x".repeat(2201),
          shareToFeed: true,
        },
        { captionRequired: false },
      ),
    ).toThrow("2200");
  });

  it("private token yolunu medya anahtarı saymaz", () => {
    expect(
      managedInstagramMediaKey(
        "https://villa.example/api/meta/instagram/media/instagram-token%3Avilla%3ADestan",
        "https://villa.example",
      ),
    ).toBeNull();
  });
});

describe("scheduler güvenliği", () => {
  it("iki eşzamanlı invocation içinde atomik claim ile bir kez işler", async () => {
    const due = post();
    let databaseStatus = "scheduled";
    const process = vi.fn(async () => undefined);
    const dependencies = {
      recover: vi.fn(async () => undefined),
      listDue: vi.fn(async () => [due]),
      claim: vi.fn(async () => {
        if (databaseStatus !== "scheduled") return null;
        databaseStatus = "processing";
        return post({ status: "processing", attemptCount: 1 });
      }),
      process,
    };

    await Promise.all([
      processScheduledQueue(dependencies, now),
      processScheduledQueue(dependencies, now),
    ]);
    expect(process).toHaveBeenCalledTimes(1);
  });

  it("cancelled ve published kayıtları işlemez", async () => {
    const process = vi.fn(async () => undefined);
    await processScheduledQueue(
      {
        recover: async () => undefined,
        listDue: async () => [
          post({ id: "cancelled", status: "cancelled" }),
          post({ id: "published", status: "published" }),
        ],
        claim: async () => null,
        process,
      },
      now,
    );
    expect(process).not.toHaveBeenCalled();
  });

  it("retry sınırını üç toplam denemede keser", () => {
    expect(scheduledRetryDecision(true, 1, now).status).toBe("scheduled");
    expect(scheduledRetryDecision(true, 2, now).status).toBe("scheduled");
    expect(
      scheduledRetryDecision(true, MAX_SCHEDULE_ATTEMPTS, now).status,
    ).toBe("failed");
    expect(scheduledRetryDecision(false, 1, now).status).toBe("failed");
  });

  it("stale processing kaydını çift yayın riskine göre sınıflandırır", () => {
    expect(
      staleProcessingAction({
        instagramMediaId: "media-1",
        publishStartedAt: "2026-08-24T09:00:00.000Z",
        attemptCount: 1,
      }),
    ).toBe("publish-confirmed");
    expect(
      staleProcessingAction({
        instagramMediaId: null,
        publishStartedAt: "2026-08-24T09:00:00.000Z",
        attemptCount: 1,
      }),
    ).toBe("ambiguous-failed");
    expect(
      staleProcessingAction({
        instagramMediaId: null,
        publishStartedAt: null,
        attemptCount: 1,
      }),
    ).toBe("retry");
    expect(
      staleProcessingAction({
        instagramMediaId: null,
        publishStartedAt: null,
        attemptCount: MAX_SCHEDULE_ATTEMPTS,
      }),
    ).toBe("failed");
  });
});
