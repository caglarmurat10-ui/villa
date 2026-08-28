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
        setNotice(`Villa ${villa}: Facebook profil logosu ve kapak görseli uygulandı.`);
      } else if (response.ok && data.success) {
        setNotice(`Villa ${villa}: Marka görsellerinden biri uygulandı. Diğeri Meta tarafından reddedildi; bağlantıyı yenileyip tekrar deneyebilirsiniz.`);
      } else {
        setNotice(data.error ?? data.profileError ?? data.coverError ?? `Villa ${villa} marka görselleri uygulanamadı.`);
      }
    } catch {
      setNotice("Facebook marka otomasyonuna bağlanılamadı.");
    } finally {
      setWorking(null);
    }
  }

  return <section className="facebook-brand-automation">
    <div><span className="eyebrow">FACEBOOK OTOMATİK MARKA</span><h2>Profil + kapak görsellerini Sayfalara uygula</h2><p>`pages_manage_metadata` izniyle profil PNG ve gerçek villa fotoğraflı kapak otomatik uygulanır. Bağlantı sırasında da otomatik denenir.</p></div>
    {notice ? <p className="message">{notice}</p> : null}
    <div className="facebook-brand-buttons">{villas.map((villa) => {
      const account = accounts.find((item) => item.villa === villa && item.platform === "Facebook");
      return account
        ? <button type="button" key={villa} disabled={working !== null} onClick={() => apply(villa)}>{working === villa ? "Uygulanıyor…" : `Villa ${villa} Facebook markasını uygula`}</button>
        : <a key={villa} href={`/api/meta/facebook/connect?villa=${villa}`}>Villa {villa} Facebook'u bağla</a>;
    })}</div>
  </section>;
}
