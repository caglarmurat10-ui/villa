"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { PriceRange, Reservation, Villa, VillaLocations } from "@/lib/types";

type View = "dashboard" | "calendar" | "messages" | "cleaning" | "reports" | "calculator" | "settings";
type MessageType = "Giriş" | "Konum" | "Çıkış";
type MovementReminder = { reservation: Reservation; type: "Giriş" | "Çıkış"; date: string; dayLabel: "BUGÜN" | "YARIN" };
const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const istanbulDate = new Intl.DateTimeFormat("en", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });

function dateKey(value = new Date()) {
  const parts = Object.fromEntries(istanbulDate.formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

const today = dateKey();
const menu: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Ana Takip", icon: "⌂" }, { id: "calendar", label: "Takvim", icon: "▦" },
  { id: "messages", label: "Mesajlar", icon: "✉" }, { id: "cleaning", label: "Temizlik", icon: "✦" },
  { id: "reports", label: "Raporlar", icon: "▥" }, { id: "calculator", label: "Hesaplama", icon: "₺" }, { id: "settings", label: "Ayarlar", icon: "⚙" },
];

function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 10) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `90${digits.slice(1)}`;
  return digits;
}

function whatsappUrl(phone: string, text: string) {
  const number = normalizeWhatsAppNumber(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function openReservationMessage(reservation: Reservation, type: MessageType, locations: VillaLocations) {
  if (!normalizeWhatsAppNumber(reservation.phone)) {
    alert(`${reservation.guestName} için kayıtlı WhatsApp numarası yok. Ana Takip bölümünden rezervasyonu düzenleyip numarayı ekleyin.`);
    return;
  }
  if (type === "Konum" && !locations[reservation.villa]) {
    alert(`${reservation.villa} için konum bağlantısı tanımlı değil. Ayarlar bölümünden bağlantıyı bir kez kaydedin.`);
    return;
  }
  const texts: Record<MessageType, string> = {
    Giriş: `Merhaba, ${reservation.villa} Villa rezervasyonunuz için sizi ağırlamaktan mutluluk duyacağız. Giriş saatimiz 16.00'dır. Varış saatinizi müsait olduğunuzda bizimle paylaşabilirsiniz. Şimdiden iyi yolculuklar dileriz.`,
    Konum: `Merhaba, ${reservation.villa} Villa için konum bağlantımız aşağıdadır:\n\n${locations[reservation.villa]}\n\nYola çıkmadan önce bağlantıyı açarak rotanızı kontrol etmenizi rica ederiz. Güvenli ve keyifli bir yolculuk dileriz.`,
    Çıkış: `Merhaba, bizi tercih ettiğiniz için teşekkür ederiz. Çıkış saatimiz 10.00'dır. Güzel anılarla ayrılmanızı diler, sizi yeniden ağırlamaktan mutluluk duyarız.`,
  };
  window.open(whatsappUrl(reservation.phone, texts[type]), "_blank", "noopener,noreferrer");
}

function getMovementReminders(reservations: Reservation[]) {
  const tomorrow = addDays(today, 1);
  return reservations.flatMap<MovementReminder>((reservation) => {
    const reminders: MovementReminder[] = [];
    if (reservation.checkIn === today || reservation.checkIn === tomorrow) reminders.push({ reservation, type: "Giriş", date: reservation.checkIn, dayLabel: reservation.checkIn === today ? "BUGÜN" : "YARIN" });
    if (reservation.checkOut === today || reservation.checkOut === tomorrow) reminders.push({ reservation, type: "Çıkış", date: reservation.checkOut, dayLabel: reservation.checkOut === today ? "BUGÜN" : "YARIN" });
    return reminders;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type, "tr-TR") || a.reservation.villa.localeCompare(b.reservation.villa));
}

type DashboardProps = {
  initialReservations: Reservation[];
  initialCommission: number;
  initialPrices: PriceRange[];
  initialLocations: VillaLocations;
};

export default function Dashboard({ initialReservations, initialCommission, initialPrices, initialLocations }: DashboardProps) {
  const [reservations, setReservations] = useState(initialReservations);
  const [villaFilter, setVillaFilter] = useState<"Tümü" | Villa>("Tümü");
  const [recordFilter, setRecordFilter] = useState<"active" | "completed">("active");
  const [search,setSearch]=useState(""),[channelFilter,setChannelFilter]=useState("Tümü"),[paymentFilter,setPaymentFilter]=useState("Tümü");
  const [view, setView] = useState<View>("dashboard");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [commission, setCommission] = useState(initialCommission);
  const [prices, setPrices] = useState(initialPrices);
  const [locations, setLocations] = useState(initialLocations);

  const visible = useMemo(() => reservations.filter((r) => (villaFilter === "Tümü" || r.villa === villaFilter) && (!search || r.guestName.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR"))) && (channelFilter === "Tümü" || r.channel === channelFilter) && (paymentFilter === "Tümü" || (paymentFilter === "Ödendi" ? r.paidAmount >= r.totalAmount : r.paidAmount < r.totalAmount))), [reservations, villaFilter, search, channelFilter, paymentFilter]);
  const active = visible.filter((r) => r.checkOut >= today);
  const movementReminders = useMemo(() => getMovementReminders(visible), [visible]);
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
  function showNewReservation() {
    setView("dashboard");
    setRecordFilter("active");
    setEditing(null);
    window.setTimeout(() => document.getElementById("reservation-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return <main>
    <header className="topbar">
      <div className="brand-block">
        <Image className="brand-icon" src="/app-icon.svg" width={68} height={68} alt="Villa Yönetim simgesi" priority />
        <div><span className="eyebrow">BAĞIMSIZ YÖNETİM PANELİ</span><h1>Villa Yönetim</h1><p>Safira ve Destan, tek ve güvenli bir takvimde.</p><div className="cloud-status"><span /> Bulut bağlantısı açık</div></div>
      </div>
      <div className="top-actions"><button className="primary-action" onClick={showNewReservation}>＋ Yeni rezervasyon</button><a className="backup" href="/api/backup">Yedeği indir</a></div>
    </header>
    <nav className="main-menu" aria-label="Ana menü">
      {menu.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><i aria-hidden="true">{item.icon}</i><span>{item.label}</span>{item.id === "dashboard" && movementReminders.length > 0 ? <small>{movementReminders.length}</small> : item.id === "messages" ? <small>{active.length}</small> : null}</button>)}
    </nav>
    {["dashboard", "calendar", "messages", "reports"].includes(view) ? <div className="filter-bar">
      <section className="filters" aria-label="Villa filtresi">
        {(["Tümü", "Safira", "Destan"] as const).map((villa) => <button key={villa} className={villaFilter === villa ? "active" : ""} onClick={() => setVillaFilter(villa)}>{villa}</button>)}
      </section>
      <section className="advanced-filters"><input aria-label="Müşteri ara" placeholder="Müşteri ara…" value={search} onChange={(e)=>setSearch(e.target.value)} /><select aria-label="Kanal filtresi" value={channelFilter} onChange={(e)=>setChannelFilter(e.target.value)}><option>Tümü</option><option>Doğrudan</option><option>Booking</option><option>Airbnb</option><option>Diğer</option></select><select aria-label="Ödeme filtresi" value={paymentFilter} onChange={(e)=>setPaymentFilter(e.target.value)}><option>Tümü</option><option>Ödendi</option><option>Ödenmedi</option></select>{(search||channelFilter!=="Tümü"||paymentFilter!=="Tümü")?<button onClick={()=>{setSearch("");setChannelFilter("Tümü");setPaymentFilter("Tümü");}}>Temizle</button>:null}</section>
    </div> : null}

    {view === "dashboard" && <>
      <MovementAlerts reminders={movementReminders} locations={locations} openMessages={() => setView("messages")} />
      <Stats count={active.length} revenue={totals.revenue} paid={totals.paid} commission={commission} />
      <Operations reservations={visible} />
      <div className="record-tabs"><button className={recordFilter === "active" ? "active" : ""} onClick={() => setRecordFilter("active")}>Aktif ({visible.filter((r)=>r.checkOut>=today).length})</button><button className={recordFilter === "completed" ? "active" : ""} onClick={() => setRecordFilter("completed")}>Tamamlanan ({visible.filter((r)=>r.checkOut<today).length})</button></div>
      {message ? <p className="message dashboard-message">{message}</p> : null}
      <div className="layout"><ReservationList reservations={visible.filter((r)=>recordFilter === "active" ? r.checkOut>=today : r.checkOut<today)} remove={remove} edit={setEditing} payment={updatePayment} />
        <ReservationForm key={editing?.id??"new"} editing={editing} onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); await refresh(); }} />
      </div>
    </>}
    {view === "calendar" && <CalendarView reservations={visible} />}
    {view === "messages" && <MessagesView reservations={active} locations={locations} openSettings={() => setView("settings")} />}
    {view === "cleaning" && <CleaningView reservations={reservations} />}
    {view === "reports" && <ReportsView reservations={visible} commission={commission} />}
    {view === "calculator" && <CalculatorView />}
    {view === "settings" && <SettingsView count={reservations.length} commission={commission} setCommission={setCommission} prices={prices} setPrices={setPrices} locations={locations} setLocations={setLocations} />}
  </main>;
}

function Stats({ count, revenue, paid, commission }: { count: number; revenue: number; paid: number; commission: number }) {
  const commissionAmount = revenue * commission / 100;
  return <section className="stats"><article><span>Aktif rezervasyon</span><strong>{count}</strong></article><article><span>Brüt gelir</span><strong>{money.format(revenue)}</strong></article><article><span>Net gelir</span><strong>{money.format(revenue-commissionAmount)}</strong></article><article><span>Kalan ödeme</span><strong>{money.format(revenue-paid)}</strong></article></section>;
}
function Operations({ reservations }: { reservations: Reservation[] }) {
  const nextWeekStr=addDays(today, 7);
  const arrivals=reservations.filter((r)=>r.checkIn===today), departures=reservations.filter((r)=>r.checkOut===today), upcoming=reservations.filter((r)=>r.checkIn>today&&r.checkIn<=nextWeekStr);
  const channels=(["Doğrudan","Booking","Airbnb","Diğer"] as const).map((channel)=>({channel,count:reservations.filter((r)=>r.channel===channel).length})).filter((x)=>x.count>0);
  return <section className="operations"><article><span>Bugün giriş</span><strong>{arrivals.length}</strong><small>{arrivals.map((r)=>`${r.guestName} · ${r.villa}`).join(", ")||"Giriş yok"}</small></article><article><span>Bugün çıkış</span><strong>{departures.length}</strong><small>{departures.map((r)=>`${r.guestName} · ${r.villa}`).join(", ")||"Çıkış yok"}</small></article><article><span>7 günlük giriş</span><strong>{upcoming.length}</strong><small>{upcoming.length?"Yaklaşan misafirler var":"Plan sakin"}</small></article><article><span>Kanal dağılımı</span><div className="channel-badges">{channels.map((x)=><b key={x.channel}>{x.channel} {x.count}</b>)}</div></article></section>;
}
function MovementAlerts({ reminders, locations, openMessages }: { reminders: MovementReminder[]; locations: VillaLocations; openMessages: () => void }) {
  return <section className={`movement-alerts ${reminders.length > 0 ? "has-reminders" : "is-clear"}`} aria-live="polite">
    <div className="movement-head"><div className="movement-title"><span className="movement-bell" aria-hidden="true">●</span><div><strong>Giriş–çıkış bildirimleri</strong><p>Bugün ve yarın yapılacak işlemler</p></div></div><button onClick={openMessages}>Mesaj paneli</button></div>
    {reminders.length === 0 ? <div className="movement-clear"><span>✓</span><div><strong>Bugün ve yarın işlem yok</strong><p>Yeni bir giriş veya çıkış yaklaştığında burada otomatik görünecek.</p></div></div> : <div className="movement-grid">{reminders.map((item) => <article className={`movement-card ${item.type === "Giriş" ? "checkin" : "checkout"} ${item.dayLabel === "BUGÜN" ? "today" : "tomorrow"}`} key={`${item.reservation.id}-${item.type}`}>
      <div className="movement-card-head"><span className="movement-day">{item.dayLabel}</span><span className="movement-type">{item.type === "Giriş" ? "→ GİRİŞ" : "← ÇIKIŞ"}</span></div>
      <div className="movement-guest"><div className={`villa-dot ${item.reservation.villa.toLowerCase()}`}>{item.reservation.villa[0]}</div><div><strong>{item.reservation.guestName}</strong><p>{item.reservation.villa} · {longDate(item.date)}</p></div></div>
      <div className="movement-actions"><button onClick={() => openReservationMessage(item.reservation, item.type, locations)}>{item.type} mesajı</button>{item.type === "Giriş" ? <button className="location" onClick={() => openReservationMessage(item.reservation, "Konum", locations)}>Konum gönder</button> : null}</div>
    </article>)}</div>}
  </section>;
}
function ReservationList({ reservations, remove, edit, payment }: { reservations: Reservation[]; remove: (id: string) => void; edit: (item: Reservation) => void; payment: (item: Reservation) => void }) {
  return <section className="panel list-panel"><div className="panel-title"><div><span className="eyebrow">REZERVASYONLAR</span><h2>Konaklama listesi</h2></div><b>{reservations.length} kayıt</b></div><div className="reservation-list">
    {reservations.length === 0 ? <div className="empty">Bu bölümde rezervasyon yok.</div> : reservations.map((r) => <article className="reservation" key={r.id}><div className={`villa-dot ${r.villa.toLowerCase()}`}>{r.villa[0]}</div><div className="guest"><strong>{r.guestName}</strong><span>{r.villa} · {r.channel}</span>{r.phone ? <span className="phone-line">☎ {r.phone}</span> : null}</div><div className="dates"><strong>{formatDate(r.checkIn)} → {formatDate(r.checkOut)}</strong><span>{nights(r.checkIn, r.checkOut)} gece</span></div><div className="amount"><strong>{money.format(r.totalAmount)}</strong><span className={r.totalAmount-r.paidAmount>0?"due":"paid"}>{r.totalAmount-r.paidAmount>0?`Kalan ${money.format(r.totalAmount-r.paidAmount)}`:"Ödendi ✓"}</span></div><div className="row-actions">{r.phone ? <a className="whatsapp-shortcut" href={whatsappUrl(r.phone, `Merhaba, ${r.villa} Villa rezervasyonunuzla ilgili size ulaşıyoruz.`)} target="_blank" rel="noreferrer">WhatsApp</a> : null}<button onClick={()=>edit(r)}>Düzenle</button><button onClick={()=>payment(r)}>Ödeme</button><button className="delete" onClick={() => remove(r.id)}>Sil</button></div></article>)}
  </div></section>;
}
function ReservationForm({ editing, onCancel, onSaved }: { editing: Reservation | null; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [villa,setVilla]=useState<Villa>(editing?.villa??"Safira"),[checkIn,setCheckIn]=useState(editing?.checkIn??""),[checkOut,setCheckOut]=useState(editing?.checkOut??"");
  const [quote,setQuote]=useState<{total:number;nights:number}|null>(null),[quoteError,setQuoteError]=useState(""),[saving,setSaving]=useState(false),[notice,setNotice]=useState("");
  useEffect(()=>{if(!checkIn||!checkOut||checkOut<=checkIn)return;const controller=new AbortController();const timer=setTimeout(async()=>{try{const response=await fetch("/api/quote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({villa,checkIn,checkOut}),signal:controller.signal});const data=await response.json();if(response.ok){setQuote(data);setQuoteError("");}else{setQuote(null);setQuoteError(data.error);}}catch{}},250);return()=>{clearTimeout(timer);controller.abort();};},[villa,checkIn,checkOut]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const element=event.currentTarget;setSaving(true);setNotice("");const payload=Object.fromEntries(new FormData(element).entries());const response=await fetch(editing?`/api/reservations/${editing.id}`:"/api/reservations",{method:editing?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await response.json();if(response.ok){setNotice(editing?"Rezervasyon güncellendi.":"Rezervasyon kaydedildi.");if(!editing){element.reset();setVilla("Safira");setCheckIn("");setCheckOut("");}await onSaved();}else setNotice(data.error??"İşlem yapılamadı");setSaving(false);}
  return <section className="panel form-panel" id="reservation-form"><span className="eyebrow">{editing?"KAYDI DÜZENLE":"YENİ KAYIT"}</span><h2>{editing?editing.guestName:"Rezervasyon ekle"}</h2><form key={editing?.id??"new"} onSubmit={submit}>
    <label>Villa<select name="villa" required value={villa} onChange={(e)=>{setVilla(e.target.value as Villa);setQuote(null);setQuoteError("");}}><option>Safira</option><option>Destan</option></select></label>
    <label>Müşteri<input name="guestName" required minLength={2} placeholder="Müşteri adı" autoComplete="name" defaultValue={editing?.guestName??""} /></label>
    <label>WhatsApp numarası <span className="label-hint">Mesajlarda tekrar kullanmak için saklanır</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" defaultValue={editing?.phone??""} /></label>
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
function MessagesView({ reservations, locations, openSettings }: { reservations: Reservation[]; locations: VillaLocations; openSettings: () => void }) {
  const missingLocation = !locations.Safira || !locations.Destan;
  return <section className="panel messages-panel"><div className="messages-head"><div><span className="eyebrow">WHATSAPP MESAJ PANELİ</span><h2>Hazır müşteri mesajları</h2><p>Numarası kayıtlı müşteriye giriş, konum veya çıkış mesajını tek dokunuşla gönderin.</p></div>{missingLocation ? <button className="location-settings" onClick={openSettings}>Konumları ayarla</button> : null}</div><div className="card-grid">{reservations.length === 0 ? <div className="empty">Aktif rezervasyon yok.</div> : reservations.map((r) => <article className="action-card" key={r.id}><div className={`villa-dot ${r.villa.toLowerCase()}`}>{r.villa[0]}</div><div><strong>{r.guestName}</strong><p>{r.villa} · {formatDate(r.checkIn)} — {formatDate(r.checkOut)}</p><span className={r.phone ? "contact-ready" : "contact-missing"}>{r.phone ? `WhatsApp: ${r.phone}` : "WhatsApp numarası eksik"}</span></div><div className="action-row"><button onClick={() => openReservationMessage(r,"Giriş",locations)}>Giriş</button><button className="location" onClick={() => openReservationMessage(r,"Konum",locations)}>Konum</button><button onClick={() => openReservationMessage(r,"Çıkış",locations)}>Çıkış</button></div></article>)}</div></section>;
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
function SettingsView({ count, commission, setCommission, prices, setPrices, locations, setLocations }: { count: number; commission: number; setCommission: (value: number) => void; prices: PriceRange[]; setPrices: (value: PriceRange[]) => void; locations: VillaLocations; setLocations: (value: VillaLocations) => void }) {
  const [notice, setNotice] = useState("");
  async function saveCommission(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const value = Number(form.get("commissionRate")); const response = await fetch("/api/settings", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({commissionRate:value}) }); const data=await response.json(); if(response.ok){setCommission(data.commissionRate);setNotice("Komisyon oranı kaydedildi.");}else setNotice(data.error); }
  async function saveLocations(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const nextLocations = { Safira: String(form.get("Safira") ?? "").trim(), Destan: String(form.get("Destan") ?? "").trim() }; const response = await fetch("/api/settings", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({locations:nextLocations}) }); const data=await response.json(); if(response.ok){setLocations(data.locations);setNotice("Villa konumları kaydedildi.");}else setNotice(data.error); }
  async function addPrice(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const element=event.currentTarget; const response=await fetch("/api/prices",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(element).entries()))}); const data=await response.json(); if(response.ok){setPrices([...prices,data.price].sort((a,b)=>a.startDate.localeCompare(b.startDate)));element.reset();setNotice("Fiyat dönemi eklendi.");}else setNotice(data.error); }
  async function removePrice(id:string){if(!confirm("Bu fiyat dönemini silmek istiyor musunuz?"))return;const response=await fetch(`/api/prices/${id}`,{method:"DELETE"});if(response.ok){setPrices(prices.filter((p)=>p.id!==id));setNotice("Fiyat dönemi silindi.");}}
  return <section className="panel settings-panel"><span className="eyebrow">AYARLAR VE FİYATLAR</span><h2>İletişim, komisyon ve dönemsel fiyatlar</h2>{notice ? <p className="message settings-message">{notice}</p> : null}<div className="settings-layout">
    <div><form className="setting-box" onSubmit={saveCommission}><h3>Komisyon oranı</h3><p>Tüm finans özetinde kullanılacak oran.</p><label>Komisyon %<input name="commissionRate" type="number" min="0" max="100" step="0.1" defaultValue={commission} required /></label><button className="save">Oranı kaydet</button></form>
    <form className="setting-box" onSubmit={saveLocations}><h3>WhatsApp konumları</h3><p>Google Maps&apos;te “Paylaş → Bağlantıyı kopyala” ile aldığınız adresleri bir kez kaydedin.</p><label>Safira konum bağlantısı<input name="Safira" type="url" inputMode="url" placeholder="https://maps.app.goo.gl/..." defaultValue={locations.Safira} /></label><label>Destan konum bağlantısı<input name="Destan" type="url" inputMode="url" placeholder="https://maps.app.goo.gl/..." defaultValue={locations.Destan} /></label><button className="save">Konumları kaydet</button></form>
    <form className="setting-box" onSubmit={addPrice}><h3>Yeni fiyat dönemi</h3><label>Villa<select name="villa"><option>Safira</option><option>Destan</option></select></label><div className="two"><label>Başlangıç<input name="startDate" type="date" required /></label><label>Bitiş<input name="endDate" type="date" required /></label></div><label>Gecelik fiyat<input name="nightlyRate" type="number" min="1" required /></label><button className="save">Fiyat dönemini ekle</button></form></div>
    <div className="price-lists">{(["Safira","Destan"] as Villa[]).map((villa)=><div className="setting-box" key={villa}><h3>{villa} fiyatları</h3>{prices.filter((p)=>p.villa===villa).length===0?<p>Henüz fiyat tanımlanmadı.</p>:prices.filter((p)=>p.villa===villa).map((p)=><article className="price-row" key={p.id}><div><strong>{money.format(p.nightlyRate)}</strong><span>{formatDate(p.startDate)} — {formatDate(p.endDate)}</span></div><button onClick={()=>removePrice(p.id)}>Sil</button></article>)}</div>)}</div>
  </div><div className="settings-footer"><span>{count} toplam rezervasyon</span><a className="backup" href="/api/backup">JSON yedeğini indir</a></div></section>;
}

function nights(start: string, end: string) { return Math.round((Date.parse(end)-Date.parse(start))/86400000); }
function formatDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { day:"2-digit", month:"short" }).format(new Date(`${value}T12:00:00`)); }
function longDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { day:"numeric", month:"long", year:"numeric", weekday:"long" }).format(new Date(`${value}T12:00:00`)); }
