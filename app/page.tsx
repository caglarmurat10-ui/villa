"use client";

import { useEffect, useMemo, useState } from "react";
import Dashboard from "@/components/Dashboard";
import Calendar from "@/components/Calendar";
import ReservationForm from "@/components/ReservationForm";
import TransactionList from "@/components/TransactionList";
import Calculator from "@/components/Calculator";
import Settings from "@/components/Settings";
import FilterBar from "@/components/FilterBar";
import { GoogleService, VillaReservation } from "@/services/api";
import { Loader2, Cloud, Calculator as CalcIcon, Settings as SettingsIcon, Bell } from "lucide-react";

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

  // KOMİSYON VE NET TUTAR DÜZELTMESİ: Eksik komisyonları güncel orana göre dinamik hesapla
  const processedData = useMemo(() => {
    return safeData.map(item => {
      if (!item) return item;
      const brut = Number(item.brut) || (Number(item.nights || 0) * Number(item.price || 0));
      const commAmt = Number(item.commAmt) > 0 ? Number(item.commAmt) : (brut * commission / 100);
      const net = brut - commAmt;
      return {
        ...item,
        brut,
        commAmt,
        net
      };
    });
  }, [safeData, commission]);

  // Önce Villa Filtresi (All, Safira, Destan)
  const filteredByVilla = useMemo(() => activeFilter === 'All'
    ? processedData
    : processedData.filter(item => item && item.apart === activeFilter), [activeFilter, processedData]);

  // Bugünün Tarihi ve Çıkış Yaklaşanlar Hesaplaması (Aktif vs Tamamlanan)
  const todayStr = new Date().toISOString().split('T')[0];
  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };
  const tomorrowStr = getTomorrowStr();

  const activeReservations = useMemo(() => 
    filteredByVilla.filter(item => item && item.cout >= todayStr), 
  [filteredByVilla, todayStr]);

  const completedReservations = useMemo(() => 
    filteredByVilla.filter(item => item && item.cout < todayStr), 
  [filteredByVilla, todayStr]);

  // Çıkışı bugün veya yarın olanlar (Bildirim için)
  const approachingCheckouts = useMemo(() => 
    activeReservations.filter(item => item && (item.cout === todayStr || item.cout === tomorrowStr)), 
  [activeReservations, todayStr, tomorrowStr]);

  // Ekranda (Takvim ve Listede) gösterilecek nihai veri setini sekmeye göre belirliyoruz
  const filteredData = useMemo(() => 
    reservationTab === 'active' ? activeReservations : completedReservations,
  [reservationTab, activeReservations, completedReservations]);

  const stats = useMemo(() => filteredData.reduce((acc, curr) => ({
    brut: acc.brut + (curr?.brut || 0),
    comm: acc.comm + (curr?.commAmt || 0),
    net: acc.net + (curr?.net || 0),
    reservations: acc.reservations + 1,
    nights: acc.nights + (curr?.nights || 0)
  }), { brut: 0, comm: 0, net: 0, reservations: 0, nights: 0 }), [filteredData]);

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

      {/* ÇIKIŞI YAKLAŞANLAR BİLDİRİM PANELİ */}
      {approachingCheckouts.length > 0 && (
        <div className="mb-6 p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-300 flex items-center justify-between shadow-lg animate-pulse">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
              <Bell className="w-5 h-5" />
            </span>
            <div>
              <h4 className="font-bold text-sm">Çıkışı Yaklaşan Misafirler Var!</h4>
              <p className="text-xs text-amber-200/90 mt-0.5">
                {approachingCheckouts.map(r => `${r.name} (${r.apart} - Çıkış: ${r.cout})`).join(', ')} için çıkış vakti geldi veya yarın doluyor.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-amber-500/20 rounded-full text-xs font-bold border border-amber-500/40">
            {approachingCheckouts.length} Misafir
          </span>
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

      <Dashboard stats={stats} />

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
