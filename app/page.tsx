"use client";

import { useEffect, useMemo, useState } from "react";
import Calendar from "@/components/Calendar";
import ReservationForm from "@/components/ReservationForm";
import TransactionList from "@/components/TransactionList";
import Calculator from "@/components/Calculator";
import Settings from "@/components/Settings";
import FilterBar from "@/components/FilterBar";
import { GoogleService, VillaReservation } from "@/services/api";
import { Loader2, Cloud, Calculator as CalcIcon, Settings as SettingsIcon, Home as HomeIcon, Wallet, MessageSquare, Phone, Send, Calendar as CalendarIcon, Bell, Sparkles } from "lucide-react";

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

  // Görünüm Sekmesi: 'dashboard' (Ana Ekran) | 'messages' (Mesaj Paneli) | 'cleaning' (Çift Temizlik Günleri)
  const [viewMode, setViewMode] = useState<'dashboard' | 'messages' | 'cleaning'>('dashboard');

  // Misafir telefon numaralarını localStorage ile senkronize tutma
  const [phoneInputs, setPhoneInputs] = useState<Record<string, string>>({});

  // Aktif veya Tamamlanan Rezervasyon Sekme Filtresi (Ana ekran içi)
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

    // Kayıtlı telefon numaralarını localStorage'dan yükle
    try {
      const savedPhones = localStorage.getItem('villa_guest_phones');
      if (savedPhones) {
        setPhoneInputs(JSON.parse(savedPhones));
      }
    } catch (e) {
      console.error("Failed to load saved phones", e);
    }

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

  // Telefon numarası değiştiğinde localStorage'a kaydet
  const handlePhoneChange = (id: string | number, val: string) => {
    const key = String(id);
    const updated = { ...phoneInputs, [key]: val };
    setPhoneInputs(updated);
    try {
      localStorage.setItem('villa_guest_phones', JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save phone", e);
    }
  };

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

  // Çıkışı bugün veya yarın olanlar (Hatırlatma için)
  const approachingCheckouts = useMemo(() => 
    activeReservations.filter(item => item && (item.cout === todayStr || item.cout === tomorrowStr)), 
  [activeReservations, todayStr, tomorrowStr]);

  // Aynı gün her iki villada da giriş veya çıkış olan günleri (Çift Temizlik) bulma
  const doubleCleaningDays = useMemo(() => {
    const safiraRes = processedData.filter(r => r && r.apart === 'Safira' && r.cin && r.cout);
    const destanRes = processedData.filter(r => r && r.apart === 'Destan' && r.cin && r.cout);
    
    const dateMap: Record<string, { safira?: VillaReservation; destan?: VillaReservation }> = {};

    safiraRes.forEach(s => {
      [s.cin, s.cout].forEach(date => {
        if (!date) return;
        if (!dateMap[date]) dateMap[date] = {};
        dateMap[date].safira = s;
      });
    });

    destanRes.forEach(d => {
      [d.cin, d.cout].forEach(date => {
        if (!date) return;
        if (!dateMap[date]) dateMap[date] = {};
        dateMap[date].destan = d;
      });
    });

    const results: { date: string; safira?: VillaReservation; destan?: VillaReservation }[] = [];
    Object.keys(dateMap).sort().forEach(date => {
      if (dateMap[date].safira && dateMap[date].destan) {
        results.push({
          date,
          safira: dateMap[date].safira,
          destan: dateMap[date].destan
        });
      }
    });

    return results;
  }, [processedData]);

  const filteredData = useMemo(() => 
    reservationTab === 'active' ? activeReservations : completedReservations,
  [reservationTab, activeReservations, completedReservations]);

  // İşlem geçmişi için listeleri villa bazlı ayırma
  const safiraTransactionList = useMemo(() => 
    filteredData.filter(item => item && item.apart === 'Safira'), 
  [filteredData]);

  const destanTransactionList = useMemo(() => 
    filteredData.filter(item => item && item.apart === 'Destan'), 
  [filteredData]);

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

  // WhatsApp URL oluşturucu
  const getWhatsAppUrl = (phone: string, text: string) => {
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const encodedText = encodeURIComponent(text);
    return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
  };

  // ÇIKIŞ İÇİN WHATSAPP MESAJI
  const sendCheckoutWhatsApp = (reservationId: string | number | undefined, apart: string) => {
    const reviewLink = apart === 'Safira' 
      ? 'https://g.page/r/CV4SGDD8Hr_7EBM/review' 
      : 'https://g.page/r/CZMpV_CdinkEEBM/review';

    const text = `Merhaba, yarın çıkışınız var çıkışlar 9 ile 10 arasındadır ben saat 10 doğru gelirim sizde hazırlanmış olursunuz iyi günler dilerim\n\nGörüşleriniz bizim için çok değerli. Değerlendirmeniz için: ${reviewLink}`;
    const key = String(reservationId || '');
    const phone = phoneInputs[key] || '';
    window.open(getWhatsAppUrl(phone, text), '_blank');
  };

  // GİRİŞ İÇİN WHATSAPP MESAJI
  const sendCheckinWhatsApp = (reservationId: string | number | undefined, apart: string) => {
    let text = '';
    if (apart === 'Destan') {
      text = `Merhaba, ben Murat villanın konumunu atıyorum girişler saat 16 ile 22 arasındadır. Yaklaşınca haber verirsiniz. Hayırlı yolculuklar\n\nhttps://maps.app.goo.gl/QmWfNNF9ikQ5G1CFA?g_st=aw`;
    } else {
      text = `Merhaba, ben Murat villanın konumunu atıyorum girişler saat 16 ile 22 arasındadır. Ödeme girişte nakit olarak yapılmaktadır. Yaklaşınca haber verirsiniz. Hayırlı yolculuklar\n\nhttps://maps.app.goo.gl/QPmffSfmcw3KeBEs9`;
    }

    const key = String(reservationId || '');
    const phone = phoneInputs[key] || '';
    window.open(getWhatsAppUrl(phone, text), '_blank');
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

      {/* ANA GÖRÜNÜM SEKMELERİ */}
      <div className="flex flex-wrap gap-2 mb-6 bg-gray-900/80 p-1.5 rounded-2xl border border-gray-800 w-fit">
        <button 
          onClick={() => setViewMode('dashboard')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
        >
          <CalendarIcon className="w-4 h-4" /> Ana Takip & Finans
        </button>
        <button 
          onClick={() => setViewMode('messages')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'messages' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
        >
          <MessageSquare className="w-4 h-4" /> WhatsApp Mesaj Paneli ({activeReservations.length})
        </button>
        <button 
          onClick={() => setViewMode('cleaning')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'cleaning' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
        >
          <Sparkles className="w-4 h-4 text-emerald-400" /> Çift Temizlik Günleri ({doubleCleaningDays.length})
        </button>
      </div>

      {/* ==================================================== */}
      {/* 1. ÇİFT TEMİZLİK GÜNLERİ SEKMESİ */}
      {/* ==================================================== */}
      {viewMode === 'cleaning' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-gradient-to-r from-gray-900 via-emerald-950/30 to-gray-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-black text-emerald-300 mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" /> Aynı Gün İki Villada Temizlik / Giriş-Çıkış Olan Günler
            </h3>
            <p className="text-xs text-gray-300">
              Aşağıdaki tarihlerde hem Safira'da hem de Destan'da aynı gün hareket (giriş/çıkış) bulunmaktadır. Bu günler iki evi birden hazırlamanız gereken yoğun temizlik günleridir.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {doubleCleaningDays.length === 0 ? (
              <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-800 text-gray-400 text-sm">
                Aynı gün her iki villada da giriş/çıkış olan herhangi bir gün bulunmuyor.
              </div>
            ) : (
              doubleCleaningDays.map((item, idx) => (
                <div key={idx} className="bg-gray-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-lg space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-black border border-emerald-500/30">
                      Tarih: {item.date}
                    </span>
                    <span className="text-xs text-emerald-400 font-bold">🧹 Çift Temizlik Günü</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Safira */}
                    <div className="bg-purple-950/20 border border-purple-500/20 p-3 rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-purple-300">Safira</span>
                        <span className="text-gray-300">{item.safira?.name}</span>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Giriş: <span className="text-white font-semibold">{item.safira?.cin}</span> | Çıkış: <span className="text-white font-semibold">{item.safira?.cout}</span>
                      </p>
                    </div>

                    {/* Destan */}
                    <div className="bg-pink-950/20 border border-pink-500/20 p-3 rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-pink-300">Destan</span>
                        <span className="text-gray-300">{item.destan?.name}</span>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Giriş: <span className="text-white font-semibold">{item.destan?.cin}</span> | Çıkış: <span className="text-white font-semibold">{item.destan?.cout}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. WHATSAPP MESAJ YÖNETİMİ SEKMESİ */}
      {/* ==================================================== */}
      {viewMode === 'messages' && (
        <div className="space-y-6 animate-fadeIn">
          {/* ÇIKIŞI YAKLAŞANLAR ÖZEL HATIRLATMA PANELİ */}
          {approachingCheckouts.length > 0 && (
            <div className="p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-300 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                    <Bell className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="font-bold text-sm">Çıkışı Bugün veya Yarın Olan Misafirler Var!</h4>
                    <p className="text-xs text-amber-200/90 mt-0.5">Aşağıdaki misafirler için çıkış vakti geldi, hemen hatırlatma mesajı atabilirsiniz.</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-amber-500/20 rounded-full text-xs font-bold border border-amber-500/40">
                  {approachingCheckouts.length} Misafir
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-amber-500/20">
                {approachingCheckouts.map(r => {
                  const rKey = String(r.id || '');
                  return (
                    <div key={`approach-${rKey}`} className="flex flex-col gap-2 bg-black/40 p-3 rounded-xl border border-amber-500/20">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${r.apart === 'Safira' ? 'bg-purple-500/30 text-purple-200' : 'bg-pink-500/30 text-pink-200'}`}>{r.apart}</span>
                          {r.name}
                        </span>
                        <span className="text-amber-200/80 font-semibold">Çıkış: {r.cout}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Tel: 905XXXXXXXXX"
                            value={phoneInputs[rKey] || ''}
                            onChange={(e) => handlePhoneChange(r.id, e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <button
                          onClick={() => sendCheckoutWhatsApp(r.id, r.apart)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow transition-all whitespace-nowrap"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Çıkış & Yorum At
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-gradient-to-r from-gray-900 via-sky-950/30 to-gray-900 border border-sky-500/30 rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-black text-sky-300 mb-1 flex items-center gap-2">
              <Send className="w-5 h-5 text-sky-400" /> Tüm Aktif Misafir İletişim Listesi
            </h3>
            <p className="text-xs text-gray-300">
              Giriş veya çıkış işlemleri için hangi villada kimin kaldığını görüp telefon numaralarını yönetebilir, tek tıkla WhatsApp mesajı gönderebilirsiniz.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {activeReservations.length === 0 ? (
              <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-800 text-gray-400 text-sm">
                Aktif veya gelecek rezervasyon bulunmuyor.
              </div>
            ) : (
              activeReservations.map(r => {
                const rKey = String(r.id || '');
                return (
                  <div key={rKey} className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${r.apart === 'Safira' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-pink-500/20 text-pink-300 border border-pink-500/30'}`}>
                          {r.apart}
                        </span>
                        <h4 className="font-extrabold text-white text-sm">{r.name}</h4>
                      </div>
                      <p className="text-xs text-gray-400">
                        Giriş: <span className="text-sky-300 font-semibold">{r.cin}</span> &nbsp;|&nbsp; Çıkış: <span className="text-amber-300 font-semibold">{r.cout}</span>
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      {/* Telefon Giriş Alanı */}
                      <div className="relative w-full sm:w-56">
                        <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Tel: 905XXXXXXXXX"
                          value={phoneInputs[rKey] || ''}
                          onChange={(e) => handlePhoneChange(r.id, e.target.value)}
                          className="w-full bg-gray-950 border border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Aksiyon Butonları */}
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => sendCheckinWhatsApp(r.id, r.apart)}
                          className="flex-1 sm:flex-none px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Konum Gönder
                        </button>
                        <button
                          onClick={() => sendCheckoutWhatsApp(r.id, r.apart)}
                          className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Çıkış & Yorum At
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. ANA TAKİP & FİNANS DASHBOARD SEKMESİ */}
      {/* ==================================================== */}
      {viewMode === 'dashboard' && (
        <div className="space-y-6 animate-fadeIn">
          <FilterBar activeFilter={activeFilter} setFilter={setActiveFilter} />

          {/* AKTİF VE TAMAMLANAN REZERVASYON SEKMELERİ */}
          <div className="flex space-x-2 bg-gray-900/60 p-1.5 rounded-2xl border border-gray-800 w-fit">
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
          <div className="bg-gradient-to-r from-gray-900 via-indigo-950/40 to-gray-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Safira Özet */}
            <div className="bg-gray-900/90 border border-purple-500/30 rounded-2xl p-5 shadow-xl">
              <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-2">
                <h3 className="font-extrabold text-purple-400 flex items-center gap-2">
                  <HomeIcon className="w-4 h-4" /> Safira
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
                  <HomeIcon className="w-4 h-4" /> Destan
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
            <div className="space-y-6">
              <Calendar reservations={filteredData} activeVilla={activeFilter} />

              {/* SAFİRA İŞLEM GEÇMİŞİ */}
              {(activeFilter === 'All' || activeFilter === 'Safira') && (
                <div className="space-y-2">
                  <h3 className="text-purple-400 font-extrabold text-sm flex items-center gap-2 px-1">
                    <HomeIcon className="w-4 h-4" /> Safira İşlem Geçmişi ({safiraTransactionList.length})
                  </h3>
                  <TransactionList 
                    reservations={safiraTransactionList} 
                    onRefresh={loadData} 
                    onEdit={(item) => { setEditingItem(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                  />
                </div>
              )}

              {/* DESTAN İŞLEM GEÇMİŞİ */}
              {(activeFilter === 'All' || activeFilter === 'Destan') && (
                <div className="space-y-2">
                  <h3 className="text-pink-400 font-extrabold text-sm flex items-center gap-2 px-1">
                    <HomeIcon className="w-4 h-4" /> Destan İşlem Geçmişi ({destanTransactionList.length})
                  </h3>
                  <TransactionList 
                    reservations={destanTransactionList} 
                    onRefresh={loadData} 
                    onEdit={(item) => { setEditingItem(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                  />
                </div>
              )}
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
        </div>
      )}

      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </main>
  );
}
