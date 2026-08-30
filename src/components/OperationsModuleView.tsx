import Link from "next/link";
import type { PriceRange, Reservation, Villa, VillaLocations } from "@/lib/types";

export type OperationsModule = "rezervasyonlar" | "villalar" | "misafirler" | "gorevler" | "temizlik" | "bakim" | "finans" | "raporlar" | "ayarlar";

const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const villas: Villa[] = ["Safira", "Destan"];
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date()); }
function fmt(value: string) { return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }
function nights(start: string, end: string) { return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 86400000)); }
function addDays(value: string, amount: number) { const d = new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10); }

const titles: Record<OperationsModule, [string, string]> = {
  rezervasyonlar: ["Rezervasyonlar", "Aktif ve tamamlanan konaklamaları tek listede izleyin; düzenleme ve yeni kayıt için ana panele geçin."],
  villalar: ["Villalar", "Safira ve Destan'ın doluluk, fiyat ve konum durumunu ayrı takip edin."],
  misafirler: ["Misafirler", "Tekrarlayan misafirleri, toplam konaklamaları ve iletişim bilgisini görün."],
  gorevler: ["Görevler", "Yaklaşan giriş ve çıkış operasyonlarını tarih sırasıyla takip edin."],
  temizlik: ["Temizlik", "Çıkış ve aynı gün yeni giriş olan devir günlerini öncelikli görün."],
  bakim: ["Bakım", "Villa bazlı operasyonel bakım kontrol alanı."],
  finans: ["Finans", "Brüt gelir, alınan ödeme ve kalan tahsilatı villa bazında izleyin."],
  raporlar: ["Raporlar", "Konaklama geceleri ve gelir performansını villa bazında karşılaştırın."],
  ayarlar: ["Ayarlar", "Konum, komisyon ve dönemsel fiyat yapılandırmasını kontrol edin."],
};

export default function OperationsModuleView({ module, reservations, prices, locations, commission }: { module: OperationsModule; reservations: Reservation[]; prices: PriceRange[]; locations: VillaLocations; commission: number }) {
  const now = today();
  const [title, description] = titles[module];
  const active = reservations.filter((r) => r.checkOut >= now);
  const totals = reservations.reduce((a, r) => ({ total: a.total + r.totalAmount, paid: a.paid + r.paidAmount }), { total: 0, paid: 0 });

  return <main className="ops-page">
    <header className="ops-page-head"><div><span className="ops-eyebrow">VİLLA YÖNETİM / OPERASYON</span><h1>{title}</h1><p>{description}</p></div><div className="ops-actions"><Link className="ops-button secondary" href="/">Ana panele dön</Link>{module !== "rezervasyonlar" ? <Link className="ops-button" href="/rezervasyonlar">Rezervasyonlar</Link> : <Link className="ops-button" href="/#reservation-form">＋ Yeni rezervasyon</Link>}</div></header>
    {renderModule(module, reservations, active, prices, locations, commission, totals, now)}
  </main>;
}

function renderModule(module: OperationsModule, reservations: Reservation[], active: Reservation[], prices: PriceRange[], locations: VillaLocations, commission: number, totals: { total: number; paid: number }, now: string) {
  if (module === "rezervasyonlar") return <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Villa</th><th>Misafir</th><th>Giriş</th><th>Çıkış</th><th>Kanal</th><th>Toplam</th><th>Kalan</th><th>Durum</th></tr></thead><tbody>{reservations.map((r) => <tr key={r.id}><td><span className="ops-pill">{r.villa}</span></td><td><strong>{r.guestName}</strong><br/><small>{r.phone || "Numara yok"}</small></td><td>{fmt(r.checkIn)}</td><td>{fmt(r.checkOut)}</td><td>{r.channel}</td><td>{money.format(r.totalAmount)}</td><td>{money.format(r.totalAmount-r.paidAmount)}</td><td>{r.checkOut >= now ? "Aktif" : "Tamamlandı"}</td></tr>)}</tbody></table></div>;

  if (module === "villalar") return <div className="ops-grid">{villas.map((villa) => { const rows = reservations.filter((r) => r.villa === villa); const current = rows.find((r) => r.checkIn <= now && r.checkOut > now); const next = rows.find((r) => r.checkIn >= now); return <article className="ops-card" key={villa}><span className="ops-eyebrow">VILLA {villa.toUpperCase()}</span><h3>{current ? "Dolu" : "Müsait / rezervasyon bekleniyor"}</h3><strong className="big">{rows.filter((r) => r.checkOut >= now).length}</strong><p>aktif/gelecek rezervasyon</p><p><b>Şu an:</b> {current ? current.guestName : "Konaklama yok"}</p><p><b>Sonraki giriş:</b> {next ? `${fmt(next.checkIn)} · ${next.guestName}` : "Planlı giriş yok"}</p><p><b>Konum:</b> {locations[villa] ? "✓ kayıtlı" : "! eksik"}</p><p><b>Fiyat dönemi:</b> {prices.filter((p) => p.villa === villa).length} kayıt</p></article>; })}</div>;

  if (module === "misafirler") { const grouped = new Map<string,{name:string;phone:string;count:number;nights:number,total:number,last:string}>(); reservations.forEach((r) => { const key=(r.phone||r.guestName).toLocaleLowerCase("tr-TR"); const g=grouped.get(key)??{name:r.guestName,phone:r.phone,count:0,nights:0,total:0,last:r.checkOut}; g.count++; g.nights+=nights(r.checkIn,r.checkOut); g.total+=r.totalAmount; if(r.checkOut>g.last)g.last=r.checkOut; grouped.set(key,g); }); return <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Misafir</th><th>Telefon</th><th>Konaklama</th><th>Gece</th><th>Toplam</th><th>Son çıkış</th></tr></thead><tbody>{[...grouped.values()].sort((a,b)=>b.last.localeCompare(a.last)).map((g)=><tr key={`${g.name}-${g.phone}`}><td><strong>{g.name}</strong></td><td>{g.phone||"—"}</td><td>{g.count}</td><td>{g.nights}</td><td>{money.format(g.total)}</td><td>{fmt(g.last)}</td></tr>)}</tbody></table></div>; }

  if (module === "gorevler") { const until=addDays(now,30); const events=active.flatMap((r)=>[{date:r.checkIn,type:"Giriş",r},{date:r.checkOut,type:"Çıkış",r}]).filter((e)=>e.date>=now&&e.date<=until).sort((a,b)=>a.date.localeCompare(b.date)); return events.length?<div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Tarih</th><th>İşlem</th><th>Villa</th><th>Misafir</th><th>İletişim</th></tr></thead><tbody>{events.map((e)=><tr key={`${e.r.id}-${e.type}`}><td>{fmt(e.date)}</td><td><span className="ops-pill">{e.type}</span></td><td>{e.r.villa}</td><td>{e.r.guestName}</td><td>{e.r.phone||"Numara yok"}</td></tr>)}</tbody></table></div>:<div className="ops-empty">Önümüzdeki 30 günde görev yok.</div>; }

  if (module === "temizlik") { const exits=active.filter((r)=>r.checkOut>=now).sort((a,b)=>a.checkOut.localeCompare(b.checkOut)); return <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Tarih</th><th>Villa</th><th>Çıkış</th><th>Sonraki giriş</th><th>Öncelik</th></tr></thead><tbody>{exits.map((r)=>{const next=reservations.find((x)=>x.villa===r.villa&&x.checkIn===r.checkOut);return <tr key={r.id}><td>{fmt(r.checkOut)}</td><td>{r.villa}</td><td>{r.guestName} · 10:00</td><td>{next?`${next.guestName} · 16:00`:"Aynı gün giriş yok"}</td><td>{next?<span className="ops-pill">HIZLI DEVİR</span>:"Normal"}</td></tr>})}</tbody></table></div>; }

  if (module === "bakim") return <div className="ops-grid">{villas.map((villa)=><article className="ops-card" key={villa}><span className="ops-eyebrow">VILLA {villa.toUpperCase()}</span><h3>Bakım kontrolü</h3><p>• Havuz ve filtrasyon</p><p>• Klima / elektrik</p><p>• Su ve sıcak su</p><p>• İnternet / TV</p><p>• Bahçe ve dış alan</p><p>• Mobilya / tekstil hasar kontrolü</p><small>Kalıcı bakım kaydı için bakım veri tabanı modülü ayrıca bağlanacak.</small></article>)}</div>;

  if (module === "finans") return <><div className="ops-grid"><article className="ops-card"><h3>Brüt gelir</h3><strong className="big">{money.format(totals.total)}</strong></article><article className="ops-card"><h3>Alınan ödeme</h3><strong className="big">{money.format(totals.paid)}</strong></article><article className="ops-card"><h3>Kalan tahsilat</h3><strong className="big">{money.format(totals.total-totals.paid)}</strong></article><article className="ops-card"><h3>Komisyon sonrası</h3><strong className="big">{money.format(totals.total*(1-commission/100))}</strong><small>Komisyon %{commission}</small></article></div><div style={{height:12}}/><div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Villa</th><th>Misafir</th><th>Toplam</th><th>Ödenen</th><th>Kalan</th></tr></thead><tbody>{reservations.filter((r)=>r.totalAmount>r.paidAmount).map((r)=><tr key={r.id}><td>{r.villa}</td><td>{r.guestName}</td><td>{money.format(r.totalAmount)}</td><td>{money.format(r.paidAmount)}</td><td><strong>{money.format(r.totalAmount-r.paidAmount)}</strong></td></tr>)}</tbody></table></div></>;

  if (module === "raporlar") return <div className="ops-grid">{villas.map((villa)=>{const rows=reservations.filter((r)=>r.villa===villa);const total=rows.reduce((s,r)=>s+r.totalAmount,0);const nightCount=rows.reduce((s,r)=>s+nights(r.checkIn,r.checkOut),0);return <article className="ops-card" key={villa}><span className="ops-eyebrow">VILLA {villa.toUpperCase()}</span><h3>{rows.length} rezervasyon</h3><strong className="big">{money.format(total)}</strong><p>{nightCount} toplam gece</p><p>Ortalama rezervasyon: {money.format(rows.length?total/rows.length:0)}</p></article>})}</div>;

  return <div className="ops-grid"><article className="ops-card"><h3>Komisyon</h3><strong className="big">%{commission}</strong><p>Finans özetlerinde kullanılan oran.</p></article>{villas.map((villa)=><article className="ops-card" key={villa}><h3>Villa {villa}</h3><p><b>Konum:</b> {locations[villa]?"✓ kayıtlı":"! eksik"}</p><p><b>Fiyat dönemleri:</b> {prices.filter((p)=>p.villa===villa).length}</p>{prices.filter((p)=>p.villa===villa).slice(0,3).map((p)=><small key={p.id} style={{display:"block",marginTop:5}}>{fmt(p.startDate)} – {fmt(p.endDate)} · {money.format(p.nightlyRate)}</small>)}</article>)}</div>;
}
