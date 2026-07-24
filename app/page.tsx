"use client";

import { useEffect, useMemo, useState } from "react";
import Calendar from "@/components/Calendar";
import ReservationForm from "@/components/ReservationForm";
import TransactionList from "@/components/TransactionList";
import Calculator from "@/components/Calculator";
import Settings from "@/components/Settings";
import FilterBar from "@/components/FilterBar";
import { GoogleService, VillaReservation } from "@/services/api";
import { Loader2, Cloud, Calculator as CalcIcon, Settings as SettingsIcon, Bell, Home as HomeIcon, Wallet, MessageSquare, MapPin } from "lucide-react";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  const [data, setData] = useState<VillaReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const [editingItem, setEditingItem] = useState<VillaReservation | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Safira' | 'Destan'>('All');
  const [commission, setCommission] = useState(10);

  // Aktif veya Tamamlanan Rezervasyon Sekme Filtresi
  const [reservationTab, setReservationTab] = useState<'active' | 'completed'>('active');

  const loadData = async () => {
    if (!data || data.length === 0) setLoading(true);
    try {
      const backupRes = await fetch('/api/backup');
      if (backupRes.ok) {
        const backupData = await backupRes.json();
        const reservations = Array.isArray(backupData) ? backupData : backupData?.reservations;
        if (Array.isArray(reservations)) {
          setData(reservations);
          setLoading(false);
        }
      }
    } catch (e) {
      console.error("Backup load failed", e);
    }

    setSynced(false);
    const cloudData = await GoogleService.loadData();
    if (cloudData !== null && Array.isArray(cloudData)) {
      setData(cloudData);
      setSynced(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    setMounted(true);

    const refreshLocalData = () => {
      if (typeof GoogleService.getLocalData === 'function') {
        const local = GoogleService.getLocalData();
        if (Array.isArray(local)) setData(local);
      }
    };

    refreshLocalData();

    const readCommission = () => {
      const value = Number(localStorage.getItem('villa_commission_rate') || 10);
      setCommission(Number.isFinite(value) ? value : 10);
    };

    readCommission();
    window.addEventListener('config-update', readCommission);
    window.addEventListener('villa-data-update', refreshLocalData);
    
    loadData();
    
    return () => {
      window.removeEventListener('config-update', readCommission);
      window.removeEventListener('villa-data-update', refreshLocalData);
    };
  }, []);

  const safeData = Array.isArray(data) ? data : [];

  // Bugünün Tarihi
  const todayStr = '2026-07-24';
  const getTomorrowStr = () => '2026-07-25';
  const tomorrowStr = getTomorrowStr();

  // Komisyon, Net Tutar ve Geçmiş Rezervasyon Tahsilat Otomasyonu
  const processedData = useMemo(() => {
    return safeData.map(item => {
      if (!item) return item;
      const brut = Number(item.brut) || (Number(item.nights || 0) * Number(item.price || 0));
      const commAmt = Number(item.commAmt) > 0 ? Number(item.commAmt) : (brut * commission / 100);
      const net = brut - commAmt;

      const isCompleted = item.cout && item.cout < todayStr;
      const paidAmt = isCompleted ? brut : (Number(item.paidAmt) || 0);
      const remaining = isCompleted ? 0 : Math.max(brut - paidAmt, 0);

      return {
        ...item,
        brut,
        commAmt,
        net,
        paidAmt,
        remaining
      };
    });
  }, [safeData, commission, todayStr]);

  // Önce Villa Filtresi (All, Safira, Destan)
  const filteredByVilla = useMemo(() => activeFilter === 'All'
    ? processedData
    : processedData.filter(item => item && item.apart === activeFilter), [activeFilter, processedData]);

  // TÜM DÖNEMİN GENEL ÖZETİ
  const overallStats = useMemo(() => filteredByVilla.reduce((acc, curr) => ({
    brut: acc.brut + (curr?.brut || 0),
    comm: acc.comm + (curr?.commAmt || 0),
    net: acc.net + (curr?.net || 0),
    paid: acc.paid + (curr?.paidAmt || 0),
    remaining: acc.remaining + (curr?.remaining || 0),
    reservations: acc.reservations + 1,
    nights: acc.nights + (curr?.nights || 0)
  }), { brut: 0, comm: 0, net: 0, paid: 0, remaining: 0, reservations: 0, nights: 0 }), [filteredByVilla]);

  const activeReservations = useMemo(() => 
    filteredByVilla.filter(item => item && item.cout >= todayStr), 
  [filteredByVilla, todayStr]);

  const completedReservations = useMemo(() => 
    filteredByVilla.filter(item => item && item.cout < todayStr), 
  [filteredByVilla, todayStr]);

  // Çıkışı bugün veya yarın olanlar
  const approachingCheckouts = useMemo(() => 
    activeReservations.filter(item => item && (item.cout === todayStr || item.cout === tomorrowStr)), 
  [activeReservations, todayStr, tomorrowStr]);

  // Girişi bugün veya yarın olanlar
  const upcomingCheckins = useMemo(() => 
    activeReservations.filter(item => item && (item.cin === todayStr || item.cin === tomorrowStr)), 
  [activeReservations, todayStr, tomorrowStr]);

  const filteredData = useMemo(() => 
    reservationTab === 'active' ? activeReservations : completedReservations,
  [reservationTab, activeReservations, completedReservations]);

  const villaBreakdown = useMemo(() => {
    const activeSet = reservationTab === 'active' ? activeReservations : completedReservations;
    
    const safira = activeSet.filter(i => i.apart === 'Safira').reduce((acc, curr) => ({
      brut: acc.brut + (curr.brut || 0),
      comm: acc.comm + (curr.commAmt || 0),
      net: acc.net + (curr.net || 0),
      count: acc.count + 1
    }), { brut: 0, comm: 0, net: 0, count: 0 });

    const destan = activeSet.filter(i => i.apart === 'Destan').reduce((acc, curr) => ({
      brut: acc.brut + (curr.brut || 0),
      comm: acc.comm + (curr.commAmt || 0),
      net: acc.net + (curr.net || 0),
      count: acc.count + 1
    }), { brut: 0, comm: 0, net: 0, count: 0 });

    return { safira, destan };
  }, [activeReservations, completedReservations, reservationTab]);

  // ÇIKIŞ İÇİN ÖZEL HATIRLATMA VE YORUM LİNKİ WHATSAPP MESAJI
  const sendCheckoutWhatsApp = (name: string, apart: string) => {
    const reviewLink = apart === 'Safira' 
      ? 'https://g.page/r/CV4SGDD8Hr_7EBM/review' 
      : 'https://g.page/r/CZMpV_CdinkEEBM/review';

    const text = `Merhaba ${name}, yarın çıkışınız var çıkışlar 9 ile 10 arasındadır ben saat 10 doğru gelirim sizde hazırlanmış olursunuz iyi günler dilerim\n\nGörüşleriniz bizim için çok değerli. Değerlendirmeniz için: ${reviewLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // VİLLA BAZLI GİRİŞ VE KONUM WHATSAPP MESAJI
  const sendCheckinWhatsApp = (name: string, apart: string) => {
    let text = '';
    if (apart === 'Destan') {
      text = `Merhaba ${name}, ben Murat. Villanın konumunu atıyorum: https://maps.app.goo.gl/QmWfNNF9ikQ5G1CFA?g_st=aw Girişler saat 16 ile 22 arasındadır. Yaklaşınca haber verirsiniz. Hayırlı yolculuklar!`;
    } else {
      text = `Merhaba ${name}, ben Murat. Safira villamızın konumunu atıyorum: [Safira Konum Linki] Girişler saat 16 ile 22 arasındadır. Yaklaşınca haber verirsiniz. Hayırlı yolculuklar!`;
    }

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Sistem Başlatılıyor...</p>
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-8 min-h-screen">
      <Calculator isOpen={showCalculator} onClose={() => setShowCalculator(false)} />

      <header className="flex justify-between items-center mb-6">
        <div>
          <p className="text-xs text-indigo-300 font-bold tracking-[0.25em] uppercase">Villa Yönetim</p>
          <h1 className="text-3xl font-black text-white">Rezervasyon & Gelir Takibi</h1>
          <p className="text-[10px] uppercase tracking-widest font-bold mt-1">
            {loading ? <span className="text-amber-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor</span>
              : synced ? <span className="text-emerald-400 flex items-center gap-1"><Cloud className="w-3 h-3" /> Bulut senkronize</span>
              : <span className="text-gray-500">Yerel yedek kullanılıyor</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(true)} className="p-3 bg-gray-800 rounded-xl text-indigo-400 border border-indigo-500/20 hover:bg-gray-700"><SettingsIcon className="w-5 h-5" /></button>
          <button onClick={() => setShowCalculator(true)} className="p-3 bg-gray-800 rounded-xl text-amber-400 border border-amber-500/20 hover:bg-gray-700"><CalcIcon className="w-5 h-5" /></button>
        </div>
      </header>

      {/* GİRİŞİ YAKLAŞANLAR (VİLLA BAZLI KONUM & BİLGİ GÖNDER) */}
      {upcomingCheckins.length > 0 && (
        <div className="mb-6 p-4 bg-sky-500/15 border border-sky-500/30 rounded-2xl text-sky-300 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-sky-500/20 rounded-xl text-sky-400">
                <MapPin className="w-5 h-5" />
              </span>
              <div>
                <h4 className="font-bold text-sm">Girişi Yaklaşan Misafirler (Konum & Bilgi At)</h4>
                <p className="text-xs text-sky-200/90 mt-0.5">Misafirin kalacağı villaya özel mesaj otomatik hazırlanır.</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-sky-500/20 rounded-full text-xs font-bold border border-sky-500/40">
              {upcomingCheckins.length} Misafir
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-sky-500/20">
            {upcomingCheckins.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-sky-500/20">
                <div className="text-xs">
                  <span className="font-bold text-white">{r.name}</span>
                  <span className="text-sky-200/70 block">({r.apart} - Giriş: {r.cin})</span>
                </div>
                <button
                  onClick={() => sendCheckinWhatsApp(r.name, r.apart)}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> {r.apart} Konum Gönder
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ÇIKIŞI YAKLAŞANLAR BİLDİRİM PANELİ & HATIRLATMA MESAJI */}
      {approachingCheckouts.length > 0 && (
        <div className="mb-6 p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-300 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                <Bell className="w-5 h-5" />
              </span>
              <div>
                <h4 className="font-bold text-sm">Çıkışı Yaklaşan Misafirler Var!</h4>
                <p className="text-xs text-amber-200/90 mt-0.5">Aşağıdaki misafirler için çıkış vakti geldi veya yarın doluyor.</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-500/20 rounded-full text-xs font-bold border border-amber-500/40">
              {approachingCheckouts.length} Misafir
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-amber-500/20">
            {approachingCheckouts.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-amber-500/20">
                <div className="text-xs">
                  <span className="font-bold text-white">{r.name}</span>
                  <span className="text-amber-200/70 block">({r.apart} - Çıkış: {r.cout})</span>
                </div>
                <button
                  onClick={() => sendCheckoutWhatsApp(r.name, r.apart)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Çıkış Hatırlatması At
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <FilterBar activeFilter={activeFilter} setFilter={setActiveFilter} />

      {/* AKTİF VE TAMAMLANAN REZERVASYON SEKMELERİ */}
      <div className="flex space-x-2 my-6 bg-gray-900/60 p-1.5 rounded-2xl border border-gray-800 w-fit">
        <button 
          onClick={() => setReservationTab('active')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${reservationTab === 'active' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
        >
          Aktif / Gelecek Rezervasyonlar ({activeReservations.length})
        </button>
        <button 
          onClick={() => setReservationTab('completed')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${reservationTab === 'completed' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
        >
          Tamamlanan / Arşiv ({completedReservations.length})
        </button>
      </div>

      {/* TAHSİLAT & BAKİYE ÖZETİ KARTI */}
      <div className="bg-gradient-to-r from-gray-900 via-indigo-950/40 to-gray-900 border border-indigo-500/30 rounded-2xl p-5 mb-6 shadow-xl">
        <div className="flex items-center gap-2 mb-3 border-b border-gray-800 pb-2">
          <Wallet className="w-5 h-5 text-indigo-400" />
          <h3 className="font-extrabold text-indigo-300 text-sm tracking-wide uppercase">Genel Tahsilat & Alacak Takibi (Tüm Dönem)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="bg-gray-950/60 p-3.5 rounded-xl border border-gray-800">
            <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wider">Toplam Alınacak (Brüt)</p>
            <p className="text-xl font-black text-emerald-400 mt-1">₺{overallStats.brut.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-gray-950/60 p-3.5 rounded-xl border border-gray-800">
            <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wider">Toplam Alınan (Tahsil Edilen)</p>
            <p className="text-xl font-black text-sky-400 mt-1">₺{overallStats.paid.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-gray-950/60 p-3.5 rounded-xl border border-gray-800">
            <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wider">Toplam Kalan Alacak</p>
            <p className="text-xl font-black text-rose-400 mt-1">₺{overallStats.remaining.toLocaleString('tr-TR')}</p>
          </div>
        </div>
      </div>

      {/* VİLLA BAZLI KARŞILAŞTIRMALI ÖZET KARTI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Safira Özet */}
        <div className="bg-gray-900/90 border border-purple-500/30 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-2">
            <h3 className="font-extrabold text-purple-400 flex items-center gap-2">
              <HomeIcon className="w-4 h-4" /> Safira Villası
            </h3>
            <span className="text-xs bg-purple-500/10 text-purple-300 px-2.5 py-1 rounded-full font-semibold">{villaBreakdown.safira.count} Rezervasyon</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-950/60 p-2.5 rounded-xl border border-gray-800">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Brüt Gelir</p>
              <p className="text-sm md:text-base font-black text-emerald-400 mt-1">₺{villaBreakdown.safira.brut.toLocaleString('tr-TR')}</p>
            </div>
            <div className="bg-gray-950/60 p-2.5 rounded-xl border border-gray-800">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Komisyon</p>
              <p className="text-sm md:text-base font-black text-amber-400 mt-1">₺{villaBreakdown.safira.comm.toLocaleString('tr-TR')}</p>
            </div>
            <div className="bg-gray-950/60 p-2.5 rounded-xl border border-gray-800">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Net Kalan</p>
              <p className="text-sm md:text-base font-black text-indigo-400 mt-1">₺{villaBreakdown.safira.net.toLocaleString('tr-TR')}</p>
            </div>
          </div>
        </div>

        {/* Destan Özet */}
        <div className="bg-gray-900/90 border border-pink-500/30 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-2">
            <h3 className="font-extrabold text-pink-400 flex items-center gap-2">
              <HomeIcon className="w-4 h-4" /> Destan Villası
            </h3>
            <span className="text-xs bg-pink-500/10 text-pink-300 px-2.5 py-1 rounded-full font-semibold">{villaBreakdown.destan.count} Rezervasyon</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-950/60 p-2.5 rounded-xl border border-gray-800">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Brüt Gelir</p>
              <p className="text-sm md:text-base font-black text-emerald-400 mt-1">₺{villaBreakdown.destan.brut.toLocaleString('tr-TR')}</p>
            </div>
            <div className="bg-gray-950/60 p-2.5 rounded-xl border border-gray-800">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Komisyon</p>
              <p className="text-sm md:text-base font-black text-amber-400 mt-1">₺{villaBreakdown.destan.comm.toLocaleString('tr-TR')}</p>
            </div>
            <div className="bg-gray-950/60 p-2.5 rounded-xl border border-gray-800">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Net Kalan</p>
              <p className="text-sm md:text-base font-black text-indigo-400 mt-1">₺{villaBreakdown.destan.net.toLocaleString('tr-TR')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-6 items-start">
        <div>
          <Calendar reservations={filteredData} activeVilla={activeFilter} />
          <TransactionList reservations={filteredData} onRefresh={loadData} onEdit={(item) => { setEditingItem(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </div>
        <ReservationForm
          onSave={() => { loadData(); setEditingItem(null); }}
          config={{ commission }}
          reservations={safeData}
          editingItem={editingItem}
          onCancelEdit={() => setEditingItem(null)}
          defaultVilla={activeFilter === 'All' ? 'Safira' : activeFilter}
        />
      </div>

      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </main>
  );
}
