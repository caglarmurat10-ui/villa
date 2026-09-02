import { useState } from "react";
import { TopBar, Skeleton, ErrorState, EmptyState, Badge } from "../components/common";
import { useApi } from "../lib/useApi";

interface SocialPost {
  id: string; villa: "Safira" | "Destan"; platform: string; contentType: string;
  caption: string; mediaUrl: string; scheduledDate: string; scheduledTime: string | null;
  status: string; approvalStatus: string; lastPublishError: string | null;
  automationClass: "AUTO_SAFE" | "REVIEW_REQUIRED" | "BLOCKED" | null;
  destanInstagramHardBlocked: boolean;
}

const classTone = { AUTO_SAFE: "success", REVIEW_REQUIRED: "warning", BLOCKED: "danger" } as const;

export function SocialScreen() {
  const [villa, setVilla] = useState<"" | "Safira" | "Destan">("");
  const { data, loading, error, reload } = useApi<{ posts: SocialPost[] }>(`/social${villa ? `?villa=${villa}` : ""}`, [villa]);

  return (
    <div>
      <TopBar title="Sosyal Medya" />
      <div className="app-content">
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["", "Safira", "Destan"] as const).map((v) => (
            <button key={v || "all"} className="btn" style={{ flex: 1, background: villa === v ? "#d5aa58" : undefined, color: villa === v ? "#1a1408" : undefined }} onClick={() => setVilla(v)}>
              {v || "Tümü"}
            </button>
          ))}
        </div>

        {loading && <Skeleton count={5} />}
        {error && <ErrorState text={error} onRetry={reload} />}
        {data && data.posts.length === 0 && <EmptyState text="İçerik bulunamadı." />}
        {data?.posts.map((post) => (
          <div className="card" key={post.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>Villa {post.villa} · {post.platform} · {post.contentType}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {post.automationClass && <Badge tone={classTone[post.automationClass]}>{post.automationClass}</Badge>}
                {post.destanInstagramHardBlocked && <Badge tone="danger">HARD BLOCK</Badge>}
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#b8c6d8", margin: "8px 0", maxHeight: 60, overflow: "hidden" }}>{post.caption}</p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9fb0c5" }}>
              <span>{post.scheduledDate}{post.scheduledTime ? ` · ${post.scheduledTime}` : ""}</span>
              <span>{post.status === "Yayınlandı" ? "✓ Yayınlandı" : post.lastPublishError ? "✗ Başarısız" : post.approvalStatus}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
