import MetaConnections from "@/components/MetaConnections";
import SocialMediaView from "@/components/SocialMediaView";
import { listMetaAccounts } from "@/lib/meta-store";
import { listReservations } from "@/lib/db";
import { findAvailabilityGaps } from "@/lib/social-availability";
import { listSocialPosts } from "@/lib/social-db";

export const dynamic = "force-dynamic";

type SocialSearchParams = {
  meta_error?: string | string[];
  meta_stage?: string | string[];
  meta_connected?: string | string[];
};

const oauthStages = new Set([
  "state",
  "nonce-cookie",
  "code-exchange",
  "long-token-exchange",
  "profile-fetch",
  "database-save",
]);

const errorAlertStyle = {
  maxWidth: "1250px",
  boxSizing: "border-box",
  margin: "18px auto 0",
  padding: "14px 16px",
  border: "1px solid #ef4444",
  borderRadius: "14px",
  background: "#450a0a",
  color: "#fecaca",
  boxShadow: "0 10px 30px #7f1d1d33",
} as const;

const successAlertStyle = {
  maxWidth: "1250px",
  boxSizing: "border-box",
  margin: "18px auto 0",
  padding: "14px 16px",
  border: "1px solid #22c55e",
  borderRadius: "14px",
  background: "#052e16",
  color: "#bbf7d0",
} as const;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
  }).format(new Date());
}

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<SocialSearchParams>;
}) {
  const params = await searchParams;
  const metaError = one(params.meta_error);
  const rawStage = one(params.meta_stage);
  const metaStage =
    rawStage && oauthStages.has(rawStage) ? rawStage : null;
  const connected = one(params.meta_connected);
  const connectedVilla =
    connected === "Safira" || connected === "Destan"
      ? connected
      : null;

  const [posts, accounts, reservations] = await Promise.all([
    listSocialPosts(),
    listMetaAccounts(),
    listReservations(),
  ]);
  const gaps = findAvailabilityGaps(
    reservations,
    istanbulToday()
  );

  return (
    <>
      {metaError ? (
        <div style={errorAlertStyle} role="alert">
          <strong style={{ display: "block" }}>
            Instagram bağlantısı tamamlanamadı
          </strong>
          {metaStage ? (
            <span
              style={{
                display: "block",
                marginTop: "5px",
                color: "#fca5a5",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              Aşama: {metaStage}
            </span>
          ) : null}
          <p style={{ margin: "7px 0 0", lineHeight: 1.45 }}>
            {metaError}
          </p>
        </div>
      ) : connectedVilla ? (
        <div style={successAlertStyle} role="status">
          <strong style={{ display: "block" }}>
            Instagram bağlantısı tamamlandı
          </strong>
          <p style={{ margin: "7px 0 0", lineHeight: 1.45 }}>
            Villa {connectedVilla} hesabı bağlandı. Bağlı hesap
            bilgisi aşağıda gösteriliyor.
          </p>
        </div>
      ) : null}
      <MetaConnections initialAccounts={accounts} />
      <SocialMediaView
        initialPosts={posts}
        availabilityGaps={gaps}
      />
    </>
  );
}
