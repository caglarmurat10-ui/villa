import { generateAiContent, todaySuggestion } from "./aiContentStudio";
import { ensureAiTables, getAiSettings, type AiSocialSettings } from "./aiDb";
import { availabilityPriceText, createCampaign, getSocialSettings, listAvailability, suggestLibraryMedia } from "./socialOperationsDb";
import type { AiPurpose } from "./aiTypes";
import type { Villa } from "./types";

const QUIET_HOURS = 48;

function istanbulParts(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit",
    day: "2-digit", weekday: "short" });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday };
}

function weekStart(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
}

export function aiAutopilotDecision(settings: AiSocialSettings, lastCreatedAt: string | null, now = new Date()) {
  if (!settings.aiEnabled || settings.autopilotLevel === "off") return { allowed: false, reason: "disabled" } as const;
  if (lastCreatedAt && now.getTime() - Date.parse(lastCreatedAt) < QUIET_HOURS * 60 * 60 * 1000) {
    return { allowed: false, reason: "recent-content" } as const;
  }
  return { allowed: true, reason: null } as const;
}

const purposeByCategory: Record<string, AiPurpose> = {
  villa: "villa", regional: "regional-guide", travel: "travel", availability: "availability", special: "story",
};

export async function runAiContentActivity(env: CloudflareEnv, now = new Date()) {
  const results: Array<{ villa: Villa; status: string }> = [];
  await ensureAiTables(env.DB);
  for (const villa of ["Destan", "Safira"] as const) {
    try {
      const settings = await getAiSettings(env.DB, villa);
      if (!settings.aiEnabled || settings.autopilotLevel === "off") { results.push({ villa, status: "disabled" }); continue; }
      const local = istanbulParts(now); const monday = weekStart(local.date);
      if (local.weekday === "Mon") {
        const existing = await env.DB.prepare("SELECT id FROM ai_weekly_plans WHERE villa=? AND week_start=? LIMIT 1").bind(villa, monday).first();
        if (!existing) {
          await generateAiContent({ db: env.DB, env, villa, purpose: "villa", mode: "quick", weekly: true,
            userBrief: "Bu haftanın dengeli içerik planını hazırla. Yalnız taslak oluştur; yayınlama veya planlama yapma." });
          results.push({ villa, status: "weekly-draft" }); continue;
        }
      }
      const last = await env.DB.prepare("SELECT created_at FROM ai_content_history WHERE villa=? ORDER BY created_at DESC LIMIT 1")
        .bind(villa).first<{ created_at: string }>();
      const decision = aiAutopilotDecision(settings, last?.created_at ?? null, now);
      if (!decision.allowed) { results.push({ villa, status: decision.reason }); continue; }
      const suggestion = await todaySuggestion(env.DB, villa);
      const purpose = purposeByCategory[suggestion.category] ?? "villa";
      const socialSettings = await getSocialSettings(env.DB, villa);
      const gap = purpose === "availability"
        ? (await listAvailability(env.DB, socialSettings.maxCampaignDays)).find((item) => item.villa === villa) ?? null
        : null;
      const media = await suggestLibraryMedia(env.DB, villa);
      const generated = await generateAiContent({ db: env.DB, env, villa, purpose, mode: "quick",
        userBrief: `${suggestion.suggestion}. ${suggestion.reason}`, mediaCategory: media?.category ?? null,
        availability: gap ? { startDate: gap.startDate, endDate: gap.endDate, nights: gap.nights,
          priceText: socialSettings.includePrice ? await availabilityPriceText(env.DB, villa, gap.startDate, gap.endDate) : null } : null });
      if (settings.autopilotLevel === "suggestion" || !media) {
        results.push({ villa, status: media ? "suggested" : "suggested-media-missing" }); continue;
      }
      const campaign = await createCampaign(env.DB, { villa, campaignType: purpose, availabilityStart: gap?.startDate ?? null,
        availabilityEnd: gap?.endDate ?? null, nights: gap?.nights ?? null, mediaIds: [media.id],
        caption: generated.output.caption, templateId: `ai:${generated.id}`, source: "automation",
        contentCategory: suggestion.category });
      results.push({ villa, status: campaign
        ? settings.autopilotLevel === "auto_schedule" ? "drafted-approval-required" : "drafted"
        : "skipped" });
    } catch {
      results.push({ villa, status: "skipped" });
    }
  }
  return results;
}
