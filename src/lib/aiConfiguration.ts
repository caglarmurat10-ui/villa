type OptionalAiBindings = {
  OPENAI_API_KEY?: unknown;
  PEXELS_API_KEY?: unknown;
  SOCIAL_AI_ADMIN_KEY?: unknown;
};

export type AiConfigurationStatus = {
  openAiConfigured: boolean;
  pexelsConfigured: boolean;
  adminConfigured: boolean;
  aiEnabled: boolean;
  imageEnabled: boolean;
  videoEnabled: boolean;
  autopilotEnabled: boolean;
};

function optionalValue(env: CloudflareEnv, name: keyof OptionalAiBindings) {
  const value = (env as CloudflareEnv & OptionalAiBindings)[name];
  return typeof value === "string" ? value.trim() : "";
}

export function hasOpenAiConfiguration(env: CloudflareEnv) {
  return Boolean(optionalValue(env, "OPENAI_API_KEY"));
}

export function hasPexelsConfiguration(env: CloudflareEnv) {
  return Boolean(optionalValue(env, "PEXELS_API_KEY"));
}

export function hasAiAdminConfiguration(env: CloudflareEnv) {
  return optionalValue(env, "SOCIAL_AI_ADMIN_KEY").length >= 16;
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
  const openAiConfigured = hasOpenAiConfiguration(env);
  return {
    openAiConfigured,
    pexelsConfigured: hasPexelsConfiguration(env),
    adminConfigured: hasAiAdminConfiguration(env),
    aiEnabled: openAiConfigured,
    imageEnabled: openAiConfigured && String(env.AI_IMAGE_ENABLED) === "true",
    videoEnabled: openAiConfigured && String(env.AI_VIDEO_ENABLED) === "true",
    autopilotEnabled: openAiConfigured && autopilotRequested,
  };
}

export function integrationUnavailableResponse(service: "openai" | "pexels" | "admin") {
  const error = service === "openai" ? "OpenAI yapılandırılmadı. Hazır şablonlarla devam edebilirsiniz."
    : service === "pexels" ? "Pexels yapılandırılmadı. Villa medya kütüphanesini kullanabilirsiniz."
      : "AI yönetici erişimi yapılandırılmadı.";
  return Response.json({ configured: false, service, error }, { status: 503 });
}
