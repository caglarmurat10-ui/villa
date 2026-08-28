"use client";

import { useEffect, useState } from "react";
import type { MetaSocialAccount } from "@/lib/meta-store";
import type { Villa } from "@/lib/types";

const villas: Villa[] = ["Destan", "Safira"];
const platforms = ["Instagram", "Facebook"] as const;
type Platform = (typeof platforms)[number];

const stageLabels: Record<string, string> = {
  state: "state doğrulama",
  "nonce-cookie": "güvenlik çerezi",
  "code-exchange": "erişim anahtarı",
  "page-fetch": "Facebook Sayfalarını alma",
  "selection-save": "güvenli seçim oturumu",
  "selection-validate": "Sayfa seçimi doğrulama",
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
    const platform = params.get("meta_platform") === "Facebook" ? "Facebook" : "Instagram";

    if (error) {
      const stageText = stage ? stageLabels[stage] ?? stage : "bağlantı";
      setNotice(`${platform} bağlantısı tamamlanamadı · ${stageText}: ${error}`);
    } else if (connected) {
      setNotice(`Villa ${connected} ${platform} hesabı başarıyla bağlandı.`);
    }

    if (error || connected || stage || params.has("meta_platform")) {
      params.delete("meta_error");
      params.delete("meta_stage");
      params.delete("meta_connected");
      params.delete("meta_platform");
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
    <div className="meta-connect-head"><div><span className="eyebrow">META BAĞLANTILARI</span><h2>Instagram ve Facebook hesaplarını Villa Yönetim'e bağla</h2><p>Safira ve Destan hesapları ayrı tutulur. Facebook'ta otomatik isim eşleştirmesi yapılmaz; OAuth sonrasında doğru Sayfayı siz açıkça seçersiniz. Facebook Page tokenları D1'e yazılmaz, şifreli private KV'de saklanır.</p></div></div>
    {notice ? <p className="message">{notice}</p> : null}
    <div className="meta-account-grid">{villas.flatMap((villa) => platforms.map((platform) => {
      const account = accounts.find((item) => item.villa === villa && item.platform === platform);
      const connectHref = platform === "Instagram"
        ? `/api/meta/instagram/connect?villa=${villa}`
        : `/api/meta/facebook/connect?villa=${villa}`;
      return <article key={`${villa}-${platform}`} className={account ? "connected" : ""}>
        <div><strong>Villa {villa}</strong><span>{platform}</span></div>
        {account ? <>
          <p>{platform === "Instagram" ? `@${account.username}` : account.username}</p>
          <div className="meta-actions"><span className="meta-ok">✓ Bağlı</span><button onClick={() => disconnect(villa, platform)}>Bağlantıyı kaldır</button></div>
        </> : <>
          <p>{platform === "Facebook" ? "Bağlantıdan sonra Sayfa seçimi yapılacak" : "Henüz bağlanmadı"}</p>
          <a className="meta-connect-button" href={connectHref}>{platform}'u bağla</a>
        </>}
      </article>;
    }))}</div>
  </section>;
}
