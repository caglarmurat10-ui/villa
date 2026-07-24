"use client";

interface DashboardProps {
  stats: { brut: number; comm: number; net: number; paid: number; remaining: number; reservations: number; nights: number; }
}

const money = (value: number) => `₺${value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;

export default function Dashboard({ stats }: DashboardProps) {
  const cards = [
    ['Brüt Gelir', money(stats.brut), 'text-emerald-400'],
    ['Komisyon', money(stats.comm), 'text-amber-400'],
    ['Size Kalan', money(stats.net), 'text-indigo-300'],
    ['Tahsil Edilen', money(stats.paid), 'text-cyan-400'],
    ['Kalan Ödeme', money(stats.remaining), 'text-rose-400'],
    ['Rezervasyon', `${stats.reservations} kayıt · ${stats.nights} gece`, 'text-white'],
  ];
  return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
    {cards.map(([label, value, color]) => <div key={label} className="glass-panel p-4 rounded-2xl min-h-24 flex flex-col justify-between">
      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{label}</p>
      <p className={`text-base font-black ${color}`}>{value}</p>
    </div>)}
  </div>;
}
