'use client';

import React, { useState, useEffect } from 'react';
import { GoogleService, PriceService, VillaReservation, PriceRange } from '@/services/api';

export default function VillaDashboard() {
  const [reservations, setReservations] = useState<VillaReservation[]>([]);
  const [prices, setPrices] = useState<PriceRange[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(20);
  const [selectedApart, setSelectedApart] = useState<'Safira' | 'Destan'>('Safira');
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 1)); // Temmuz 2026
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-07-30');
  
  // Yeni Rezervasyon Form State'leri
  const [formApart, setFormApart] = useState<'Safira' | 'Destan'>('Safira');
  const [formName, setFormName] = useState('');
  const [formCin, setFormCin] = useState('');
  const [formCout, setFormCout] = useState('');
  const [formPrice, setFormPrice] = useState('');

  // Sekme Filtreleme State'i (Aktif vs Tamamlanan)
  const [filterTab, setFilterTab] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    async function loadAll() {
      const cloudData = await GoogleService.loadData();
      if (cloudData && cloudData.length > 0) {
        setReservations(cloudData);
      } else {
        setReservations(GoogleService.getLocalData());
      }
      setPrices(PriceService.getPrices());
      const savedComm = localStorage.getItem('villa_commission_rate');
      if (savedComm) setCommissionRate(parseFloat(savedComm));
    }
    loadAll();

    const handleDataUpdate = () => setReservations(GoogleService.getLocalData());
    const handlePriceUpdate = () => setPrices(PriceService.getPrices());
    const handleConfigUpdate = () => {
      const comm = localStorage.getItem('villa_commission_rate');
      if (comm) setCommissionRate(parseFloat(comm));
    };

    window.addEventListener('villa-data-update', handleDataUpdate);
    window.addEventListener('price-update', handlePriceUpdate);
    window.addEventListener('config-update', handleConfigUpdate);

    return () => {
      window.removeEventListener('villa-data-update', handleDataUpdate);
      window.removeEventListener('price-update', handlePriceUpdate);
      window.removeEventListener('config-update', handleConfigUpdate);
    };
  }, []);

  // Bugünün tarihi (24 Temmuz 2026 baz alınmıştır)
  const todayStr = '2026-07-24';
  const getTomorrowStr = () => '2026-07-25';
  const tomorrowStr = getTomorrowStr();

  // Kategorizasyon ve Bildirimler
  const activeReservations = reservations.filter(r => r.cout >= todayStr);
  const completedReservations = reservations.filter(r => r.cout < todayStr);

  const approachingCheckouts = activeReservations.filter(r => {
    return r.cout === todayStr || r.cout === tomorrowStr;
  });

  const displayedReservations = filterTab === 'active' ? activeReservations : completedReservations;

  // Finansal Özet Hesaplamaları
  const totalBrut = reservations.reduce((acc, r) => acc + (Number(r.brut) || 0), 0);
  const totalComm = reservations.reduce((acc, r) => acc + (Number(r.commAmt) || (Number(r.brut) * commissionRate / 100)), 0);
  const totalNet = totalBrut - totalComm;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formCin || !formCout) {
      alert('Lütfen tüm alanları doldurun.');
      return;
    }

    const start = new Date(formCin);
    const end = new Date(formCout);
    const nights = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    
    if (nights <= 0) {
      alert('Çıkış tarihi giriş tarihinden sonra olmalıdır.');
      return;
    }

    const pricePerNight = parseFloat(formPrice) || 3500;
    const brut = nights * pricePerNight;
    const commAmt = brut * (commissionRate / 100);
    const net = brut - commAmt;

    const newRes: VillaReservation = {
      id: Date.now(),
      type: 'villa',
      apart: formApart,
      name: formName,
      cin: formCin,
      cout: formCout,
      nights,
      price: pricePerNight,
      brut,
      net,
      commAmt,
      paidAmt: 0,
      remaining: brut
    };

    await GoogleService.saveData(newRes);
    setReservations(GoogleService.getLocalData());
    setFormName('');
    setFormCin('');
    setFormCout('');
    setFormPrice('');
    alert('Rezervasyon başarıyla kaydedildi!');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* ÜST BAŞLIK */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              Villa Yönetim Paneli
            </h1>
            <p className="text-slate-400 text-sm mt-1">Safira ve Destan Apart Rezervasyon & Finans Takibi</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full text-xs font-semibold">
              Komisyon: %{commissionRate}
            </span>
          </div>
        </header>

        {/* 🔔 ÇIKIŞI YAKLAŞANLAR BİLDİRİM PANELİ */}
        {approachingCheckouts.length > 0 && (
          <div className="p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-300 flex items-center justify-between shadow-lg animate-pulse">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🔔</span>
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

        {/* FİNANSAL ÖZET KUTULARI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Brüt Gelir</p>
            <p className="text-2xl font-bold text-emerald-400 mt-2">₺{totalBrut.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Toplam Komisyon</p>
            <p className="text-2xl font-bold text-amber-400 mt-2">₺{totalComm.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Size Kalan (Net)</p>
            <p className="text-2xl font-bold text-purple-400 mt-2">₺{totalNet.toLocaleString('tr-TR')}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Toplam Rezervasyon</p>
            <p className="text-2xl font-bold text-blue-400 mt-2">{reservations.length} Kayıt</p>
          </div>
        </div>

        {/* ORTA KISIM: TAKVİM VE FORM */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* TAKVİM BÖLÜMÜ */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedApart('Safira')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedApart === 'Safira' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  Safira Villası
                </button>
                <button 
                  onClick={() => setSelectedApart('Destan')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedApart === 'Destan' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  Destan Villası
                </button>
              </div>
              <span className="text-sm font-semibold text-slate-300">Temmuz 2026</span>
            </div>

            {/* Bilgilendirme */}
            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-sm text-slate-300">
              <p className="font-semibold text-purple-400 mb-1">Takvim Özeti</p>
              <p className="text-xs text-slate-400">Toplam kayıtlı {reservations.length} rezervasyonunuz Google E-Tablo ile senkronize durumdadır.</p>
            </div>
          </div>

          {/* YENİ REZERVASYON FORMU */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <span>✨</span> Yeni Rezervasyon
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">APART SEÇİMİ</label>
                <select 
                  value={formApart} 
                  onChange={(e) => setFormApart(e.target.value as 'Safira' | 'Destan')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="Safira">Safira</option>
                  <option value="Destan">Destan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">MİSAFİR ADI</label>
                <input 
                  type="text" 
                  placeholder="Misafir Adı Soyadı"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">GİRİŞ TARİHİ</label>
                  <input 
                    type="date" 
                    value={formCin}
                    onChange={(e) => setFormCin(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">ÇIKIŞ TARİHİ</label>
                  <input 
                    type="date" 
                    value={formCout}
                    onChange={(e) => setFormCout(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">GECELİK FİYAT (₺)</label>
                <input 
                  type="number" 
                  placeholder="Örn: 3500"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 transition-all text-sm mt-2"
              >
                KAYDET
              </button>
            </form>
          </div>

        </div>

        {/* ALT KISIM: AKTİF VE TAMAMLANAN REZERVASYONLAR LİSTESİ */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h3 className="text-lg font-bold text-slate-100">Rezervasyon Listesi & Arşiv</h3>
            
            {/* Sekme Butonları */}
            <div className="flex space-x-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button 
                onClick={() => setFilterTab('active')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterTab === 'active' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Aktif / Gelecek ({activeReservations.length})
              </button>
              <button 
                onClick={() => setFilterTab('completed')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterTab === 'completed' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Tamamlanan / Arşiv ({completedReservations.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Misafir</th>
                  <th className="py-3 px-4">Apart</th>
                  <th className="py-3 px-4">Giriş</th>
                  <th className="py-3 px-4">Çıkış</th>
                  <th className="py-3 px-4">Gece</th>
                  <th className="py-3 px-4">Brüt Tutar</th>
                  <th className="py-3 px-4">Net Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {displayedReservations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">
                      Bu kategoride kayıt bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  displayedReservations.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-200">{r.name}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${r.apart === 'Safira' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'}`}>
                          {r.apart}
                        </span>
                      </td>
                      <td className="py-3 px-4">{r.cin}</td>
                      <td className="py-3 px-4">{r.cout}</td>
                      <td className="py-3 px-4">{r.nights} Gece</td>
                      <td className="py-3 px-4 font-semibold text-emerald-400">₺{Number(r.brut).toLocaleString('tr-TR')}</td>
                      <td className="py-3 px-4 font-semibold text-purple-400">₺{Number(r.net || (r.brut * (1 - commissionRate / 100))).toLocaleString('tr-TR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}
