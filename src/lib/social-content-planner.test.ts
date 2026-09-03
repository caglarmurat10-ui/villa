import { describe, expect, it } from "vitest";
import { classifyContentSafety, planRolling30Days, type ExistingPost, type PlannerInput } from "./social-content-planner";
import { socialContentTemplates } from "./social-content-library";
import type { SocialContentTemplate } from "./social-content-library";
import type { RecentPost } from "./social-duplicate-guard";
import { isClosedSeasonDate } from "./season-policy";

function template(overrides: Partial<SocialContentTemplate> & { id: string }): SocialContentTemplate {
  return {
    scheduledDate: "2026-09-10", villa: "Safira", format: "Feed", contentType: "Gönderi",
    theme: "Bölge", mediaFile: `${overrides.id}.jpg`, hook: "hook", caption: "caption metni", mediaResolved: true,
    mediaKind: "image", driveFileId: "f1", driveViewUrl: "", previewUrl: "", mediaUrl: "/x.jpg", mediaUrls: ["/x.jpg"],
    ...overrides,
  };
}

describe("classifyContentSafety", () => {
  it("medyası çözümlenmemiş şablon BLOCKED döner", () => {
    const result = classifyContentSafety(template({ id: "X1", mediaResolved: false }));
    expect(result.automationClass).toBe("BLOCKED");
  });

  it("fiyat/TL geçen caption REVIEW_REQUIRED döner - doğrulanmadan otomatik yayınlanamaz", () => {
    const result = classifyContentSafety(template({ id: "X2", caption: "Bu hafta 1500 TL indirimli fiyatlarla." }));
    expect(result.automationClass).toBe("REVIEW_REQUIRED");
  });

  it("saat bilgisi geçen caption REVIEW_REQUIRED döner", () => {
    const result = classifyContentSafety(template({ id: "X3", caption: "Açılış saati 09:00'da başlıyor." }));
    expect(result.automationClass).toBe("REVIEW_REQUIRED");
  });

  it("hava durumu geçen caption REVIEW_REQUIRED döner", () => {
    expect(classifyContentSafety(template({ id: "X4", caption: "Bugün hava durumu 28 derece, güneşli." })).automationClass).toBe("REVIEW_REQUIRED");
  });

  it("sabit, değişken bilgi içermeyen içerik AUTO_SAFE döner", () => {
    const result = classifyContentSafety(template({ id: "X5", caption: "Villa Safira'nın havuzunda gün batımını izlemek gibisi yok." }));
    expect(result.automationClass).toBe("AUTO_SAFE");
  });
});

describe("planRolling30Days", () => {
  const basePool: SocialContentTemplate[] = [
    template({ id: "A1", theme: "Bölge", villa: "Safira", caption: "Patara antik kenti gerçekten etkileyici." }),
    template({ id: "A2", theme: "Bölge", villa: "Destan", caption: "Kaputaş plajı berrak suyuyla bilinir." }),
    template({ id: "B1", theme: "Gezi", villa: "Safira", caption: "Kaş'ta bir gün geçirmek isteyenler için ipuçları." }),
    template({ id: "B2", theme: "Gezi", villa: "Destan", caption: "Kalkan'ın beyaz badanalı sokakları." }),
    template({ id: "C1", theme: "Villa", villa: "Safira", caption: "Villa Safira'nın havuz başı sabah ışığı." }),
    template({ id: "C2", theme: "Villa", villa: "Destan", caption: "Villa Destan'ın akşam atmosferi." }),
    template({ id: "D1", theme: "Müsaitlik", villa: "Safira", caption: "Bu hafta müsaitlik durumu güncel." }),
    template({ id: "D2", theme: "Özel", villa: "Destan", caption: "Doğrudan rezervasyon avantajları." }),
  ];

  it("boş bir takvimde her gün dailyTarget kadar AUTO_SAFE içerik planlar", () => {
    const input: PlannerInput = {
      todayIso: "2026-09-10", horizonDays: 5, dailyTarget: 1,
      pool: basePool, existingScheduled: [], recentPosts: [],
    };
    const { planned } = planRolling30Days(input);
    expect(planned.length).toBeGreaterThan(0);
    expect(planned.every((p) => p.automationClass === "AUTO_SAFE")).toBe(true);
    expect(new Set(planned.map((p) => p.date)).size).toBeLessThanOrEqual(5);
  });

  it("zaten dailyTarget kadar dolu bir güne yeni içerik EKLEMEZ (mevcut D1 kaydına dokunmaz)", () => {
    const existing: ExistingPost[] = [{ scheduledDate: "2026-09-10", villa: "Safira", theme: "Villa" }];
    const input: PlannerInput = {
      todayIso: "2026-09-10", horizonDays: 1, dailyTarget: 1,
      pool: basePool, existingScheduled: existing, recentPosts: [],
    };
    const { planned } = planRolling30Days(input);
    expect(planned.some((p) => p.date === "2026-09-10")).toBe(false);
  });

  it("son 60 günde kullanılmış (aynı caption) bir şablonu tekrar SEÇMEZ", () => {
    const recentPosts: RecentPost[] = [
      { villa: "Safira", caption: "Patara antik kenti gerçekten etkileyici.", mediaFile: "a.jpg", scheduledDate: "2026-08-20" },
    ];
    const input: PlannerInput = {
      todayIso: "2026-09-10", horizonDays: 1, dailyTarget: 8, // tum havuzu tuketmeye zorla
      pool: basePool, existingScheduled: [], recentPosts,
    };
    const { planned } = planRolling30Days(input);
    expect(planned.some((p) => p.templateId === "A1")).toBe(false);
  });

  it("değişken bilgi içeren (REVIEW_REQUIRED) bir şablon asla 'planned' (otomatik) listesine girmez", () => {
    const pool = [...basePool, template({ id: "E1", theme: "Bölge", villa: "Safira", caption: "Giriş ücreti 50 TL'dir." })];
    const input: PlannerInput = {
      todayIso: "2026-09-10", horizonDays: 3, dailyTarget: 8,
      pool, existingScheduled: [], recentPosts: [],
    };
    const { planned, needsReview } = planRolling30Days(input);
    expect(planned.some((p) => p.templateId === "E1")).toBe(false);
    expect(needsReview.some((p) => p.templateId === "E1")).toBe(true);
  });

  it("bir önceki dolu günün kategorisi Müsaitlik/Kampanya ise aynı kategori ertesi gün tekrar seçilmez", () => {
    // dailyTarget=1, havuzda 2 ayrı Müsaitlik/Kampanya şablonu var (S1, S2) - iki günü de bu
    // kategoriyle doldurmaya zorlayacak şekilde başka kategori YOK.
    const salesOnlyPool = [
      template({ id: "S1", theme: "Müsaitlik", villa: "Safira", caption: "Müsaitlik 1" }),
      template({ id: "S2", theme: "Müsaitlik", villa: "Destan", caption: "Müsaitlik 2" }),
    ];
    const input: PlannerInput = {
      todayIso: "2026-09-10", horizonDays: 2, dailyTarget: 1,
      pool: salesOnlyPool, existingScheduled: [], recentPosts: [],
    };
    const { planned } = planRolling30Days(input);
    // Birinci gün bir Müsaitlik/Kampanya şablonuyla dolar (başka kategori yok), ikinci gün ise
    // kural gereği bu kategori hariç tutulur ve havuzda başka kategori kalmadığı için BOŞ kalır.
    expect(planned.filter((p) => p.category === "Müsaitlik/Kampanya")).toHaveLength(1);
  });

  it("KESIN SEZON POLITIKASI - isClosedSeasonDate verildiginde Müsaitlik/Kampanya kategorisi kapali sezon gunune HIC planlanmaz, gunluk hedef yine baska kategoriyle doldurulur", () => {
    const input: PlannerInput = {
      todayIso: "2026-09-29", horizonDays: 3, dailyTarget: 1, // 09-29 (acik), 09-30 (acik), 10-01 (KAPALI)
      pool: basePool, existingScheduled: [], recentPosts: [],
      isClosedSeasonDate,
    };
    const { planned } = planRolling30Days(input);
    const closedDaySlots = planned.filter((p) => p.date === "2026-10-01");
    expect(closedDaySlots.every((p) => p.category !== "Müsaitlik/Kampanya")).toBe(true);
    // Gün yine doldu (baska kategoriyle) - kapali sezon nedeniyle icerik uretimi tamamen DURMAZ.
    expect(closedDaySlots.length).toBe(1);
  });

  it("KESIN SEZON POLITIKASI - gercek 60 sablonluk havuz + gercek bugunku tarih (2026-09-03, 30 gunluk ufuk 2026-10-01/02/03'e tasiyor) ile HICBIR Müsaitlik/Kampanya gonderisi kapali sezon gunlerine planlanmaz", () => {
    const input: PlannerInput = {
      todayIso: "2026-09-03", horizonDays: 30, dailyTarget: 2,
      pool: socialContentTemplates, existingScheduled: [], recentPosts: [],
      isClosedSeasonDate,
    };
    const { planned } = planRolling30Days(input);
    const closedSeasonSalesSlots = planned.filter((p) => isClosedSeasonDate(p.date) && p.category === "Müsaitlik/Kampanya");
    expect(closedSeasonSalesSlots).toHaveLength(0);
  });

  it("gerçek üretim içerik havuzuyla (60 şablon) 30 günlük ufku, aynı medyayı tekrar kullanmadan güvenle doldurabildiği kadar doldurur", () => {
    const input: PlannerInput = {
      todayIso: "2026-09-03", horizonDays: 30, dailyTarget: 1,
      pool: socialContentTemplates, existingScheduled: [], recentPosts: [],
    };
    const { planned } = planRolling30Days(input);
    const filledDays = new Set(planned.map((p) => p.date)).size;
    // Gerçek havuzda bazı medya dosyaları (ör. Reels video'ları) birden fazla şablonda paylaşılıyor -
    // duplicate guard bunları BİLEREK aynı anda tekrar önermez (aynı video farklı günlerde spam gibi
    // görünmesin diye). Bu yüzden 60 şablon olsa da doldurulabilir gün sayısı 60'tan azdır - bu
    // BEKLENEN ve GÜVENLİ bir davranıştır, uydurma doldurma YOKTUR.
    expect(filledDays).toBeGreaterThan(10);
    expect(planned.every((p) => p.automationClass === "AUTO_SAFE")).toBe(true);
    // Aynı şablon iki kez planlanmamalı (kimlik bazında tekil)
    expect(new Set(planned.map((p) => p.templateId)).size).toBe(planned.length);
  });
});
