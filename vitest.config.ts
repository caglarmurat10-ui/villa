import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
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
