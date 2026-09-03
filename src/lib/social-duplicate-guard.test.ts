import { describe, expect, it } from "vitest";
import { checkDuplicateContent, type RecentPost } from "./social-duplicate-guard";

const RECENT: RecentPost[] = [
  { villa: "Safira", caption: "Villa Safira'da gün doğumu eşliğinde kahvaltı keyfi.", mediaFile: "safira-1.jpg", scheduledDate: "2026-08-01" },
  { villa: "Destan", caption: "Patara Antik Kenti'nde tarih ve deniz bir arada.", mediaFile: "patara-antik.jpg", scheduledDate: "2026-08-05" },
];

describe("checkDuplicateContent", () => {
  it("birebir ayni caption (ayni villa) -> exact_caption duplicate", () => {
    const result = checkDuplicateContent({ villa: "Safira", caption: "Villa Safira'da gün doğumu eşliğinde kahvaltı keyfi.", mediaFile: "yeni-gorsel.jpg" }, RECENT);
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toBe("exact_caption");
  });

  it("ayni medya dosyasi tekrar kullanilirsa (farkli caption olsa bile) -> exact_media duplicate", () => {
    const result = checkDuplicateContent({ villa: "Safira", caption: "Tamamen farkli bir metin burada.", mediaFile: "safira-1.jpg" }, RECENT);
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toBe("exact_media");
  });

  it("cok benzer (yalniz kucuk degisiklik) caption -> high_caption_similarity duplicate", () => {
    const result = checkDuplicateContent(
      { villa: "Safira", caption: "Villa Safira'da gün doğumu eşliğinde kahvaltı keyfi!", mediaFile: "farkli-gorsel.jpg" },
      RECENT,
    );
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toBe("high_caption_similarity");
    expect(result.similarity).toBeGreaterThan(0.85);
  });

  it("tamamen farkli caption ve medya -> duplicate DEGIL", () => {
    const result = checkDuplicateContent(
      { villa: "Safira", caption: "Kaş'ta gün batımını izlemek için en güzel rota önerileri.", mediaFile: "kas-gunbatimi.jpg" },
      RECENT,
    );
    expect(result.isDuplicate).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("farkli villa'nin ayni caption'i tekrar sayilmaz - villa bazinda izole", () => {
    const result = checkDuplicateContent({ villa: "Destan", caption: "Villa Safira'da gün doğumu eşliğinde kahvaltı keyfi.", mediaFile: "baska.jpg" }, RECENT);
    expect(result.isDuplicate).toBe(false); // bu caption Safira'da var, Destan'da yok
  });

  it("bos son-gonderi listesinde hicbir zaman duplicate bulunmaz", () => {
    const result = checkDuplicateContent({ villa: "Safira", caption: "Yeni bir icerik.", mediaFile: "x.jpg" }, []);
    expect(result.isDuplicate).toBe(false);
    expect(result.similarity).toBe(0);
  });
});
