"use client";

import { useState } from "react";
import type { MetaSocialAccount } from "@/lib/meta-store";
import type { Villa } from "@/lib/types";

const villas: Villa[] = ["Safira", "Destan"];

export default function FacebookBrandAutomation({ accounts }: { accounts: MetaSocialAccount[] }) {
  const [working, setWorking] = useState<Villa | null>(null);
  const [notice, setNotice] = useState("");

  async function apply(villa: Villa) {
    setWorking(villa);
    setNotice("");
    try {
      const response = await fetch("/api/meta/facebook/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villa }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.complete) {
        setNotice(`Villa ${villa}: Facebook Hakkında metni, profil logosu ve kapak görseli uygulandı.`);
      } else if (response.ok && data.success) {
        const applied = [data.detailsApplied ? "Hakkında" : "", data.profileApplied ? "profil" : "", data.coverApplied ? "kapak" : ""].filter(Boolean).join(" + ");
        setNotice(`Villa ${villa}: ${applied || "marka ayarlarının bir bölümü"} uygulandı. Kalan bölüm için bağlantıyı yenileyip tekrar deneyebilirsiniz.`);
      } else {
        setNotice(data.error ?? data.detailsError ?? data.profileError ?? data.coverError ?? `Villa ${villa} marka ayarları uygulanamadı.`);
      }
    } catch {
      setNotice("Facebook marka otomasyonuna bağlanılamadı.");
    } finally {
      setWorking(null);
    }
  }

  return <section className="facebook-brand-automation">
    <div><span className="eyebrow">FACEBOOK OTOMATİK MARKA</span><h2>Sayfa metni + profil + kapak senkronu</h2><p>`pages_manage_metadata` izniyle kontrollü Hakkında metinleri, profil PNG ve gerçek villa fotoğraflı kapak otomatik uygulanır. Sayfa adı, kullanıcı adı, telefon, web sitesi ve kategori doğrulanmadan otomatik değiştirilmez.</p></div>
    {notice ? <p className="message">{notice}</p> : null}
    <div className="facebook-brand-buttons">{villas.map((villa) => {
      const account = accounts.find((item) => item.villa === villa && item.platform === "Facebook");
      return account
        ? <button type="button" key={villa} disabled={working !== null} onClick={() => apply(villa)}>{working === villa ? "Senkronlanıyor…" : `Villa ${villa} Facebook ayarlarını senkronla`}</button>
        : <a key={villa} href={`/api/meta/facebook/connect?villa=${villa}`}>Villa {villa} Facebook'u bağla</a>;
    })}</div>
  </section>;
}
