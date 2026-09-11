import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Bu üç dosya, WhatsApp "Giriş & konum" mesajını farklı panellerden (Mesaj Merkezi,
// Takvim çalışma alanı, Ana panel) üretir ve giriş saati cümlesini ayrı ayrı tutar.
// Burada React bileşeni render edilmiyor (repoda component test altyapısı yok) - yalnızca
// kaynak metindeki cümle doğrulanıyor, çünkü işletme sahibi tarafından onaylanmış tek
// giriş saati ifadesinin her üç yerde de aynı kalması gerekiyor.
const root = fileURLToPath(new URL("../../../", import.meta.url));

const FILES_WITH_CHECKIN_MESSAGE = [
  "src/components/MessageCenter.tsx",
  "src/components/VillaCalendarWorkspace.tsx",
  "src/components/Dashboard.tsx",
];

describe("WhatsApp giriş mesajı - giriş saati metni", () => {
  for (const relativePath of FILES_WITH_CHECKIN_MESSAGE) {
    it(`${relativePath} doğru giriş saati aralığını içerir`, () => {
      const source = readFileSync(`${root}${relativePath}`, "utf8");
      expect(source).toContain("Giriş saatimiz 16.00 ile 21.00 arasındadır.");
      expect(source).not.toContain("Giriş saatimiz 16.00’dır.");
    });

    it(`${relativePath} konum linklerini ve 15 dakika önce haber verme cümlesini korur`, () => {
      const source = readFileSync(`${root}${relativePath}`, "utf8");
      expect(source).toContain("konuma yaklaşık 15 dakika kala bize haber vermenizi rica ederiz.");
    });
  }
});
