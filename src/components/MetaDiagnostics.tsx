import type { MetaDiagnostic } from "@/lib/meta-diagnostics";

function Status({ ok, label }: { ok: boolean; label: string }) {
  return <span className={ok ? "diag-ok" : "diag-bad"}>{ok ? "✓" : "!"} {label}</span>;
}

export default function MetaDiagnostics({ diagnostic }: { diagnostic: MetaDiagnostic }) {
  const configReady = Object.values(diagnostic.configuration).every(Boolean);
  const accountsReady = diagnostic.accounts.connected === diagnostic.accounts.expected;

  return <section className="meta-diagnostic-box">
    <div className="meta-diagnostic-head">
      <div><span className="eyebrow">META DURUM / TANILAMA</span><h2>Instagram + Facebook yayın altyapısı</h2><p>Secret değerleri gösterilmez. Bu bölüm yalnızca gerekli yapılandırmanın ve hesap bağlantılarının hazır olup olmadığını kontrol eder.</p></div>
      <div className={configReady && accountsReady ? "diag-summary ready" : "diag-summary"}>{configReady && accountsReady ? "Yayına hazır" : "Kurulum devam ediyor"}</div>
    </div>

    <div className="diag-grid">
      <article><h3>Cloudflare yapılandırması</h3><div className="diag-statuses">
        <Status ok={diagnostic.configuration.appId} label="META_APP_ID" />
        <Status ok={diagnostic.configuration.appSecret} label="META_APP_SECRET" />
        <Status ok={diagnostic.configuration.baseUrl} label="APP_BASE_URL" />
        <Status ok={diagnostic.configuration.database} label="D1 / DB" />
      </div><p>Graph API: <strong>{diagnostic.graphApiVersion}</strong></p></article>

      <article><h3>Hesap bağlantıları</h3><p><strong>{diagnostic.accounts.connected}/{diagnostic.accounts.expected}</strong> bağlantı hazır</p>{diagnostic.accounts.missing.length ? <ul>{diagnostic.accounts.missing.map((item) => <li key={item}>{item} bekleniyor</li>)}</ul> : <p className="diag-complete">Safira ve Destan Instagram/Facebook bağlantıları tamam.</p>}</article>
    </div>

    <div className="diag-callbacks">
      <h3>Meta Developer callback adresleri</h3>
      <label>Instagram OAuth redirect URI<code>{diagnostic.callbacks.instagram || "APP_BASE_URL bekleniyor"}</code></label>
      <label>Facebook OAuth redirect URI<code>{diagnostic.callbacks.facebook || "APP_BASE_URL bekleniyor"}</code></label>
    </div>

    <div className="diag-scopes">
      <div><strong>Instagram izinleri</strong><p>{diagnostic.requiredScopes.instagram.join(" · ")}</p></div>
      <div><strong>Facebook izinleri</strong><p>{diagnostic.requiredScopes.facebook.join(" · ")}</p></div>
    </div>
  </section>;
}
