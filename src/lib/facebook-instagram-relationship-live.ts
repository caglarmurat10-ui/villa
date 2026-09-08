import { getFacebookTokenScopes } from "@/lib/facebook";
import { getFacebookCredentials, getInstagramCredentials } from "@/lib/meta-store";
import {
  FACEBOOK_INSTAGRAM_RELATIONSHIP_PERMISSION,
  classifyFacebookInstagramRelationship,
  type FacebookInstagramRelationResult,
  type FacebookInstagramRelationshipClassification,
  type FacebookTokenScopesResult,
} from "@/lib/facebook-instagram-relationship";
import type { Villa } from "@/lib/types";

// Bu modül src/app/api/meta/health/route.ts'in canlı Facebook<->Instagram ilişki sorgusunu (Graph
// API round-trip) TEK bir yerde toplar - hem sağlık paneli hem de yayın-öncesi gate (bkz.
// social-account-policy.ts metaPublishGate + api/meta/instagram/publish/route.ts) AYNI gerçek kontrolü
// kullanır. İki bağımsız kopya olsaydı biri güncellenip diğeri unutulabilirdi (drift riski).

const FACEBOOK_GRAPH = "https://graph.facebook.com/v26.0";
const ALL_VILLAS: Villa[] = ["Safira", "Destan"];

async function getFacebookInstagramRelationship(pageId: string, accessToken: string) {
  const url = new URL(`${FACEBOOK_GRAPH}/${encodeURIComponent(pageId)}`);
  url.searchParams.set("fields", "id,name,instagram_business_account{id,username},connected_instagram_account{id,username}");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { method: "GET" });
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    instagram_business_account?: { id?: string; username?: string } | null;
    connected_instagram_account?: { id?: string; username?: string } | null;
    error?: { code?: number };
  };
  if (!response.ok || !payload.id) {
    throw new Error(`Facebook–Instagram ilişki bilgisi okunamadı (HTTP ${response.status}${payload.error?.code ? ` / ${payload.error.code}` : ""}).`);
  }
  return payload;
}

async function relationshipCredentials(villa: Villa) {
  const [facebook, instagram] = await Promise.all([
    getFacebookCredentials(villa).catch(() => null),
    getInstagramCredentials(villa).catch(() => null),
  ]);
  return { villa, facebook, instagram };
}

async function relationshipScopeState(facebook: { accessToken: string } | null): Promise<FacebookTokenScopesResult> {
  if (!facebook) return { ok: false };
  try {
    const { scopes } = await getFacebookTokenScopes(facebook.accessToken);
    return { ok: true, scopes };
  } catch {
    return { ok: false };
  }
}

// Tüm villaların ilişki durumunu tek seferde döner - "scopeGrantedElsewhere" sinyali (PERMISSION_MISSING
// vs SCOPE_UNAVAILABLE ayrımı için) başka bir villanın token'ında izin var mı bilgisine ihtiyaç duyar,
// bu yüzden villalar birlikte hesaplanır.
export async function checkFacebookInstagramRelationships(): Promise<
  Array<{ villa: Villa } & FacebookInstagramRelationshipClassification>
> {
  const credentials = await Promise.all(ALL_VILLAS.map(relationshipCredentials));
  const scopeStates = await Promise.all(credentials.map((item) => relationshipScopeState(item.facebook)));
  const scopeGrantedElsewhere = scopeStates.some(
    (state) => state.ok && state.scopes.includes(FACEBOOK_INSTAGRAM_RELATIONSHIP_PERMISSION),
  );

  return Promise.all(credentials.map(async ({ villa, facebook, instagram }, index) => {
    if (!facebook || !instagram) {
      const label = !facebook && !instagram
        ? "Facebook ve Instagram bağlantısı eksik"
        : !facebook
          ? "Facebook Sayfası bağlantısı eksik"
          : "Instagram bağlantısı eksik";
      return { villa, code: "FACEBOOK_IG_LINK_MISSING" as const, status: "missing" as const, healthy: false, label };
    }

    const scopesResult = scopeStates[index];
    let relationResult: FacebookInstagramRelationResult = { ok: false };
    let pageName = `Villa ${villa}`;
    if (scopesResult.ok && scopesResult.scopes.includes(FACEBOOK_INSTAGRAM_RELATIONSHIP_PERMISSION)) {
      try {
        const relation = await getFacebookInstagramRelationship(facebook.accountId, facebook.accessToken);
        pageName = relation.name ?? pageName;
        relationResult = {
          ok: true,
          pageName,
          instagramBusinessAccount: relation.instagram_business_account,
          connectedInstagramAccount: relation.connected_instagram_account,
        };
      } catch {
        relationResult = { ok: false };
      }
    }

    const classification = classifyFacebookInstagramRelationship({
      villa,
      pageName,
      storedInstagramAccountId: instagram.accountId,
      scopesResult,
      scopeGrantedElsewhere,
      relationResult,
    });

    return { villa, ...classification };
  }));
}

export async function checkFacebookInstagramRelationshipForVilla(villa: Villa) {
  const relationships = await checkFacebookInstagramRelationships();
  return relationships.find((item) => item.villa === villa) ?? null;
}
