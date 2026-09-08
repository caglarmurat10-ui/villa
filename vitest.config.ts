import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // tsconfig.json'daki "@/*" -> "./src/*" eşlemesiyle aynı - Next.js bunu kendi derleyicisinde
    // otomatik çözer ama vitest bağımsız bir Vite instance'ı kullandığı için burada da tanımlanmalı
    // (aksi halde "@/..." import eden bir modülü DOĞRUDAN test eden ilk test dosyası patlar).
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // .worktrees/ - eşzamanlı çalışan başka bir agent/oturumun kendi git worktree'si (bu projenin
    // parçası değil, kendi bağımsız kopyası). Vitest'in varsayılan include glob'u proje kökünden
    // her yeri tarar - bu dışlama olmadan o worktree'nin KENDİ (bu oturumdan bağımsız, farklı bir
    // anda değişmiş) test dosyaları da toplanıp yanlışlıkla bu projenin test sonucuna karışır.
    exclude: ["**/node_modules/**", "**/.worktrees/**", "**/dist/**", "**/.next/**", "**/.open-next/**"],
    server: {
      deps: {
        // node:sqlite built-in bazı Vite SSR ön-derleme yollarında "node:" öneki düşürülüp
        // bare specifier gibi çözülmeye çalışılabiliyor - dış (external) bırakılınca gerçek
        // Node modülü olarak require ediliyor.
        external: ["node:sqlite"],
      },
    },
  },
});
