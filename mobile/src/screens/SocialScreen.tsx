import { useMemo, useState } from "react";
import { TopBar, Skeleton, ErrorState, EmptyState } from "../components/common";
import { BottomSheet } from "../components/BottomSheet";
import { useApi } from "../lib/useApi";

interface SocialPost {
  id: string; villa: "Safira" | "Destan"; platform: string; contentType: string;
  caption: string; mediaUrl: string; scheduledDate: string; scheduledTime: string | null;
  status: string; approvalStatus: string; lastPublishError: string | null;
  automationClass: "AUTO_SAFE" | "REVIEW_REQUIRED" | "BLOCKED" | null;
  destanInstagramHardBlocked: boolean;
}

type StatusBucket = "" | "planned" | "published" | "failed";

// Reels video olabilir, diğerleri fotoğraf/hikaye - yükleme hatasında sessizce gizlenir,
// ekranı bozmaz. Sahte/generate görsel yok - yalnız gerçek mediaUrl.
function MediaPreview({ url, isVideo, tall }: { url: string; isVideo: boolean; tall?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return null;
  const style = { width: "100%", maxHeight: tall ? 260 : 140, objectFit: "cover" as const, display: "block", borderRadius: tall ? 10 : "10px 10px 0 0" };
  if (isVideo) {
    return <video src={url} style={style} muted playsInline preload="metadata" controls onError={() => setFailed(true)} />;
  }
  return <img src={url} alt="" style={style} loading="lazy" onError={() => setFailed(true)} />;
}

function bucketOf(post: SocialPost): StatusBucket {
  if (post.status === "Planlandı" && post.lastPublishError) return "failed";
  if (post.status === "Yayınlandı") return "published";
  return "planned";
}

// Ana durum tek etiket - AUTO_SAFE/REVIEW_REQUIRED/BLOCKED ham değerleri listeyi kirletmesin,
// yalnız Türkçe kullanıcı etiketi gösterilir (öncelik: Başarısız > Yayınlanamaz > Kontrol
// gerekli > Yayınlandı > Planlandı/Hazır). Backend ham değerleri hiç değişmiyor.
function mainStatus(post: SocialPost): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (post.status === "Planlandı" && post.lastPublishError) return { label: "Başarısız", tone: "danger" };
  if (post.automationClass === "BLOCKED") return { label: "Yayınlanamaz", tone: "danger" };
  if (post.status === "Yayınlandı") return { label: "Yayınlandı", tone: "success" };
  if (post.automationClass === "REVIEW_REQUIRED") return { label: "Kontrol gerekli", tone: "warning" };
  if (post.automationClass === "AUTO_SAFE") return { label: "Hazır", tone: "success" };
  return { label: "Planlandı", tone: "neutral" };
}

function formatDate(date: string): string {
  try { return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`)); }
  catch { return date; }
}

const TONE_COLOR: Record<string, string> = { success: "#86efac", warning: "#fbbf24", danger: "#fca5a5", neutral: "#9fb0c5" };
const TONE_BG: Record<string, string> = { success: "#123522", warning: "#241a06", danger: "#2a0a0a", neutral: "#17263c" };

export function SocialScreen() {
  const [villa, setVilla] = useState<"" | "Safira" | "Destan">("");
  const [bucket, setBucket] = useState<StatusBucket>("");
  const [detailPost, setDetailPost] = useState<SocialPost | null>(null);
  const [warningOpen, setWarningOpen] = useState(false);
  const { data, loading, error, reload } = useApi<{ posts: SocialPost[] }>(`/social${villa ? `?villa=${villa}` : ""}`, [villa]);

  const summary = useMemo(() => {
    const posts = data?.posts ?? [];
    return {
      planned: posts.filter((p) => bucketOf(p) === "planned").length,
      pendingApproval: posts.filter((p) => p.status === "Planlandı" && p.approvalStatus !== "Onaylandı").length,
      published: posts.filter((p) => bucketOf(p) === "published").length,
      failed: posts.filter((p) => bucketOf(p) === "failed").length,
    };
  }, [data]);

  const filtered = useMemo(() => {
    const posts = data?.posts ?? [];
    if (!bucket) return posts;
    return posts.filter((p) => bucketOf(p) === bucket);
  }, [data, bucket]);

  return (
    <div>
      <TopBar title="Sosyal Medya" />
      <div className="app-content">
        <div style={{ display: "grid", gridTemplateColumns: summary.failed > 0 ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div className="stat-box"><div className="value" style={{ fontSize: 18 }}>{summary.planned}</div><div className="label">Planlanan</div></div>
          <div className="stat-box"><div className="value" style={{ fontSize: 18 }}>{summary.pendingApproval}</div><div className="label">Kontrol Bekleyen</div></div>
          <div className="stat-box"><div className="value" style={{ fontSize: 18 }}>{summary.published}</div><div className="label">Yayınlanan</div></div>
          {summary.failed > 0 && (
            <div className="stat-box" style={{ borderColor: "#7f1d1d" }}><div className="value" style={{ fontSize: 18, color: "#fca5a5" }}>{summary.failed}</div><div className="label" style={{ color: "#fca5a5" }}>Başarısız</div></div>
          )}
        </div>

        <div className="card" style={{ borderColor: "#a16207" }}>
          <div className="card-title" style={{ color: "#fbbf24" }}>DESTAN INSTAGRAM</div>
          <p style={{ fontSize: 13, margin: "6px 0 2px" }}>Bağlantı sorunu nedeniyle yayın kapalı.</p>
          <p style={{ fontSize: 11, color: "#9fb0c5", margin: 0 }}>Facebook yayını etkilenmiyor.</p>
          <button type="button" className="btn" style={{ marginTop: 8, fontSize: 11, minHeight: 32, padding: "0 10px" }} onClick={() => setWarningOpen((o) => !o)}>
            {warningOpen ? "Detayı gizle ▲" : "Detay ▼"}
          </button>
          {warningOpen && (
            <p style={{ fontSize: 11, color: "#9fb0c5", marginTop: 8 }}>HARD BLOCKED — Business Portfolio sorunu çözülene kadar otomatik/manuel yayın yapılamaz.</p>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, margin: "14px 0 10px" }}>
          {(["", "Safira", "Destan"] as const).map((v) => (
            <button key={v || "all"} className="btn" style={{ flex: 1, background: villa === v ? "#d5aa58" : undefined, color: villa === v ? "#1a1408" : undefined }} onClick={() => setVilla(v)}>
              {v || "Tümü"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {([["", "Tümü"], ["planned", "Planlanan"], ["published", "Yayınlanan"], ["failed", "Başarısız"]] as const).map(([v, label]) => (
            <button key={v || "bucket-all"} className="btn" style={{ flex: 1, fontSize: 11, background: bucket === v ? "#d5aa58" : undefined, color: bucket === v ? "#1a1408" : undefined }} onClick={() => setBucket(v)}>
              {label}
            </button>
          ))}
        </div>

        {loading && <Skeleton count={4} />}
        {error && <ErrorState text={error} onRetry={reload} />}
        {data && filtered.length === 0 && <EmptyState text="İçerik bulunamadı." />}

        {filtered.map((post) => {
          const main = mainStatus(post);
          return (
            <button
              type="button"
              key={post.id}
              className="list-item"
              style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "none", padding: 0, cursor: "pointer" }}
              onClick={() => setDetailPost(post)}
            >
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <MediaPreview url={post.mediaUrl} isVideo={post.contentType === "Reels"} />
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>Villa {post.villa} · {post.platform}</div>
                  <div style={{ fontSize: 11, color: "#9fb0c5", marginTop: 2 }}>{post.contentType}</div>
                  <div style={{ fontSize: 11, color: "#9fb0c5", marginTop: 2 }}>
                    {formatDate(post.scheduledDate)}{post.scheduledTime ? ` · ${post.scheduledTime}` : ""}
                  </div>
                  <span className="badge" style={{ marginTop: 8, background: TONE_BG[main.tone], color: TONE_COLOR[main.tone] }}>{main.label}</span>
                  <p style={{
                    fontSize: 12, color: "#b8c6d8", margin: "8px 0 0",
                    display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>{post.caption}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <BottomSheet open={!!detailPost} onClose={() => setDetailPost(null)} title="Paylaşım Detayı">
        {detailPost && (() => {
          const main = mainStatus(detailPost);
          return (
            <>
              <MediaPreview url={detailPost.mediaUrl} isVideo={detailPost.contentType === "Reels"} tall />
              <div style={{ marginTop: detailPost.mediaUrl ? 12 : 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Villa {detailPost.villa} · {detailPost.platform}</div>
                <div style={{ fontSize: 12, color: "#9fb0c5", marginTop: 4 }}>{detailPost.contentType}</div>
                <div style={{ fontSize: 12, color: "#9fb0c5", marginTop: 4 }}>
                  {formatDate(detailPost.scheduledDate)}{detailPost.scheduledTime ? ` · ${detailPost.scheduledTime}` : ""}
                </div>
                <span className="badge" style={{ marginTop: 10, background: TONE_BG[main.tone], color: TONE_COLOR[main.tone] }}>{main.label}</span>
                {detailPost.destanInstagramHardBlocked && <span className="badge badge-danger" style={{ marginLeft: 6, marginTop: 10 }}>Destan Instagram — HARD BLOCK</span>}
                <p style={{ fontSize: 13, marginTop: 12, whiteSpace: "pre-wrap" }}>{detailPost.caption}</p>
                {detailPost.lastPublishError && (
                  <div className="card" style={{ borderColor: "#7f1d1d", marginTop: 12 }}>
                    <div className="card-title" style={{ color: "#fca5a5" }}>Yayın Hatası</div>
                    <p style={{ fontSize: 12, margin: "6px 0 0" }}>{detailPost.lastPublishError}</p>
                  </div>
                )}
                <p style={{ fontSize: 10, color: "#6b7787", marginTop: 12 }}>
                  Onay durumu: {detailPost.approvalStatus} · Otomasyon sınıfı: {detailPost.automationClass ?? "—"}
                </p>
              </div>
            </>
          );
        })()}
      </BottomSheet>
    </div>
  );
}
