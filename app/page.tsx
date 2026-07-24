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
import { Loader2, Cloud, Calculator as CalcIcon, Settings as SettingsIcon } from "lucide-react";

export default function Home() {
  const [data, setData] = useState<VillaReservation[]>(() => GoogleService.getLocalData());
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const [editingItem, setEditingItem] = useState<VillaReservation | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Safira' | 'Destan'>('All');
  const [commission, setCommission] = useState(10);

  const loadData = async () => {
    if (data.length === 0) setLoading(true);
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
    if (cloudData !== null) {
      setData(cloudData);
      setSynced(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    const refreshLocalData = () => setData(GoogleService.getLocalData());
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

  const filteredData = useMemo(() => activeFilter === 'All'
    ? data
    : data.filter(item => item.apart === activeFilter), [activeFilter, data]);

  const stats = useMemo(() => filteredData.reduce((acc, curr) => ({
    brut: acc.brut + (curr.brut || 0),
    comm: acc.comm + (curr.commAmt || 0),
    net: acc.net + (curr.net || 0),
    paid: acc.paid + (curr.paidAmt || 0),
    remaining: acc.remaining + Math.max(curr.remaining || 0, 0),
    reservations: acc.reservations + 1,
    nights: acc.nights + (curr.nights || 0)
  }), { brut: 0, comm: 0, net: 0, paid: 0, remaining: 0, reservations: 0, nights: 0 }), [filteredData]);

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

      <FilterBar activeFilter={activeFilter} setFilter={setActiveFilter} />
      <Dashboard stats={stats} />

      <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-6 items-start">
        <div>
          <Calendar reservations={filteredData} activeVilla={activeFilter} />
          <TransactionList reservations={filteredData} onRefresh={loadData} onEdit={(item) => { setEditingItem(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </div>
        <ReservationForm
          onSave={() => { loadData(); setEditingItem(null); }}
          config={{ commission }}
          reservations={data}
          editingItem={editingItem}
          onCancelEdit={() => setEditingItem(null)}
          defaultVilla={activeFilter === 'All' ? 'Safira' : activeFilter}
        />
      </div>

      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </main>
  );
}
