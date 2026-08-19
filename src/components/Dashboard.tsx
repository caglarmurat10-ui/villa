"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { PriceRange, Reservation, Villa } from "@/lib/types";

type View = "dashboard" | "calendar" | "messages" | "cleaning" | "reports" | "calculator" | "settings";
const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const today = new Date().toISOString().slice(0, 10);
const menu: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Ana Takip", icon: "⌂" }, { id: "calendar", label: "Takvim", icon: "▦" },
  { id: "messages", label: "Mesajlar", icon: "✉" }, { id: "cleaning", label: "Temizlik", icon: "✦" },
  { id: "reports", label: "Raporlar", icon: "▥" }, { id: "calculator", label: "Hesaplama", icon: "₺" }, { id: "settings", label: "Ayarlar", icon: "⚙" },
];

export default function Dashboard({ initialReservations, initialCommission, initialPrices }: { initialReservations: Reservation[]; initialCommission: number; initialPrices: PriceRange[] }) {
  const [reservations, setReservations] = useState(initialReservations);
  const [villaFilter, setVillaFilter] = useState<"Tümü" | Villa>("Tümü");
  const [recordFilter, setRecordFilter] = useState<"active" | "completed">("active");
  const [search,setSearch]=useState(""),[channelFilter,setChannelFilter]=useState("Tümü"),[paymentFilter,setPaymentFilter]=useState("Tümü");
  const [view, setView] = useState<View>("dashboard");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [commission, setCommission] = useState(initialCommission);
  const [prices, setPrices] = useState(initialPrices);

  const visible = useMemo(() => reservations.filter((r) => (villaFilter === "Tümü" || r.villa === villaFilter) && (!search || r.guestName.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR"))) && (channelFilter === "Tümü" || r.channel === channelFilter) && (paymentFilter === "Tümü" || (paymentFilter === "Ödendi" ? r.paidAmount >= r.totalAmount : r.paidAmount < r.totalAmount))), [reservations, villaFilter, search, channelFilter, paymentFilter]);
  const active = visible.filter((r) => r.checkOut >= today);
  const totals = visible.reduce((acc, r) => ({ revenue: acc.revenue + r.totalAmount, paid: acc.paid + r.paidAmount }), { revenue: 0, paid: 0 });

  async function refresh() {
    const response = await fetch("/api/reservations", { cache: "no-store" });
    const data = await response.json(); setReservations(data.reservations ?? []);
  }
  async function remove(id: string) {
    if (!confirm("Bu rezervasyonu silmek istediğinize emin misiniz?")) return;
    const response = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
    if (response.ok) await refresh(); else setMessage("Kayıt silinemedi.");
  }
  async function updatePayment(reservation: Reservation) {
    const value = prompt(`Toplam: ${money.format(reservation.totalAmount)}\nAlınan toplam ödeme:`, String(reservation.paidAmount));
    if (value === null) return;
    const response = await fetch(`/api/reservations/${reservation.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({paidAmount:Number(value)}) });
    const data = await response.json(); if(response.ok) await refresh(); else setMessage(data.error ?? "Ödeme güncellenemedi.");
  }

  return <main>
    <header className="topbar">
      <div><span className="eyebrow">BAĞIMSIZ YÖNETİM PANELİ</span><h1>Villa Yönetim</h1><p>Safira ve Destan tek, güvenli takvimde.</p></div>
      <a className="backup" href="/api/backup">Yedeği indir</a>
    </header>
    <nav className="main-menu" aria-label="Ana menü">
      {menu.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><i>{item.icon}</i>{item.label}{item.id === "messages" && <small>{active.length}</small>}</button>)}
    </nav>
    <section className="filters" aria-label="Villa filtresi">
      {(["Tümü", "Safira", "Destan"] as const).map((villa) => <button key={villa} className={villaFilter === villa ? "active" : ""} onClick={() => setVillaFilter(villa)}>{villa}</button>)}
    </section>
    <section className="advanced-filters"><input aria-label="Müşteri ara" placeholder="Müşteri ara…" value={search} onChange={(e)=>setSearch(e.target.value)} /><select aria-label="Kanal filtresi" value={channelFilter} onChange={(e)=>setChannelFilter(e.target.value)}><option>Tümü</option><option>Doğrudan</option><option>Booking</option><option>Airbnb</option><option>Diğer</option></select><select aria-label="Ödeme filtresi" value={paymentFilter} onChange={(e)=>setPaymentFilter(e.target.value)}><option>Tümü</option><option>Ödendi</option><option>Ödenmedi</option></select>{(search||channelFilter!=="Tümü"||paymentFilter!=="Tümü")?<button onClick={()=>{setSearch("");setChannelFilter("Tümü");setPaymentFilter("Tümü");}}>Temizle</button>:null}</section>

    {view === "dashboard" && <>
      <Stats count={active.length} revenue={totals.revenue} paid={totals.paid} commission={commission} />
      <Operations reservations={visible} />
      <div className="record-tabs"><button className={recordFilter === "active" ? "active" : ""} onClick={() => setRecordFilter("active")}>Aktif ({visible.filter((r)=>r.checkOut>=today).length})</button><button className={recordFilter === "completed" ? "active" : ""} onClick={() => setRecordFilter("completed")}>Tamamlanan ({visible.filter((r)=>r.checkOut<today).length})</button></div>
      {message ? <p className="message dashboard-message">{message}</p> : null}
      <div className="layout"><ReservationList reservations={visible.filter((r)=>recordFilter === "active" ? r.checkOut>=today : r.checkOut<today)} remove={remove} edit={setEditing} payment={updatePayment} />
        <ReservationForm key={editing?.id??"new"} editing={editing} onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); await refresh(); }} />
      </div>
    </>}
    {view === "calendar" && <CalendarView reservations={visible} />}
    {view === "messages" && <MessagesView reservations={active} />}
    {view === "cleaning" && <CleaningView reservations={reservations} />}
    {view === "reports" && <ReportsView reservations={visible} commission={commission} />}
    {view === "calculator" && <CalculatorView />}
    {view === "settings" && <SettingsView count={reservations.length} commission={commission} setCommission={setCommission} prices={prices} setPrices={setPrices} />}
  </main>;
}

function Stats({ count, revenue, paid, commission }: { count: number; revenue: number; paid: number; commission: number }) {
  const commissionAmount = revenue * commission / 100;
  return <section className="stats"><article><span>Aktif rezervasyon</span><strong>{count}</strong></article><article><span>Brüt gelir</span><strong>{money.format(revenue)}</strong></article><article><span>Net gelir</span><strong>{money.format(revenue-commissionAmount)}</strong></article><article><span>Kalan ödeme</span><strong>{money.format(revenue-paid)}</strong></article></section>;
}
function Operations({ reservations }: { reservations: Reservation[] }) {
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate()+7); const nextWeekStr=nextWeek.toISOString().slice(0,10);
  const arrivals=reservations.filter((r)=>r.checkIn===today), departures=reservations.filter((r)=>r.checkOut===today), upcoming=reservations.filter((r)=>r.checkIn>today&&r.checkIn<=nextWeekStr);
  const channels=(["Doğrudan","Booking","Airbnb","Diğer"] as const).map((channel)=>({channel,count:reservations.filter((r)=>r.channel===channel).length})).filter((x)=>x.count>0);
  return <section className="operations"><article><span>Bugün giriş</span><strong>{arrivals.length}</strong><small>{arrivals.map((r)=>`${r.guestName} · ${r.villa}`).join(", ")||"Giriş yok"}</small></article><article><span>Bugün çıkış</span><strong>{departures.length}</strong><small>{departures.map((r)=>`${r.guestName} · ${r.villa}`).join(", ")||"Çıkış yok"}</small></article><article><span>7 günlük giriş</span><strong>{upcoming.length}</strong><small>{upcoming.length?"Yaklaşan misafirler var":"Plan sakin"}</small></article><article><span>Kanal dağılımı</span><div className="channel-badges">{channels.map((x)=><b key={x.channel}>{x.channel} {x.count}</b>)}</div></article></section>;
}
function ReservationList({ reservations, remove, edit, payment }: { reservations: Reservation[]; remove: (id: string) => void; edit: (item: Reservation) => void; payment: (item: Reservation) => void }) {
  return <section className="panel list-panel"><div className="panel-title"><div><span className="eyebrow">REZERVASYONLAR</span><h2>Konaklama listesi</h2></div><b>{reservations.length} kayıt</b></div><div className="reservation-list">
    {reservations.length === 0 ? <div className="empty">Bu bölümde rezervasyon yok.</div> : reservations.map((r) => <article className="reservation" key={r.id}><div className={`villa-dot ${r.villa.toLowerCase()}`}>{r.villa[0]}</div><div className="guest"><strong>{r.guestName}</strong><span>{r.villa} · {r.channel}</span></div><div className="dates"><strong>{formatDate(r.checkIn)} → {formatDate(r.checkOut)}</strong><span>{nights(r.checkIn, r.checkOut)} gece</span></div><div className="amount"><strong>{money.format(r.totalAmount)}</strong><span className={r.totalAmount-r.paidAmount>0?"due":"paid"}>{r.totalAmount-r.paidAmount>0?`Kalan ${money.format(r.totalAmount-r.paidAmount)}`:"Ödendi ✓"}</span></div><div className="row-actions"><button onClick={()=>edit(r)}>Düzenle</button><button onClick={()=>payment(r)}>Ödeme</button><button className="delete" onClick={() => remove(r.id)}>Sil</button></div></article>)}
  </div></section>;
}
function ReservationForm({ editing, onCancel, onSaved }: { editing: Reservation | null; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [villa,setVilla]=useState<Villa>(editing?.villa??"Safira"),[checkIn,setCheckIn]=useState(editing?.checkIn??""),[checkOut,setCheckOut]=useState(editing?.checkOut??"");
  const [quote,setQuote]=useState<{total:number;nights:number}|null>(null),[quoteError,setQuoteError]=useState(""),[saving,setSaving]=useState(false),[notice,setNotice]=useState("");
  useEffect(()=>{if(!checkIn||!checkOut||checkOut<=checkIn)return;const controller=new AbortController();const timer=setTimeout(async()=>{try{const response=await fetch("/api/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({villa,checkIn,checkOut}),signal:controller.signal});const data=await response.json();if(response.ok){setQuote(data);setQuoteError("");}else{setQuote(null);setQuoteError(data.error);}}catch{}},250);return()=>{clearTimeout(timer);controller.abort();};},[villa,checkIn,checkOut]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const element=event.currentTarget;setSaving(true);setNotice("");const payload=Object.fromEntries(new FormData(element).entries());const response=await fetch(editing?`/api/reservations/${editing.id}`:"/api/reservations",{method:editing?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await response.json();if(response.ok){setNotice(editing?"Rezervasyon güncellendi.":"Rezervasyon kaydedildi.");if(!editing){element.reset();setVilla("Safira");setCheckIn("");setCheckOut("");}await onSaved();}else setNotice(data.error??"İşlem yapılamadı");setSaving(false);}
  return <section className="panel form-panel"><span className="eyebrow">{editing?"KAYDI DÜZENLE":"YENİ KAYIT"}</span><h2>{editing?editing.guestName:"Rezervasyon ekle"}</h2><form key={editing?.id??"new"} onSubmit={submit}>
    <label>Villa<select name="villa" required value={villa} onChange={(e)=>{setVilla(e.target.value as Villa);setQuote(null);setQuoteError("");}}><option>Safira</option><option>Destan</option></select></label>
    <label>Müşteri<input name="guestName" required minLength={2} placeholder="Müşteri" defaultValue={editing?.guestName??""} /></label><input name="phone" type="hidden" defaultValue="" />
    <div className="two"><label>Giriş<input name="checkIn" type="date" required value={checkIn} onChange={(e)=>{setCheckIn(e.target.value);setQuote(null);setQuoteError("");}} /></label><label>Çıkış<input name="checkOut" type="date" required value={checkOut} onChange={(e)=>{setCheckOut(e.target.value);setQuote(null);setQuoteError("");}} /></label></div>
    <label>Kanal<select name="channel" defaultValue={editing?.channel??"Doğrudan"}><option>Doğrudan</option><option>Booking</option><option>Airbnb</option><option>Diğer</option></select></label>
    <div className={`auto-price ${quoteError?"error":""}`}>{quote?`${quote.nights} gece · Otomatik toplam ${money.format(quote.total)}`:quoteError||"Villa ve tarihleri seçince fiyat burada hesaplanır."}</div>
    <label>Alınan ödeme<input name="paidAmount" type="number" min="0" defaultValue={editing?.paidAmount??0} /></label><label>Notlar<textarea name="notes" rows={3} placeholder="İsteğe bağlı" defaultValue={editing?.notes??""} /></label>
    {notice?<p className="message">{notice}</p>:null}<button className="save" disabled={saving||Boolean(quoteError)}>{saving?"Kaydediliyor…":editing?"Değişiklikleri kaydet":"Rezervasyonu kaydet"}</button>{editing?<button type="button" className="cancel" onClick={onCancel}>İptal</button>:null}
  </form></section>;
}
function CalendarView({ reservations }: { reservations: Reservation[] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const year = cursor.getFullYear(), month = cursor.getMonth(), days = new Date(year, month + 1, 0).getDate(), offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthName = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(cursor);
  return <section className="panel calendar-panel"><div className="calendar-head"><button onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button><h2>{monthName}</h2><button onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button></div><div className="calendar-grid">
    {["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"].map((d) => <b className="weekday" key={d}>{d}</b>)}{Array.from({ length: offset }).map((_, i) => <div key={`o${i}`} />)}
    {Array.from({ length: days }, (_, i) => i + 1).map((day) => { const date = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`; const stays = reservations.filter((r) => date >= r.checkIn && date < r.checkOut); return <div className={`day ${date === today ? "today" : ""}`} key={day}><strong>{day}</strong>{stays.map((r) => <span className={r.villa.toLowerCase()} key={r.id}>{r.villa}: {r.guestName}</span>)}</div>; })}
  </div></section>;
}
function MessagesView({ reservations }: { reservations: Reservation[] }) {
  function openMessage(r: Reservation, type: "Giriş" | "Çıkış") { const text = type === "Giriş" ? `Merhaba ${r.guestName}, ${r.villa} villası girişiniz için sizi bekliyoruz. Giriş saati 16:00'dır. İyi yolculuklar.` : `Merhaba ${r.guestName}, konaklamanız için teşekkür ederiz. Çıkış saati 10:00'dır. Sizi tekrar ağırlamaktan mutluluk duyarız.`; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer"); }
  return <section className="panel"><span className="eyebrow">WHATSAPP MESAJ PANELİ</span><h2>Hazır müşteri mesajları</h2><div className="card-grid">{reservations.length === 0 ? <div className="empty">Aktif rezervasyon yok.</div> : reservations.map((r) => <article className="action-card" key={r.id}><div className={`villa-dot ${r.villa.toLowerCase()}`}>{r.villa[0]}</div><div><strong>{r.guestName}</strong><p>{r.villa} · {formatDate(r.checkIn)} — {formatDate(r.checkOut)}</p></div><div className="action-row"><button onClick={() => openMessage(r,"Giriş")}>Giriş mesajı</button><button onClick={() => openMessage(r,"Çıkış")}>Çıkış mesajı</button></div></article>)}</div></section>;
}
function CleaningView({ reservations }: { reservations: Reservation[] }) {
  const events = new Map<string, Set<Villa>>(); reservations.forEach((r) => { for (const date of [r.checkIn, r.checkOut]) { const set = events.get(date) ?? new Set<Villa>(); set.add(r.villa); events.set(date, set); } });
  const doubleDays = [...events].filter(([, villas]) => villas.size === 2).sort(([a],[b]) => a.localeCompare(b));
  return <section className="panel"><span className="eyebrow">TEMİZLİK PLANI</span><h2>Aynı gün iki villa işlemleri</h2><div className="cleaning-list">{doubleDays.length === 0 ? <div className="empty">Çift temizlik günü bulunmuyor.</div> : doubleDays.map(([date]) => <article key={date}><b>✦ Çift temizlik günü</b><strong>{longDate(date)}</strong><span>Safira ve Destan için giriş veya çıkış işlemi var.</span></article>)}</div></section>;
}
function CalculatorView() {
  const [nightCount, setNightCount] = useState(1), [rate, setRate] = useState(0), [commission, setCommission] = useState(10);
  const gross = nightCount * rate, fee = gross * commission / 100;
  return <section className="panel tool-panel"><span className="eyebrow">GELİR HESAPLAYICI</span><h2>Rezervasyon hesabı</h2><div className="calculator-fields"><label>Gece sayısı<input type="number" min="1" value={nightCount} onChange={(e) => setNightCount(Number(e.target.value))} /></label><label>Gecelik fiyat<input type="number" min="0" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></label><label>Komisyon %<input type="number" min="0" max="100" value={commission} onChange={(e) => setCommission(Number(e.target.value))} /></label></div><div className="calc-results"><article><span>Brüt</span><strong>{money.format(gross)}</strong></article><article><span>Komisyon</span><strong>{money.format(fee)}</strong></article><article><span>Net</span><strong>{money.format(gross-fee)}</strong></article></div></section>;
}
function ReportsView({reservations,commission}:{reservations:Reservation[];commission:number}){
  const years=[...new Set(reservations.flatMap((r)=>[Number(r.checkIn.slice(0,4)),Number(r.checkOut.slice(0,4))]))].sort((a,b)=>b-a); const [year,setYear]=useState(years[0]??new Date().getFullYear());
  const rows=Array.from({length:12},(_,month)=>{const perVilla={Safira:{nights:0,revenue:0},Destan:{nights:0,revenue:0}};reservations.forEach((r)=>{const totalNights=Math.max(nights(r.checkIn,r.checkOut),1);const perNight=r.totalAmount/totalNights;for(let d=new Date(`${r.checkIn}T00:00:00Z`);d<new Date(`${r.checkOut}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+1)){if(d.getUTCFullYear()===year&&d.getUTCMonth()===month){perVilla[r.villa].nights++;perVilla[r.villa].revenue+=perNight;}}});return {month,perVilla};});
  const yearRevenue=rows.reduce((sum,row)=>sum+row.perVilla.Safira.revenue+row.perVilla.Destan.revenue,0),yearNights=rows.reduce((sum,row)=>sum+row.perVilla.Safira.nights+row.perVilla.Destan.nights,0);
  return <section className="panel report-panel"><div className="report-head"><div><span className="eyebrow">İŞLETME RAPORU</span><h2>Aylık doluluk ve gelir</h2></div><div><select value={year} onChange={(e)=>setYear(Number(e.target.value))}>{years.map((y)=><option key={y}>{y}</option>)}</select><a className="backup" href="/api/export">CSV indir</a></div></div><section className="report-summary"><article><span>Yıllık gece</span><strong>{yearNights}</strong></article><article><span>Brüt gelir</span><strong>{money.format(yearRevenue)}</strong></article><article><span>Komisyon</span><strong>{money.format(yearRevenue*commission/100)}</strong></article><article><span>Net gelir</span><strong>{money.format(yearRevenue*(1-commission/100))}</strong></article></section><div className="table-wrap"><table className="report-table"><thead><tr><th>Ay</th><th>Safira gece</th><th>Safira gelir</th><th>Destan gece</th><th>Destan gelir</th><th>Toplam</th></tr></thead><tbody>{rows.map((row)=><tr key={row.month}><td>{new Intl.DateTimeFormat("tr-TR",{month:"long"}).format(new Date(year,row.month,1))}</td><td>{row.perVilla.Safira.nights}</td><td>{money.format(row.perVilla.Safira.revenue)}</td><td>{row.perVilla.Destan.nights}</td><td>{money.format(row.perVilla.Destan.revenue)}</td><td>{money.format(row.perVilla.Safira.revenue+row.perVilla.Destan.revenue)}</td></tr>)}</tbody></table></div></section>;
}
function SettingsView({ count, commission, setCommission, prices, setPrices }: { count: number; commission: number; setCommission: (value: number) => void; prices: PriceRange[]; setPrices: (value: PriceRange[]) => void }) {
  const [notice, setNotice] = useState("");
  async function saveCommission(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const value = Number(form.get("commissionRate")); const response = await fetch("/api/settings", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({commissionRate:value}) }); const data=await response.json(); if(response.ok){setCommission(data.commissionRate);setNotice("Komisyon oranı kaydedildi.");}else setNotice(data.error); }
  async function addPrice(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const element=event.currentTarget; const response=await fetch("/api/prices",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(element).entries()))}); const data=await response.json(); if(response.ok){setPrices([...prices,data.price].sort((a,b)=>a.startDate.localeCompare(b.startDate)));element.reset();setNotice("Fiyat dönemi eklendi.");}else setNotice(data.error); }
  async function removePrice(id:string){if(!confirm("Bu fiyat dönemini silmek istiyor musunuz?"))return;const response=await fetch(`/api/prices/${id}`,{method:"DELETE"});if(response.ok){setPrices(prices.filter((p)=>p.id!==id));setNotice("Fiyat dönemi silindi.");}}
  return <section className="panel settings-panel"><span className="eyebrow">AYARLAR VE FİYATLAR</span><h2>Komisyon ve dönemsel fiyatlar</h2>{notice ? <p className="message settings-message">{notice}</p> : null}<div className="settings-layout">
    <div><form className="setting-box" onSubmit={saveCommission}><h3>Komisyon oranı</h3><p>Tüm finans özetinde kullanılacak oran.</p><label>Komisyon %<input name="commissionRate" type="number" min="0" max="100" step="0.1" defaultValue={commission} required /></label><button className="save">Oranı kaydet</button></form>
    <form className="setting-box" onSubmit={addPrice}><h3>Yeni fiyat dönemi</h3><label>Villa<select name="villa"><option>Safira</option><option>Destan</option></select></label><div className="two"><label>Başlangıç<input name="startDate" type="date" required /></label><label>Bitiş<input name="endDate" type="date" required /></label></div><label>Gecelik fiyat<input name="nightlyRate" type="number" min="1" required /></label><button className="save">Fiyat dönemini ekle</button></form></div>
    <div className="price-lists">{(["Safira","Destan"] as Villa[]).map((villa)=><div className="setting-box" key={villa}><h3>{villa} fiyatları</h3>{prices.filter((p)=>p.villa===villa).length===0?<p>Henüz fiyat tanımlanmadı.</p>:prices.filter((p)=>p.villa===villa).map((p)=><article className="price-row" key={p.id}><div><strong>{money.format(p.nightlyRate)}</strong><span>{formatDate(p.startDate)} — {formatDate(p.endDate)}</span></div><button onClick={()=>removePrice(p.id)}>Sil</button></article>)}</div>)}</div>
  </div><div className="settings-footer"><span>{count} aktif rezervasyon</span><a className="backup" href="/api/backup">JSON yedeğini indir</a></div></section>;
}

function nights(start: string, end: string) { return Math.round((Date.parse(end)-Date.parse(start))/86400000); }
function formatDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { day:"2-digit", month:"short" }).format(new Date(`${value}T12:00:00`)); }
function longDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { day:"numeric", month:"long", year:"numeric", weekday:"long" }).format(new Date(`${value}T12:00:00`)); }
