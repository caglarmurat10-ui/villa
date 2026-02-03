"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Settings as SettingsIcon, Save } from "lucide-react";
import { PriceService, PriceRange, GoogleService } from "@/services/api";

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
    const [prices, setPrices] = useState<PriceRange[]>([]);
    const [newRange, setNewRange] = useState({
        apart: 'Safira',
        start: '',
        end: '',
        price: ''
    });

    useEffect(() => {
        if (isOpen) {
            setPrices(PriceService.getPrices());
        }
    }, [isOpen]);

    const handleAdd = () => {
        if (!newRange.start || !newRange.end || !newRange.price) return alert("Eksik bilgi!");

        const range: PriceRange = {
            id: Date.now(),
            apart: newRange.apart as 'Safira' | 'Destan',
            start: newRange.start,
            end: newRange.end,
            price: parseFloat(newRange.price)
        };

        setPrices(PriceService.addPrice(range));
        setNewRange({ ...newRange, start: '', end: '', price: '' });
    };

    const handleDelete = (id: number) => {
        setPrices(PriceService.deletePrice(id));
    };

    const handleBackup = async () => {
        const success = await GoogleService.backupToLocal();
        if (success) {
            alert("Yedekleme Başarılı! ✅\n'villa.html' dosyası güncellendi.");
        } else {
            alert("Yedekleme Hatası! ❌");
        }
    };

    return (
        isOpen ? (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-md glass-panel bg-slate-900 rounded-3xl p-6 border border-indigo-500/30 max-h-[80vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
                            <SettingsIcon className="w-5 h-5" /> Ayarlar & Fiyatlar
                        </h2>
                        <div className="flex gap-2">
                            <button
                                onClick={handleBackup}
                                className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-2 text-xs font-bold uppercase"
                                title="Verileri 'villa.html' dosyasına yedekle"
                            >
                                <Save className="w-4 h-4" /> Yedekle
                            </button>
                            <button onClick={onClose} className="text-gray-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Add New Range */}
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                            <p className="text-[10px] uppercase font-bold text-gray-400">Yeni Fiyat Ekle</p>
                            <select
                                value={newRange.apart}
                                onChange={(e) => setNewRange({ ...newRange, apart: e.target.value })}
                                className="w-full bg-gray-800 p-2 rounded-lg text-xs"
                            >
                                <option value="Safira">Safira</option>
                                <option value="Destan">Destan</option>
                            </select>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="date" value={newRange.start} onChange={(e) => setNewRange({ ...newRange, start: e.target.value })} className="bg-gray-800 p-2 rounded-lg text-xs w-full text-white" />
                                <input type="date" value={newRange.end} onChange={(e) => setNewRange({ ...newRange, end: e.target.value })} className="bg-gray-800 p-2 rounded-lg text-xs w-full text-white" />
                            </div>
                            <div className="flex gap-2">
                                <input type="number" placeholder="Fiyat ₺" value={newRange.price} onChange={(e) => setNewRange({ ...newRange, price: e.target.value })} className="bg-gray-800 p-2 rounded-lg text-xs w-full text-white" />
                                <button onClick={handleAdd} className="bg-indigo-600 px-4 rounded-lg text-white font-bold text-xs hover:bg-indigo-500">EKLE</button>
                            </div>
                        </div>

                        {/* Price List */}
                        <div className="space-y-2">
                            <p className="text-[10px] uppercase font-bold text-gray-400">Kayıtlı Fiyatlar</p>
                            {prices.length === 0 ? (
                                <div className="text-center text-gray-500 text-xs py-4">Fiyat listesi boş.</div>
                            ) : prices.map(p => (
                                <div key={p.id} className="flex justify-between items-center p-3 glass-panel rounded-xl">
                                    <div>
                                        <div className={`text-xs font-bold ${p.apart === 'Safira' ? 'text-indigo-400' : 'text-emerald-400'}`}>{p.apart}</div>
                                        <div className="text-[10px] text-gray-400">{p.start} / {p.end}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="font-bold text-white">₺{p.price}</div>
                                        <button onClick={() => handleDelete(p.id)} className="text-rose-500 hover:text-white"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        ) : null
    );
}
