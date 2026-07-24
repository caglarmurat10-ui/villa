"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LogIn, LogOut } from "lucide-react";
import { VillaReservation } from "@/services/api";

interface CalendarProps { reservations: VillaReservation[]; activeVilla: 'All' | 'Safira' | 'Destan'; }

const COLORS = {
  Safira: "bg-blue-600/80 border-blue-400/50",
  Destan: "bg-rose-600/80 border-rose-400/50",
};

export default function Calendar({ reservations, activeVilla }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = firstDay === 0 ? 6 : firstDay - 1;
  const dateString = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const selectedReservations = useMemo(() => selectedDay
    ? reservations.filter(r => selectedDay >= r.cin && selectedDay < r.cout)
    : [], [reservations, selectedDay]);

  return <section className="glass-panel p-5 rounded-3xl mb-6">
    <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
      <div>
        <h3 className="font-black text-white">{activeVilla === 'All' ? 'Tüm Villalar' : `${activeVilla} Villası`} Takvimi</h3>
        <p className="text-xs text-gray-400">Dolu bir güne dokunarak misafiri görebilirsiniz.</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 glass rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-xs font-bold min-w-[120px] text-center uppercase text-gray-300">{new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(currentDate)}</span>
        <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 glass rounded-lg"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>

    <div className="grid grid-cols-7 gap-1 text-center text-[9px] text-gray-500 mb-2 font-bold uppercase">
      {['Pt','Sa','Ça','Pe','Cu','Ct','Pa'].map(d => <div key={d}>{d}</div>)}
    </div>
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: startDay }).map((_, i) => <div key={`e-${i}`} />)}
      {Array.from({ length: daysInMonth }).map((_, i) => {
        const day = i + 1;
        const date = dateString(day);
        const active = reservations.filter(r => date >= r.cin && date < r.cout);
        const villas = Array.from(new Set(active.map(r => r.apart)));
        const color = villas.length > 1 ? 'bg-gradient-to-br from-blue-600 to-rose-600 border-white/20' : villas.length === 1 ? COLORS[villas[0] as 'Safira'|'Destan'] : 'bg-white/[0.03] border-white/5';
        const hasCheckIn = reservations.some(r => r.cin === date);
        const hasCheckOut = reservations.some(r => r.cout === date);
        return <button key={day} onClick={() => setSelectedDay(date)} className={`min-h-[58px] ${color} rounded-xl border relative transition hover:scale-[1.03] ${selectedDay === date ? 'ring-2 ring-white' : ''}`}>
          <span className={`text-xs font-bold ${active.length ? 'text-white' : 'text-gray-500'}`}>{day}</span>
          {active.length > 0 && <span className="block text-[7px] text-white/90 mt-1 truncate px-1">{active[0].name}</span>}
          <span className="absolute bottom-1 left-1 flex gap-0.5">{hasCheckIn && <LogIn className="w-2.5 h-2.5" />}{hasCheckOut && <LogOut className="w-2.5 h-2.5" />}</span>
        </button>;
      })}
    </div>

    {selectedDay && <div className="mt-4 p-4 rounded-2xl bg-black/20 border border-white/5">
      <p className="text-xs font-bold text-gray-300 mb-2">{new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' }).format(new Date(`${selectedDay}T12:00:00`))}</p>
      {selectedReservations.length === 0 ? <p className="text-xs text-gray-500">Bu tarihte villa boş.</p> : selectedReservations.map(r => <div key={r.id} className="flex justify-between gap-3 py-2 border-t border-white/5 first:border-0">
        <div><p className="text-sm font-bold">{r.name}</p><p className="text-[10px] text-gray-400">{r.apart} · {r.cin} → {r.cout}</p></div>
        <p className="text-xs font-bold text-indigo-300">₺{r.net.toLocaleString('tr-TR')}</p>
      </div>)}
    </div>}
  </section>;
}
