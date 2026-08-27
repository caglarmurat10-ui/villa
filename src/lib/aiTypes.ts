import { z } from "zod";
import type { Villa } from "./types";

export const AI_MODES = ["quick", "creative", "sales"] as const;
export const AI_PURPOSES = ["villa", "availability", "last-minute", "regional-guide", "travel", "reels", "carousel", "story"] as const;
export type AiMode = typeof AI_MODES[number];
export type AiPurpose = typeof AI_PURPOSES[number];

const storyboardScene = z.object({
  startSecond: z.number().int().min(0).max(30),
  endSecond: z.number().int().min(1).max(30),
  scene: z.string().min(1).max(180),
  overlayText: z.string().max(120),
  voiceOver: z.string().max(300),
}).strict();

const weeklyItem = z.object({
  day: z.string().min(1).max(20),
  villa: z.enum(["Destan", "Safira"]),
  contentType: z.enum(["IMAGE", "CAROUSEL", "REELS", "STORY_IDEA"]),
  topic: z.string().min(1).max(160),
  mediaCategory: z.string().max(80),
  reason: z.string().min(1).max(300),
}).strict();

export const aiContentOutputSchema = z.object({
  title: z.string().min(1).max(160),
  hook: z.string().min(1).max(240),
  caption: z.string().min(1).max(2200),
  shortCaption: z.string().min(1).max(600),
  storytellingCaption: z.string().min(1).max(2200),
  callToAction: z.string().min(1).max(300),
  hashtags: z.array(z.string().regex(/^#[^\s#]+$/)).max(20),
  contentType: z.enum(["IMAGE", "CAROUSEL", "REELS", "STORY_IDEA", "WEEKLY_PLAN"]),
  regionalTopic: z.string().max(160).nullable(),
  warnings: z.array(z.string().max(300)).max(10),
  villaClaims: z.array(z.string().max(240)).max(30),
  contentIdeas: z.array(z.string().max(240)).max(12),
  carouselSlides: z.array(z.string().max(240)).max(10),
  reelsStoryboard: z.array(storyboardScene).max(12),
  weeklyPlan: z.array(weeklyItem).max(14),
}).strict();

export type AiContentOutput = z.infer<typeof aiContentOutputSchema>;

export const regionalResearchOutputSchema = z.object({
  topic: z.string().min(1).max(160),
  summary: z.string().min(1).max(1200),
  whyInteresting: z.string().min(1).max(600),
  sourceUrls: z.array(z.string().url().startsWith("https://")).max(12),
  sourceTitles: z.array(z.string().min(1).max(240)).max(12),
  eventDate: z.string().nullable(),
  expiresAt: z.string().datetime(),
  contentIdeas: z.array(z.string().min(1).max(400)).min(1).max(12),
  category: z.enum(["tourism", "culture", "nature", "history", "event", "festival", "travel", "gastronomy", "beach", "experience"]),
  relevanceScore: z.number().int().min(0).max(100),
  freshnessScore: z.number().int().min(0).max(100),
}).strict();

export type RegionalResearchOutput = z.infer<typeof regionalResearchOutputSchema>;

export type VillaAiProfile = {
  villa: Villa;
  facts: string[];
  prohibitedClaims: string[];
  tone: string;
};

const riskyClaims = [
  "ısıtmalı havuz", "deniz manzarası", "jakuz", "sauna", "plaja sıfır", "evcil hayvan",
  "çocuk havuzu", "sonsuzluk havuzu", "kahvaltı dahil", "ücretsiz transfer",
];

export function validateAiVillaFacts(output: AiContentOutput, profile: VillaAiProfile) {
  const allowed = new Set(profile.facts.map((fact) => fact.trim().toLocaleLowerCase("tr-TR")));
  const unknownClaims = output.villaClaims.filter((claim) => !allowed.has(claim.trim().toLocaleLowerCase("tr-TR")));
  const combined = `${output.title}\n${output.hook}\n${output.caption}\n${output.shortCaption}\n${output.storytellingCaption}`.toLocaleLowerCase("tr-TR");
  const prohibited = [...new Set([...riskyClaims, ...profile.prohibitedClaims])]
    .filter((claim) => combined.includes(claim.toLocaleLowerCase("tr-TR")) &&
      ![...allowed].some((fact) => fact.includes(claim.toLocaleLowerCase("tr-TR"))));
  if (unknownClaims.length || prohibited.length) {
    throw new Error("AI çıktısı doğrulanmamış villa özelliği içeriyor.");
  }
  return output;
}

export const AI_CONTENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "hook", "caption", "shortCaption", "storytellingCaption", "callToAction", "hashtags", "contentType", "regionalTopic", "warnings", "villaClaims", "contentIdeas", "carouselSlides", "reelsStoryboard", "weeklyPlan"],
  properties: {
    title: { type: "string" }, hook: { type: "string" }, caption: { type: "string" },
    shortCaption: { type: "string" }, storytellingCaption: { type: "string" }, callToAction: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    contentType: { type: "string", enum: ["IMAGE", "CAROUSEL", "REELS", "STORY_IDEA", "WEEKLY_PLAN"] },
    regionalTopic: { anyOf: [{ type: "string" }, { type: "null" }] },
    warnings: { type: "array", items: { type: "string" } }, villaClaims: { type: "array", items: { type: "string" } },
    contentIdeas: { type: "array", items: { type: "string" } }, carouselSlides: { type: "array", items: { type: "string" } },
    reelsStoryboard: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["startSecond", "endSecond", "scene", "overlayText", "voiceOver"], properties: {
        startSecond: { type: "integer" }, endSecond: { type: "integer" }, scene: { type: "string" },
        overlayText: { type: "string" }, voiceOver: { type: "string" },
      } } },
    weeklyPlan: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["day", "villa", "contentType", "topic", "mediaCategory", "reason"], properties: {
        day: { type: "string" }, villa: { type: "string", enum: ["Destan", "Safira"] },
        contentType: { type: "string", enum: ["IMAGE", "CAROUSEL", "REELS", "STORY_IDEA"] },
        topic: { type: "string" }, mediaCategory: { type: "string" }, reason: { type: "string" },
      } } },
  },
} as const;

export const REGIONAL_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["topic", "summary", "whyInteresting", "sourceUrls", "sourceTitles", "eventDate", "expiresAt", "contentIdeas", "category", "relevanceScore", "freshnessScore"],
  properties: {
    topic: { type: "string" }, summary: { type: "string" }, whyInteresting: { type: "string" },
    sourceUrls: { type: "array", items: { type: "string" } }, sourceTitles: { type: "array", items: { type: "string" } },
    eventDate: { anyOf: [{ type: "string" }, { type: "null" }] }, expiresAt: { type: "string" },
    contentIdeas: { type: "array", items: { type: "string" } },
    category: { type: "string", enum: ["tourism", "culture", "nature", "history", "event", "festival", "travel", "gastronomy", "beach", "experience"] },
    relevanceScore: { type: "integer" }, freshnessScore: { type: "integer" },
  },
} as const;
