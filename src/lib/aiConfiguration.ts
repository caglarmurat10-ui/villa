type OptionalAiBindings = {
  OPENAI_API_KEY?: unknown;
  PEXELS_API_KEY?: unknown;
  SOCIAL_AI_ADMIN_KEY?: unknown;
  AI_PROVIDER?: unknown;
  AI_ALLOW_PAID_FALLBACK?: unknown;
  WORKERS_AI_TEXT_MODEL?: unknown;
};

export type AiProviderName = "workers-ai" | "openai" | "template";

export type AiConfigurationStatus = {
  workersAiConfigured: boolean;
  workersAiModel: string;
  primaryProvider: AiProviderName;
  openAiConfigured: boolean;
  paidFallbackEnabled: boolean;
  pexelsConfigured: boolean;
  adminConfigured: boolean;
  templateAvailable: boolean;
  aiEnabled: boolean;
  imageEnabled: boolean;
  videoEnabled: boolean;
  autopilotEnabled: boolean;
};

export const DEFAULT_WORKERS_AI_TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

function optionalValue(env: CloudflareEnv, name: keyof OptionalAiBindings) {
  const value = (env as CloudflareEnv & OptionalAiBindings)[name];
  return typeof value === "string" ? value.trim() : "";
}

export function workersAiModel(env: CloudflareEnv) {
  return optionalValue(env, "WORKERS_AI_TEXT_MODEL") || DEFAULT_WORKERS_AI_TEXT_MODEL;
}

export function configuredAiProvider(env: CloudflareEnv): AiProviderName {
  const value = optionalValue(env, "AI_PROVIDER").toLocaleLowerCase("en-US");
  return value === "openai" || value === "template" ? value : "workers-ai";
}

export function hasWorkersAiConfiguration(env: CloudflareEnv) {
  const binding = (env as CloudflareEnv & { AI?: { run?: unknown } }).AI;
  return Boolean(binding && typeof binding.run === "function");
}

export function hasOpenAiConfiguration(env: CloudflareEnv) {
  return Boolean(optionalValue(env, "OPENAI_API_KEY"));
}

export function isPaidAiFallbackAllowed(env: CloudflareEnv) {
  return optionalValue(env, "AI_ALLOW_PAID_FALLBACK").toLocaleLowerCase("en-US") === "true";
}

export function hasPexelsConfiguration(env: CloudflareEnv) {
  return Boolean(optionalValue(env, "PEXELS_API_KEY"));
}

export function hasAiAdminConfiguration(env: CloudflareEnv) {
  return optionalValue(env, "SOCIAL_AI_ADMIN_KEY").length >= 16;
}

export function hasConfiguredTextProvider(env: CloudflareEnv) {
  const provider = configuredAiProvider(env);
  if (provider === "template") return true;
  if (provider === "openai") return isPaidAiFallbackAllowed(env) && hasOpenAiConfiguration(env);
  return hasWorkersAiConfiguration(env) || (isPaidAiFallbackAllowed(env) && hasOpenAiConfiguration(env));
}

export function requireOpenAiApiKey(env: CloudflareEnv) {
  const value = optionalValue(env, "OPENAI_API_KEY");
  if (!value) throw new Error("OpenAI yapılandırılmadı.");
  return value;
}

export function requirePexelsApiKey(env: CloudflareEnv) {
  const value = optionalValue(env, "PEXELS_API_KEY");
  if (!value) throw new Error("Pexels yapılandırılmadı.");
  return value;
}

export function requireAiAdminKey(env: CloudflareEnv) {
  const value = optionalValue(env, "SOCIAL_AI_ADMIN_KEY");
  if (value.length < 16) throw new Error("AI yönetici erişimi yapılandırılmadı.");
  return value;
}

export function aiConfigurationStatus(env: CloudflareEnv, autopilotRequested = false): AiConfigurationStatus {
  const workersAiConfigured = hasWorkersAiConfiguration(env);
  const openAiConfigured = hasOpenAiConfiguration(env);
  const paidFallbackEnabled = isPaidAiFallbackAllowed(env) && openAiConfigured;
  const primaryProvider = configuredAiProvider(env);
  const aiEnabled = hasConfiguredTextProvider(env);
  return {
    workersAiConfigured,
    workersAiModel: workersAiModel(env),
    primaryProvider,
    openAiConfigured,
    paidFallbackEnabled,
    pexelsConfigured: hasPexelsConfiguration(env),
    adminConfigured: hasAiAdminConfiguration(env),
    templateAvailable: true,
    aiEnabled,
    imageEnabled: paidFallbackEnabled && String(env.AI_IMAGE_ENABLED) === "true",
    videoEnabled: paidFallbackEnabled && String(env.AI_VIDEO_ENABLED) === "true",
    autopilotEnabled: aiEnabled && autopilotRequested,
  };
}

export function integrationUnavailableResponse(service: "workers-ai" | "openai" | "pexels" | "admin") {
  const error = service === "workers-ai" ? "Cloudflare Workers AI kullanılamıyor. Hazır şablonlarla devam edebilirsiniz."
    : service === "openai" ? "OpenAI ücretli alternatifi kapalı veya yapılandırılmadı. Hazır şablonlarla devam edebilirsiniz."
      : service === "pexels" ? "Pexels yapılandırılmadı. Villa medya kütüphanesini kullanabilirsiniz."
        : "AI yönetici erişimi yapılandırılmadı.";
  return Response.json({ configured: false, service, error }, { status: 503 });
}
