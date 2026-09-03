import Link from "next/link";

// Root seviyede: middleware.ts eslesmeyen host/path'leri zaten kendi notFound()'iyle
// (X-Robots-Tag: noindex,nofollow) yakalıyor - bu sayfa asıl olarak gecerli bir route icinde
// gecersiz bir dinamik parametre (orn. /rehber/olmayan-slug, /villa-safira gibi olmayan bir
// [slug]) Next'in kendi notFound() cagrisini tetikledigi durumu markali gosterir.
export default function NotFound() {
  return (
    <main style={{ minHeight: "70vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", gap: 14 }}>
      <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, color: "#7c8ba1" }}>SAFIRA &amp; DESTAN VILLAS</span>
      <h1 style={{ fontSize: 28, margin: 0 }}>Sayfa bulunamadı</h1>
      <p style={{ maxWidth: 420, color: "#64748b", margin: 0 }}>Aradığınız sayfa taşınmış veya kaldırılmış olabilir.</p>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <Link href="/" style={{ padding: "10px 16px", borderRadius: 9, background: "#4338ca", color: "#fff", fontWeight: 800, textDecoration: "none" }}>Ana sayfa</Link>
        <Link href="/rehber" style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid #cbd5e1", color: "#334155", fontWeight: 800, textDecoration: "none" }}>Bölge rehberi</Link>
      </div>
    </main>
  );
}
