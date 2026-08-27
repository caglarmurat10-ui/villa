// OpenNext bu modülü Cloudflare build sırasında üretir.
// @ts-expect-error Üretilen dosya kaynak ağacında TypeScript bildirimi taşımaz.
import openNextHandler from "./.open-next/worker.js";
import { runInstagramScheduler } from "./src/lib/instagramSchedule";
import { runInsightsSync } from "./src/lib/instagramInsights";
import { runSocialPilot } from "./src/lib/socialPilot";
import { runAiContentActivity } from "./src/lib/aiActivity";
import type {
  ExecutionContext,
  ExportedHandler,
  ScheduledController,
} from "@cloudflare/workers-types";

export default {
  fetch(request, env, context) {
    return openNextHandler.fetch(request, env, context);
  },
  scheduled(
    controller: ScheduledController,
    env: CloudflareEnv,
    context: ExecutionContext,
  ) {
    // Uygulama D1 üzerinde kontrollü +5/+15 dakika retry uygular.
    controller.noRetry();
    const now = new Date(controller.scheduledTime);
    context.waitUntil(
      runInstagramScheduler(env, now)
        .then(async (result) => {
          console.log(
            JSON.stringify({
              message: "instagram scheduler completed",
              due: result.due,
              claimed: result.claimed,
            }),
          );
          const pilot = await runSocialPilot(env, now).catch(() => []);
          const ai = await runAiContentActivity(env, now).catch(() => []);
          const insights = await runInsightsSync(env, now).catch(() => []);
          console.log(
            JSON.stringify({
              message: "social automation completed",
              pilot: pilot.map((item) => item.status),
              ai: ai.map((item) => item.status),
              insights: insights.map((item) => item.status),
            }),
          );
        })
        .catch(() => {
          // Hata nesnesi dış servis yanıtı veya hassas veri içerebileceği için yazılmaz.
          console.error(
            JSON.stringify({ message: "instagram scheduler failed" }),
          );
        }),
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;
