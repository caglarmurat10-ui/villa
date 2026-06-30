"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Dashboard from "@/components/Dashboard";
import Calendar from "@/components/Calendar";
import ReservationForm from "@/components/ReservationForm";
import TransactionList from "@/components/TransactionList";
import Calculator from "@/components/Calculator";
import Settings from "@/components/Settings";
import FilterBar from "@/components/FilterBar"; // YENİ: Filtre bileşenimizi içe aktarıyoruz
import { GoogleService, VillaReservation } from "@/services/api";
import { Loader2, Cloud, Calculator as CalcIcon, Settings as SettingsIcon } from "lucide-react";

export default function Home() {
  const [data, setData] = useState<VillaReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const [editingItem, setEditingItem] = useState<VillaReservation | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // YENİ: Hangi filtrenin aktif olduğunu tutan State (Varsayılan: Tümü)
  const [activeFilter, setActiveFilter] = useState<'All' | 'Safira' | 'Destan'>('All');

  // Configuration (Could be dynamic later)
  const config = { commission: 10 };

  const loadData = async () => {
    // 1. Fast Load from Backup (Optimistic)
    if (data.length === 0) setLoading(true);

    try {
      const backupRes = await fetch('/api/backup');
      if (backupRes.ok) {
        const backupData = await backupRes.json();
        if (Array.isArray(backupData) && backupData.length > 0) {
          setData(backupData);
          setLoading(false); 
        }
      }
    } catch (e) {
      console.error("Backup load failed", e);
    }

    // 2. Sync with Cloud (Authoritative)
    setSynced(false); 
    const cloudData = await GoogleService.loadData();

    if (cloudData !== null) {
      setData(cloudData);
      setSynced(true);
    } 
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (item: VillaReservation) => {
    setEditingItem(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveComplete = () => {
    loadData();
    setEditingItem(null);
  };

  // YENİ: Tüm veriyi seçili filtreye göre süzüyoruz
  const filteredData = activeFilter === 'All' 
    ? data 
    : data.filter(item => item.apart === activeFilter);

  // GÜNCELLENDİ: İstatistikleri artık süzülmüş (filteredData) veriler üzerinden hesaplıyoruz
  const stats = filteredData.reduce((acc, curr) => ({
    brut: acc.brut + (curr.brut || 0),
    comm: acc.comm + (curr.commAmt || 0),
    net: acc.net + (curr.net || 0)
  }), { brut: 0, comm: 0, net: 0 });

  return (
    <div className="max-w-md mx-auto p-4 min-h-screen">
      <Calculator isOpen={showCalculator} onClose={() => setShowCalculator(false)} />

      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Apart Takip v2.2
          </h1>
          <p className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
            {loading ? (
              <span className="text-amber-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor</span>
            ) : synced ? (
              <span className="text-emerald-400 flex items-center gap-1"><Cloud className="w-3 h-3" /> Bulut Aktif</span>
            ) : (
              <span className="text-gray-500">Çevrimdışı</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 bg-gray-800 rounded-xl text-indigo-400 border border-indigo-500/20 hover:bg-gray-700 transition"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowCalculator(true)}
            className="p-2 bg-gray-800 rounded-xl text-amber-400 border border-amber-500/20 hover:bg-gray-700 transition"
          >
            <CalcIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* YENİ: Menü Filtresi */}
      <FilterBar activeFilter={activeFilter} setFilter={setActiveFilter} />

      <Dashboard stats={stats} />

      {/* GÜNCELLENDİ: Sadece filtrelenmiş veriyi gönderiyoruz */}
      <Calendar reservations={filteredData} />

      <ReservationForm
        onSave={handleSaveComplete}
        config={config}
        editingItem={editingItem}
        onCancelEdit={() => setEditingItem(null)}
      />

      {/* GÜNCELLENDİ: Sadece filtrelenmiş veriyi gönderiyoruz */}
      <TransactionList
        reservations={filteredData}
        onRefresh={loadData}
        onEdit={handleEdit}
      />

      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
