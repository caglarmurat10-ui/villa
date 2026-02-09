"use client";

import { Edit, Trash2, Bell } from "lucide-react";
import { VillaReservation, GoogleService } from "@/services/api";

interface TransactionListProps {
    reservations: VillaReservation[];
    onRefresh: () => void;
    onEdit: (item: VillaReservation) => void;
}

export default function TransactionList({ reservations, onRefresh, onEdit }: TransactionListProps) {

    const handleDelete = async (id: number) => {
        if (confirm("Bu kaydı silmek istediğine emin misin?")) {
            const success = await GoogleService.deleteData(id);
            if (success) {
                alert("Silindi! 🗑️");
                onRefresh();
            } else {
                alert("Silinemedi ❌");
            }
        }
    };

    // Sort by Check-in date (descending)
    const sorted = [...reservations].sort((a, b) => new Date(b.cin).getTime() - new Date(a.cin).getTime());

    // Notification Logic (Check-out near)
    const getDaysDifference = (dateStr: string) => {
        if (!dateStr) return 999;
        const [y, m, d] = dateStr.split('-').map(Number);
        const coutDate = new Date(y, m - 1, d); // Local Midnight
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Local Midnight

        const diffTime = coutDate.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const notifications = sorted.filter(r => {
        const diffDays = getDaysDifference(r.cout);
        return diffDays === 0 || diffDays === 1;
    });

    return (
        <div className="space-y-6">

            {/* Notifications Area */}
            {notifications.length > 0 && (
                <div className="space-y-2">
                    {notifications.map(n => {
                        const diff = getDaysDifference(n.cout);
                        const isToday = diff === 0;
                        return (
                            <div key={`notif-${n.id}`} className={`p-4 rounded-xl flex items-center justify-between border-2 shadow-lg ${isToday ? 'border-rose-500 bg-rose-500/20 text-rose-200' : 'border-amber-500 bg-amber-500/20 text-amber-200'} animate-pulse`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${isToday ? 'bg-rose-500 text-white' : 'bg-amber-500 text-black'}`}>
                                        <Bell className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-white">{n.name} ({n.apart})</div>
                                        <div className="text-xs font-bold uppercase tracking-wide">{isToday ? 'BUGÜN ÇIKIYOR!' : 'Yarın çıkacak.'}</div>
                                    </div>
                                </div>
                                <div className="text-xs font-mono bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">{n.cout.split('-').reverse().join('.')}</div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="glass-panel rounded-3xl overflow-hidden shadow-xl bg-gray-900/40 border border-white/5">
                <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-300 tracking-tighter">İşlem Geçmişi</h3>
                    <span className="text-[10px] bg-indigo-500 px-2 py-0.5 rounded-full text-white">{reservations.length} Kayıt</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                        <thead className="text-gray-500 border-b border-white/5 bg-gray-800/30 uppercase text-[9px]">
                            <tr>
                                <th className="p-4">Misafir</th>
                                <th className="p-4">Tarih</th>
                                <th className="p-4 text-right">Durum</th>
                                <th className="p-4 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sorted.length === 0 ? (
                                <tr><td colSpan={4} className="p-4 text-center text-gray-500">Kayıt yok.</td></tr>
                            ) : sorted.map((item) => (
                                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-white">{item.name}</div>
                                        <span className={`text-[9px] uppercase font-bold ${item.apart === 'Safira' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                            {item.apart}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-gray-400 text-[10px]">{item.cin}</div>
                                        <div className="font-medium text-rose-400 text-[10px]">{item.cout}</div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex flex-col items-end gap-0.5">
                                            {/* Remaining */}
                                            {item.remaining && item.remaining > 0 ? (
                                                <div className="text-rose-400 font-bold bg-rose-400/10 px-1.5 py-0.5 rounded">
                                                    KALAN: ₺{Math.round(item.remaining).toLocaleString()}
                                                </div>
                                            ) : (
                                                <div className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                                                    ÖDENDİ ✅
                                                </div>
                                            )}

                                            {/* Details */}
                                            <div className="text-[9px] text-gray-500 mt-1">
                                                Brüt: ₺{Math.round(item.brut).toLocaleString()} | Kom: ₺{Math.round(item.commAmt).toLocaleString()}
                                            </div>
                                            <div className="text-[10px] text-gray-300">
                                                Net: <b>₺{Math.round(item.net).toLocaleString()}</b>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button onClick={() => onEdit(item)} className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400 hover:text-white transition-colors">
                                                <Edit className="w-3 h-3" />
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="bg-rose-500/20 p-2 rounded-lg text-rose-500 hover:text-white transition-colors">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
