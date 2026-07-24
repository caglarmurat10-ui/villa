import React from 'react';

interface DashboardStats {
  brut: number;
  comm: number;
  net: number;
  reservations: number;
  nights: number;
}

interface DashboardProps {
  stats: DashboardStats;
}

export default function Dashboard({ stats }: DashboardProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 shadow-lg">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Brüt Gelir</p>
        <p className="text-xl md:text-2xl font-black text-emerald-400 mt-1">₺{stats.brut.toLocaleString('tr-TR')}</p>
      </div>

      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 shadow-lg">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Komisyon Tutarı</p>
        <p className="text-xl md:text-2xl font-black text-amber-400 mt-1">₺{stats.comm.toLocaleString('tr-TR')}</p>
      </div>

      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 shadow-lg">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Size Kalan (Net)</p>
        <p className="text-xl md:text-2xl font-black text-indigo-400 mt-1">₺{stats.net.toLocaleString('tr-TR')}</p>
      </div>

      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 shadow-lg">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Toplam Kayıt</p>
        <p className="text-xl md:text-2xl font-black text-sky-400 mt-1">{stats.reservations} Rezervasyon</p>
      </div>
    </div>
  );
}
