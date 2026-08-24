// OpenNext bu modülü Cloudflare build sırasında üretir.
// @ts-expect-error Üretilen dosya kaynak ağacında TypeScript bildirimi taşımaz.
import openNextHandler from "./.open-next/worker.js";
import { runInstagramScheduler } from "./src/lib/instagramSchedule";
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
    context.waitUntil(
      runInstagramScheduler(env, new Date(controller.scheduledTime))
        .then((result) => {
          console.log(
            JSON.stringify({
              message: "instagram scheduler completed",
              due: result.due,
              claimed: result.claimed,
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
