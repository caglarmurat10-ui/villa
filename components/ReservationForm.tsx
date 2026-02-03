"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Calendar as CalIcon, User, Calculator } from "lucide-react";
import { GoogleService, PriceService, PriceRange, VillaReservation } from "@/services/api";

interface ReservationFormProps {
    onSave: () => void;
    config: { commission: number };
    editingItem?: VillaReservation | null;
    onCancelEdit?: () => void;
}

export default function ReservationForm({ onSave, config, editingItem, onCancelEdit }: ReservationFormProps) {
    const [loading, setLoading] = useState(false);
    const [prices, setPrices] = useState<PriceRange[]>([]);
    const [formData, setFormData] = useState({
        apart: 'Safira',
        name: '',
        cin: '',
        cout: '',
        price: ''
    });

    useEffect(() => {
        const loadPrices = () => setPrices(PriceService.getPrices());
        loadPrices();

        window.addEventListener('price-update', loadPrices);
        return () => window.removeEventListener('price-update', loadPrices);
    }, []);

    // Auto-Fetch Price Logic
    useEffect(() => {
        // Only auto-update if NOT editing an existing item (to avoid overwriting custom prices)
        // Or if the user explicitly changes dates while editing
        if (!editingItem || (editingItem && (formData.cin !== editingItem.cin || formData.apart !== editingItem.apart))) {
            if (formData.apart && formData.cin) {
                const found = prices.find(p => p.apart === formData.apart && formData.cin >= p.start && formData.cin <= p.end);
                if (found) {
                    setFormData(prev => ({ ...prev, price: found.price.toString() }));
                }
            }
        }
    }, [formData.cin, formData.apart, prices, editingItem]);

    useEffect(() => {
        if (editingItem) {
            setFormData({
                apart: editingItem.apart,
                name: editingItem.name,
                cin: editingItem.cin,
                cout: editingItem.cout,
                price: editingItem.price.toString()
            });
        } else {
            setFormData({ apart: 'Safira', name: '', cin: '', cout: '', price: '' });
        }
    }, [editingItem]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const calculate = () => {
        if (!formData.cin || !formData.cout || !formData.price) return null;
        const cinDate = new Date(formData.cin);
        const coutDate = new Date(formData.cout);
        const diffTime = Math.abs(coutDate.getTime() - cinDate.getTime());
        const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (nights <= 0) return null;

        const price = parseFloat(formData.price);
        const brut = nights * price;
        const net = brut * (1 - config.commission / 100);

        return { nights, brut, net };
    };

    const handleSubmit = async () => {
        const calc = calculate();
        if (!calc || !formData.name) return alert("Lütfen tüm alanları doldurun.");

        setLoading(true);
        const entry: VillaReservation = {
            id: editingItem ? editingItem.id : Date.now(),
            type: 'villa',
            apart: formData.apart as 'Safira' | 'Destan',
            name: formData.name,
            cin: formData.cin,
            cout: formData.cout,
            nights: calc.nights,
            brut: calc.brut,
            net: calc.net,
            price: parseFloat(formData.price),
            commAmt: calc.brut - calc.net
        };

        const success = await GoogleService.saveData(entry);
        setLoading(false);

        if (success) {
            alert(editingItem ? "Güncelleme Başarılı! ✅" : "Kayıt Başarılı! ✅");
            if (!editingItem) {
                setFormData({ apart: 'Safira', name: '', cin: '', cout: '', price: '' });
            }
            onSave(); // Refresh data
        } else {
            alert("Hata oluştu! ❌");
        }
    };

    const calc = calculate();

    return (
        <div className="glass-panel p-5 rounded-3xl mb-6 border border-white/5 bg-gray-900/40">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-white">
                <User className="w-4 h-4 text-emerald-400" /> Yeni Rezervasyon
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold ml-1">Apart</label>
                    <select
                        id="apart"
                        value={formData.apart}
                        onChange={handleChange}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3 text-xs outline-none focus:border-emerald-500 transition-colors"
                    >
                        <option value="Safira">Safira Apart</option>
                        <option value="Destan">Destan Apart</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold ml-1">Misafir</label>
                    <input
                        type="text"
                        id="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Ad Soyad"
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3 text-xs outline-none focus:border-emerald-500 transition-colors"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold ml-1">Giriş</label>
                    <input
                        type="date"
                        id="cin"
                        value={formData.cin}
                        onChange={handleChange}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3 text-xs outline-none focus:border-emerald-500 transition-colors"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold ml-1">Çıkış</label>
                    <input
                        type="date"
                        id="cout"
                        value={formData.cout}
                        onChange={handleChange}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl p-3 text-xs outline-none focus:border-emerald-500 transition-colors"
                    />
                </div>
            </div>

            <div className="mb-4 space-y-1">
                <label className="text-[10px] text-indigo-400 ml-1 font-bold uppercase">Gecelik Fiyat (₺)</label>
                <div className="relative">
                    <input
                        type="number"
                        id="price"
                        value={formData.price}
                        onChange={handleChange}
                        placeholder="0"
                        className="w-full bg-gray-800 border border-indigo-500/30 text-white rounded-xl p-3 text-xs outline-none focus:border-indigo-500 transition-colors pl-8"
                    />
                    <span className="absolute left-3 top-3 text-gray-500 text-xs">₺</span>
                </div>
            </div>

            {/* Live Calculation Preview */}
            {calc && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-4 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-xs"
                >
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-emerald-400 font-bold">{calc.nights} Gece x ₺{formData.price}</p>
                            <p className="text-[10px] text-gray-400">Komisyon: ₺{Math.round(calc.brut - calc.net)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-gray-400 uppercase">Net Kazanç</p>
                            <p className="text-lg font-bold text-white">₺{Math.round(calc.net).toLocaleString()}</p>
                        </div>
                    </div>
                </motion.div>
            )}

            <div className="flex gap-2">
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className={`flex-1 ${editingItem ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-indigo-600 to-purple-600'} text-white p-4 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-wide disabled:opacity-50`}
                >
                    {loading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {editingItem ? 'Güncelleniyor' : 'Kaydediliyor'}
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" /> {editingItem ? 'Güncelle' : 'Kaydet'}
                        </>
                    )}
                </button>

                {editingItem && onCancelEdit && (
                    <button
                        onClick={onCancelEdit}
                        className="bg-gray-700 text-white p-4 rounded-xl font-bold text-xs uppercase"
                    >
                        İptal
                    </button>
                )}
            </div>
        </div>
    );
}
