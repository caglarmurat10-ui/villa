"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VillaReservation } from "@/services/api";

interface CalendarProps {
    reservations: VillaReservation[];
}

export default function Calendar({ reservations }: CalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Calendar Logic
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = firstDay === 0 ? 6 : firstDay - 1; // Start from Monday (0: Mon, 6: Sun)

    const changeMonth = (delta: number) => {
        setCurrentDate(new Date(year, month + delta, 1));
    };

    const getDayContent = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Find reservations for this day (inclusive start, exclusive end)
        const activeRes = reservations.filter(r => dateStr >= r.cin && dateStr < r.cout);

        let bgColor = "bg-white/5";
        let status = "";

        if (activeRes.length > 0) {
            if (activeRes.length > 1) {
                // Overlap or multiple
                bgColor = "bg-gradient-to-br from-indigo-600 to-emerald-600";
            } else {
                bgColor = activeRes[0].apart === 'Safira' ? 'bg-indigo-600/80 border-indigo-500/50' : 'bg-emerald-600/80 border-emerald-500/50';
            }
            status = "Dolu";
        }

        return { bgColor, status };
    };

    return (
        <div className="glass-panel p-5 rounded-3xl mb-6 border border-white/5 bg-gray-900/40">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2 text-white">📅 Doluluk Takvimi</h3>
                <div className="flex items-center gap-3">
                    <button onClick={() => changeMonth(-1)} className="p-1 px-3 glass rounded-lg hover:bg-white/10 text-white">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold min-w-[100px] text-center uppercase tracking-wider text-gray-300">
                        {new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(currentDate)}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-1 px-3 glass rounded-lg hover:bg-white/10 text-white">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Header Days */}
            <div className="grid grid-cols-7 gap-1 text-center text-[9px] text-gray-500 mb-2 font-bold uppercase">
                <div>Pt</div><div>Sa</div><div>Ça</div><div>Pe</div><div>Cu</div><div>Ct</div><div>Pa</div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startDay }).map((_, i) => (
                    <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const { bgColor, status } = getDayContent(day);
                    return (
                        <div
                            key={day}
                            className={`min-h-[45px] ${bgColor} rounded-lg flex flex-col items-center justify-center border border-white/5 relative transition-all`}
                        >
                            <span className={`text-[11px] font-bold ${status ? 'text-white' : 'text-gray-500'}`}>{day}</span>
                            {status && <span className="text-[6px] opacity-80 absolute bottom-1 text-white uppercase">{status}</span>}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-4 justify-center text-[9px] font-bold uppercase tracking-widest text-gray-400">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Safira</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Destan</div>
            </div>
        </div>
    );
}
