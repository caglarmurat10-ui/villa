import "server-only";

import { getInstagramAccessToken } from "@/lib/instagramTokenStore";
import { getInstagramAccount } from "@/lib/meta-store";
import type { Villa } from "@/lib/types";

const INSTAGRAM_GRAPH = "https://graph.instagram.com";
const INVALID_TOKEN_MESSAGE =
  "Instagram bağlantısının erişim anahtarı geçersiz. Hesabı kaldırıp yeniden bağlayın.";

export type InstagramConnection = {
  accessToken: string;
  igUserId: string;
  username: string;
};

export type ContainerWaitKind = "IMAGE" | "REELS";

type PollingPolicy = {
  maxAttempts: number;
  delayMs: (attempt: number) => number;
  timeoutMessage: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

export function safeMetaValue(value: unknown) {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "";

  return value
    .replace(
      /(access_token|client_secret|authorization_code|short_lived_token|long_lived_token)=([^&\s]+)/gi,
      "$1=[REDACTED]",
    )
    .replace(/[A-Za-z0-9._~-]{80,}/g, "[REDACTED]")
    .slice(0, 220);
}

function safeMetaMessage(
  data: Record<string, unknown>,
  status: number,
  fallback: string,
) {
  const error = isRecord(data.error) ? data.error : {};
  const parts: string[] = [];
  const message = safeMetaValue(error.message);
  const type = safeMetaValue(error.type);
  const code = safeMetaValue(error.code);
  const subcode = safeMetaValue(error.error_subcode);

  if (message) parts.push(`message=${message}`);
  if (type) parts.push(`type=${type}`);
  if (code) parts.push(`code=${code}`);
  if (subcode) parts.push(`error_subcode=${subcode}`);

  return parts.length
    ? `${fallback}: ${parts.join(" | ")}`
    : `${fallback} (HTTP ${status}).`;
}

export function safeInstagramError(
  error: unknown,
  fallback = "Instagram yayını tamamlanamadı.",
) {
  if (!(error instanceof Error) || !error.message) return fallback;
  return safeMetaValue(error.message) || fallback;
}

async function validateInstagramToken(accessToken: string) {
  if (accessToken.length < 20) return null;

  const profileUrl = new URL(`${INSTAGRAM_GRAPH}/me`);
  profileUrl.searchParams.set("fields", "id,username");
  profileUrl.searchParams.set("access_token", accessToken);

  const response = await fetch(profileUrl, { method: "GET" });
  const data = await readJson(response);
  const id = stringValue(data.id);
  const username = stringValue(data.username);

  return response.ok && id && username ? { id, username } : null;
}

export async function resolveInstagramConnection(
  villa: Villa,
): Promise<InstagramConnection> {
  const account = await getInstagramAccount(villa);
  if (!account) {
    throw new Error(
      "Bu villa için bağlı Instagram hesabı bulunamadı. Önce hesabı bağlayın.",
    );
  }

  let accessToken: string | null = null;
  try {
    accessToken = await getInstagramAccessToken(villa, account.accountId);
  } catch {
    throw new Error(INVALID_TOKEN_MESSAGE);
  }

  if (!accessToken) throw new Error(INVALID_TOKEN_MESSAGE);

  let profile: Awaited<ReturnType<typeof validateInstagramToken>> = null;
  try {
    profile = await validateInstagramToken(accessToken);
  } catch {
    throw new Error(INVALID_TOKEN_MESSAGE);
  }

  if (!profile || profile.id !== account.accountId) {
    throw new Error(INVALID_TOKEN_MESSAGE);
  }

  return {
    accessToken,
    igUserId: profile.id,
    username: profile.username,
  };
}

export async function createInstagramContainer(
  connection: InstagramConnection,
  parameters: Readonly<Record<string, string>>,
  fallback: string,
) {
  const response = await fetch(
    `${INSTAGRAM_GRAPH}/${encodeURIComponent(connection.igUserId)}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...parameters,
        access_token: connection.accessToken,
      }),
    },
  );
  const data = await readJson(response);
  const id = stringValue(data.id);

  if (!response.ok || !id) {
    throw new Error(safeMetaMessage(data, response.status, fallback));
  }

  return id;
}

function pollingPolicy(kind: ContainerWaitKind): PollingPolicy {
  if (kind === "REELS") {
    return {
      maxAttempts: 14,
      delayMs: (attempt) => Math.min(1500 + attempt * 500, 5000),
      timeoutMessage:
        "Instagram Reels videosunu henüz hazırlayamadı. Biraz sonra yeniden deneyin.",
    };
  }

  return {
    maxAttempts: 10,
    delayMs: () => 1000,
    timeoutMessage:
      "Instagram medyayı zamanında hazırlayamadı. Birkaç saniye sonra yeniden deneyin.",
  };
}

export async function waitForInstagramContainer(
  connection: InstagramConnection,
  containerId: string,
  kind: ContainerWaitKind,
  context: string,
) {
  const policy = pollingPolicy(kind);

  for (let attempt = 0; attempt < policy.maxAttempts; attempt += 1) {
    const statusUrl = new URL(
      `${INSTAGRAM_GRAPH}/${encodeURIComponent(containerId)}`,
    );
    statusUrl.searchParams.set("fields", "status_code,status");
    statusUrl.searchParams.set("access_token", connection.accessToken);

    const response = await fetch(statusUrl, { method: "GET" });
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(
        safeMetaMessage(data, response.status, `${context} durumu alınamadı`),
      );
    }

    const statusCode = stringValue(data.status_code);
    if (statusCode === "FINISHED") return;

    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      const status = safeMetaValue(data.status);
      throw new Error(
        status || `${context} hazırlama durumu: ${statusCode}`,
      );
    }

    if (attempt < policy.maxAttempts - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, policy.delayMs(attempt)),
      );
    }
  }

  throw new Error(policy.timeoutMessage);
}

export async function publishInstagramContainer(
  connection: InstagramConnection,
  containerId: string,
) {
  const response = await fetch(
    `${INSTAGRAM_GRAPH}/${encodeURIComponent(connection.igUserId)}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: connection.accessToken,
      }),
    },
  );
  const data = await readJson(response);
  const id = stringValue(data.id);

  if (!response.ok || !id) {
    throw new Error(
      safeMetaMessage(data, response.status, "Instagram gönderisi yayınlanamadı"),
    );
  }

  return id;
}
