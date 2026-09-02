import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  output: "standalone",
  // next dev, çalıştıkça kök dizine AGENTS.md/CLAUDE.md üretmeye çalışıyor - bu repo'da bunlar
  // istenmiyor.
  agentRules: false,
};

export default nextConfig;
