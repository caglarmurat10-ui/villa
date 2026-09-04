"use client";

import { useEffect, useState } from "react";
import type { MetaSocialAccount } from "@/lib/meta-store";
import { DESTAN_INSTAGRAM_HARD_BLOCK, isMetaTargetHardBlocked } from "@/lib/social-account-policy";
import type { Villa } from "@/lib/types";

const villas: Villa[] = ["Destan", "Safira"];
const platforms = ["Instagram", "Facebook"] as const;
type Platform = (typeof platforms)[number];

const stageLabels: Record<string, string> = {
  state: "state doğrulama",
  "nonce-cookie": "güvenlik çerezi",
  "code-exchange": "erişim anahtarı",
  "permission-check": "Facebook izinleri",
  "page-fetch": "Facebook Sayfalarını alma",
  "selection-save": "güvenli seçim oturumu",
  "selection-validate": "Sayfa seçimi doğrulama",
  "task-check": "Sayfa yayın yetkisi",
  "profile-fetch": "profil bilgisi",
  "account-save": "güvenli hesap kaydı",
  "database-save": "veritabanı kaydı",
};

export default function MetaConnections({ initialAccounts }: { initialAccounts: MetaSocialAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("meta_connected");
    const error = params.get("meta_error");
    const stage = params.get("meta_stage");
    const brand = params.get("meta_brand");
    const joint = params.get("meta_joint") === "1";
    const platform = params.get("meta_platform") === "Facebook" ? "Facebook" : "Instagram";

    if (error) {
      const stageText = stage ? stageLabels[stage] ?? stage : "bağlantı";
      setNotice(`${platform} bağlantısı tamamlanamadı · ${stageText}: ${error}`);
    } else if (connected) {
      if (platform === "Facebook" && joint) {
        const brandText = brand === "applied"
          ? " Marka ayarları iki Sayfaya da uygulandı."
          : brand === "partial"
            ? " Bağlantılar tamamlandı; bazı marka alanları Marka Merkezi'nden tekrar uygulanabilir."
            : brand === "failed"
              ? " Bağlantılar tamamlandı; marka alanları daha sonra Marka Merkezi'nden uygulanabilir."
              : "";
        setNotice(`Safira ve Destan Facebook Sayfaları aynı Meta yetkilendirme oturumuyla birlikte bağlandı.${brandText}`);
      } else if (platform === "Facebook" && brand === "applied") {
        setNotice(`Villa ${connected} Facebook Sayfası bağlandı; Hakkında metni, profil logosu ve kapak görseli otomatik uygulandı.`);
      } else if (platform === "Facebook" && brand === "partial") {
        setNotice(`Villa ${connected} Facebook Sayfası bağlandı; marka ayarlarının bir bölümü uygulandı. Marka Merkezi'nden güvenle tekrar deneyebilirsiniz.`);
      } else if (platform === "Facebook" && brand === "failed") {
        setNotice(`Villa ${connected} Facebook Sayfası bağlandı. Marka ayarları otomatik uygulanamadı; bağlantı korunuyor ve Marka Merkezi'nden tekrar denenebilir.`);
      } else {
        setNotice(`Villa ${connected} ${platform} hesabı başarıyla bağlandı.`);
      }
    }

    if (error || connected || stage || brand || joint || params.has("meta_platform")) {
      params.delete("meta_error");
      params.delete("meta_stage");
      params.delete("meta_connected");
      params.delete("meta_platform");
      params.delete("meta_brand");
      params.delete("meta_joint");
      const query = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
  }, []);

  async function disconnect(villa: Villa, platform: Platform) {
    if (!confirm(`Villa ${villa} ${platform} bağlantısı kaldırılsın mı?`)) return;
    const response = await fetch(`/api/meta/connections?villa=${villa}&platform=${platform}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setAccounts((items) => items.filter((item) => !(item.villa === villa && item.platform === platform)));
      setNotice(`Villa ${villa} ${platform} bağlantısı kaldırıldı.`);
    } else {
      setNotice(data.error ?? "Bağlantı kaldırılamadı.");
    }
  }

  return <section className="meta-connect-box">
    <div className="meta-connect-head"><div><span className="eyebrow">META BAĞLANTILARI</span><h2>Instagram ve Facebook hesaplarını Villa Yönetim'e bağla</h2><p>Safira Instagram ayrı tutulur. Facebook ise Safira ve Destan için tek ortak Meta OAuth oturumuyla bağlanır; iki Sayfa aynı ekranda açıkça eşleştirilir ve iki güncel Page tokenı birlikte private KV'ye yazılır. Otomatik isim eşleştirmesi yapılmaz.</p></div></div>
    {notice ? <p className="message">{notice}</p> : null}
    <div className="meta-account-grid">{villas.flatMap((villa) => platforms.map((platform) => {
      const account = accounts.find((item) => item.villa === villa && item.platform === platform);
      if (isMetaTargetHardBlocked(villa, platform)) {
        return <article key={`${villa}-${platform}`}>
          <div><strong>Villa {villa}</strong><span>{platform}</span></div>
          <p><strong>HARD BLOCK · bağlantı ve yayın kapalı</strong></p>
          <p>{DESTAN_INSTAGRAM_HARD_BLOCK.reason}</p>
        </article>;
      }

      const connectHref = platform === "Instagram"
        ? `/api/meta/instagram/connect?villa=${villa}`
        : "/api/meta/facebook/connect?villa=Safira";
      return <article key={`${villa}-${platform}`} className={account ? "connected" : ""}>
        <div><strong>Villa {villa}</strong><span>{platform}</span></div>
        {account ? <>
          <p>{platform === "Instagram" ? `@${account.username}` : account.username}</p>
          <div className="meta-actions">
            <span className="meta-ok">✓ Bağlı</span>
            <a href={connectHref} style={{fontSize:10,fontWeight:900,color:"#93c5fd",textDecoration:"none"}}>{platform === "Facebook" ? "İki Sayfayı birlikte yenile" : "Yeniden bağla"}</a>
            <button onClick={() => disconnect(villa, platform)}>Bağlantıyı kaldır</button>
          </div>
        </> : <>
          <p>{platform === "Facebook" ? "Safira ve Destan Facebook bağlantısı tek oturumda birlikte yapılacak" : "Henüz bağlanmadı"}</p>
          <a className="meta-connect-button" href={connectHref}>{platform === "Facebook" ? "Facebook'u birlikte bağla" : "Instagram'u bağla"}</a>
        </>}
      </article>;
    }))}</div>
  </section>;
}
