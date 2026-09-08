# Villa Yönetim — Claude Engineering Rules

These rules apply to every Claude Code / Claude GitHub Action task in this repository unless the repository owner explicitly overrides a rule in the triggering task.

## Production and architecture
- Production platform is Cloudflare Workers/D1. Do not migrate back to Vercel.
- Default working branch is `agent/cloudflare-migration`.
- Prefer additive, reversible changes. Never delete production data casually.
- Never expose or commit API keys, tokens, secrets, authorization codes, or private credentials.
- Do not deploy production from the Claude API GitHub Action. Prepare/test code and let the established production workflow or owner-controlled process deploy it.

## Commercial safety
- Acquisition mode is `ORGANIC_FIRST`.
- Do not create or enable Google Ads, Meta Ads, ad spend, paid SaaS, or payment methods without explicit owner approval.
- Do not create fake reviews, ratings, availability, pricing, traffic, reach, or conversion numbers.

## Social / Meta invariants
- `DESTAN_IG` is `BLOCKED_EXTERNAL_META_OWNERSHIP` until Meta resolves the external ownership conflict.
- Do not send Destan Instagram Graph publish calls while that hard block is active.
- Blocked Destan Instagram work must not consume scheduler publish slots or degrade healthy Safira IG/FB or Destan FB channels.
- Manual publication must stay distinct from provider/API-published state.
- Only verified real property media may be auto-published. Fail closed for AI-generated, unknown-origin, or cross-property media.
- Villa Safira and Villa Destan media must never be mixed.
- 15 Temmuz is permanently excluded from editorial content.
- Friday, religious, national-day, local and destination content must remain factual, respectful and non-partisan. Time-sensitive local news requires a source and human review unless a verified deterministic source is explicitly approved.

## Product / design standard
- The product must look and read as if a professional human team designed and refined it over time, not as obvious AI output.
- Prefer practical hierarchy, restrained typography, natural spacing, realistic terminology, tables/forms where appropriate, and cards only where they help.
- Avoid generic AI/SaaS aesthetics: excessive gradients, glow, glassmorphism, giant rounded cards, decorative blobs, needless pills, fake metrics, excessive emoji, repetitive marketing copy and unnecessary animation.
- Public villa media must remain recognizably real. No fabricated architecture, rooms, pools, gardens, views, guests or luxury props.
- Turkish copy should be concise, natural and credible. Avoid repetitive exaggerated phrases such as “benzersiz deneyim”, “hayalinizdeki tatil” and similar filler.

## Engineering quality
- Inspect the existing implementation before changing it; do not redesign unrelated areas.
- Preserve established single sources of truth instead of duplicating constants/data.
- Run the relevant tests and checks before claiming success. Typical commands are `npm test`, `npm run lint`, `npm run build`, and `npx opennextjs-cloudflare build` when applicable.
- Report only verified results. Clearly distinguish connected/automated behavior from manual-ready, external-action-required and blocked states.
- If a task requires external login, CAPTCHA, SMS/email verification, ownership confirmation, destructive external action or a secret not available to the workflow, stop that external step and report it explicitly rather than guessing or bypassing it.
