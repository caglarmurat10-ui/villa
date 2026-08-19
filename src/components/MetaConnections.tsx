"use client";

import { useState } from "react";
import type { MetaSocialAccount } from "@/lib/meta-store";
import type { Villa } from "@/lib/types";

const villas: Villa[] = ["Destan", "Safira"];

export default function MetaConnections({ initialAccounts }: { initialAccounts: MetaSocialAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [notice, setNotice] = useState("");

  async function disconnect(villa: Villa) {
    if (!confirm(`Villa ${villa} Instagram bağlantısı kaldırılsın mı?`)) return;
    const response = await fetch(`/api/meta/connections?villa=${villa}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setAccounts((items) => items.filter((item) => item.villa !== villa));
      setNotice(`Villa ${villa} Instagram bağlantısı kaldırıldı.`);
    } else setNotice(data.error ?? "Bağlantı kaldırılamadı.");
  }

  return <section className="meta-connect-box">
    <div className="meta-connect-head"><div><span className="eyebrow">META BAĞLANTILARI</span><h2>Instagram hesaplarını Villa Yönetim'e bağla</h2><p>Bir kez yetki verildikten sonra paylaşım ve performans işlemlerini buradan yöneteceğiz.</p></div></div>
    {notice ? <p className="message">{notice}</p> : null}
    <div className="meta-account-grid">{villas.map((villa) => {
      const account = accounts.find((item) => item.villa === villa && item.platform === "Instagram");
      return <article key={villa} className={account ? "connected" : ""}>
        <div><strong>Villa {villa}</strong><span>Instagram</span></div>
        {account ? <><p>@{account.username}</p><div className="meta-actions"><span className="meta-ok">✓ Bağlı</span><button onClick={() => disconnect(villa)}>Bağlantıyı kaldır</button></div></> : <><p>Henüz bağlanmadı</p><a className="meta-connect-button" href={`/api/meta/instagram/connect?villa=${villa}`}>Instagram'ı bağla</a></>}
      </article>;
    })}</div>
  </section>;
}
