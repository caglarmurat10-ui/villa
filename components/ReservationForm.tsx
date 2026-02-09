"use client";

import { useState, useEffect } from "react";
import { GoogleService, VillaReservation, PriceService } from "@/services/api";
import { Save, Loader2, Calendar, User, CreditCard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ReservationFormProps {
    onSave: () => void;
    editingItem: VillaReservation | null;
    onCancelEdit: () => void;
    config: { commission: number };
}

export default function ReservationForm({ onSave, editingItem, onCancelEdit, config }: ReservationFormProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        apart: 'Safira',
        name: '',
        cin: '',
        cout: '',
        price: '',
        paidAmt: '',
        commissionRate: config.commission.toString()
    });

    const [prices, setPrices] = useState<any[]>([]);

    useEffect(() => {
        setPrices(PriceService.getPrices());

        const handlePriceUpdate = () => setPrices(PriceService.getPrices());
        const handleConfigUpdate = () => {
            // Opsiyonel: Config değişince formu güncellemek istersek
        };

        window.addEventListener('price-update', handlePriceUpdate);
        window.addEventListener('config-update', handleConfigUpdate);
        return () => {
            window.removeEventListener('price-update', handlePriceUpdate);
            window.removeEventListener('config-update', handleConfigUpdate);
        };
    }, []);

    // Auto-Fetch Price Logic
    useEffect(() => {
        if (!editingItem || (editingItem && (formData.cin !== editingItem.cin || formData.cout !== editingItem.cout || formData.apart !== editingItem.apart))) {
            if (formData.apart && formData.cin && formData.cout) {
                const { avg } = PriceService.calculateTotal(formData.apart as 'Safira' | 'Destan', formData.cin, formData.cout);
                if (avg > 0) {
                    setFormData(prev => ({ ...prev, price: avg.toFixed(2) }));
                }
            }
        }
    }, [formData.cin, formData.cout, formData.apart, prices, editingItem]);

    // Populate Form on Edit
    useEffect(() => {
        if (editingItem) {
            const impliedCommRate = editingItem.brut > 0 ? (editingItem.commAmt / editingItem.brut) * 100 : config.commission;

            setFormData({
                apart: editingItem.apart,
                name: editingItem.name,
                cin: editingItem.cin,
                cout: editingItem.cout,
                price: editingItem.price.toString(),
                paidAmt: editingItem.paidAmt ? editingItem.paidAmt.toString() : '',
                commissionRate: impliedCommRate.toFixed(1)
            });
        }
    }, [editingItem, config.commission]);

    const handleSubmit = async () => {
        if (!formData.name || !formData.cin || !formData.cout || !formData.price) {
            alert("Lütfen tüm zorunlu alanları doldurun");
            return;
        }

        setLoading(true);

        const nights = Math.ceil((new Date(formData.cout).getTime() - new Date(formData.cin).getTime()) / (1000 * 60 * 60 * 24));
        const price = parseFloat(formData.price);
        const commRate = parseFloat(formData.commissionRate) || 0;
        const paidAmt = parseFloat(formData.paidAmt) || 0;

        const brut = nights * price;
        const commAmt = brut * (commRate / 100);
        const net = brut - commAmt;
        const remaining = net - paidAmt;

        const entry: VillaReservation = {
            id: editingItem ? editingItem.id : Date.now(),
            type: 'villa',
            apart: formData.apart as 'Safira' | 'Destan',
            name: formData.name,
            cin: formData.cin,
            cout: formData.cout,
            nights: nights,
            brut: brut,
            net: net,
            price: price,
            commAmt: commAmt,
            paidAmt: paidAmt,
            remaining: remaining
        };

        const success = await GoogleService.saveData(entry);
        setLoading(false);

        if (success) {
            if (!editingItem) {
                setFormData({
                    apart: 'Safira',
                    name: '',
                    cin: '',
                    cout: '',
                    price: '',
                    paidAmt: '',
                    commissionRate: config.commission.toString()
                });
            }
            // Başarılı kayıttan sonra yerel yedeği güncelle
            // Note: saveData zaten backupToLocal çağırıyor ama burada garanti olsun
            onSave();
        } else {
            alert("Kaydetme başarısız oldu!");
        }
    };

    // Live Calculation
    const getCalculation = () => {
        const start = new Date(formData.cin);
        const end = new Date(formData.cout);
        const nights = !isNaN(start.getTime()) && !isNaN(end.getTime()) ? Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const price = parseFloat(formData.price) || 0;
        const commRate = parseFloat(formData.commissionRate) || 0;
        const paid = parseFloat(formData.paidAmt) || 0;

        const brut = nights * price;
        const commAmt = brut * (commRate / 100);
        const net = brut - commAmt;
        const remaining = net - paid;

        return { nights, brut, commAmt, net, remaining };
    };

    const calc = getCalculation();

    return (
        <div className="glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl mb-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                {editingItem ? '✏️ Rezervasyonu Düzenle' : '✨ Yeni Rezervasyon'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">Apart Seçimi</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                            {['Safira', 'Destan'].map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => setFormData({ ...formData, apart: opt })}
                                    className={`p-3 rounded-xl text-sm font-bold transition-all ${formData.apart === opt
                                        ? (opt === 'Safira' ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-emerald-600 shadow-lg shadow-emerald-500/30')
                                        : 'bg-gray-800 hover:bg-gray-700'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">Misafir Adı</label>
                        <div className="relative mt-1">
                            <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ad Soyad"
                                className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 pl-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Giriş</label>
                            <input
                                type="date"
                                value={formData.cin}
                                onChange={(e) => setFormData({ ...formData, cin: e.target.value })}
                                className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Çıkış</label>
                            <input
                                type="date"
                                value={formData.cout}
                                onChange={(e) => setFormData({ ...formData, cout: e.target.value })}
                                className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none mt-1"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Gecelik (₺)</label>
                            <input
                                type="number"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                placeholder="0.00"
                                className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none mt-1 font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Komisyon (%)</label>
                            <input
                                type="number"
                                value={formData.commissionRate}
                                onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                                placeholder="%"
                                className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-sm focus:border-amber-500 outline-none mt-1 font-mono text-amber-400"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-6">
                <label className="text-xs font-bold text-emerald-400 uppercase ml-1">Alınan Ödeme (₺)</label>
                <div className="relative mt-1">
                    <CreditCard className="absolute left-3 top-3 w-4 h-4 text-emerald-500" />
                    <input
                        type="number"
                        value={formData.paidAmt}
                        onChange={(e) => setFormData({ ...formData, paidAmt: e.target.value })}
                        placeholder="Kapora vs."
                        className="w-full bg-emerald-900/10 border border-emerald-500/30 rounded-xl p-3 pl-10 text-emerald-300 focus:border-emerald-500 outline-none font-mono"
                    />
                </div>
            </div>

            {/* Live Summary */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/20 rounded-2xl p-4 mb-6 border border-white/5"
            >
                <div className="grid grid-cols-4 gap-2 text-center divide-x divide-white/10">
                    <div>
                        <p className="text-[10px] text-gray-400 uppercase">Gece</p>
                        <p className="text-lg font-bold">{calc.nights}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 uppercase">Brüt</p>
                        <p className="text-lg font-bold">₺{calc.brut.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 uppercase">Net</p>
                        <p className="text-lg font-bold text-indigo-400">₺{Math.floor(calc.net).toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 uppercase">Kalan Bakiye</p>
                        <p className={`text-lg font-bold ${calc.remaining > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            ₺{Math.round(calc.remaining).toLocaleString()}
                        </p>
                    </div>
                </div>
            </motion.div>

            <div className="flex gap-2">
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className={`flex-1 ${editingItem ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-indigo-600 to-purple-600'} text-white p-4 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-wide disabled:opacity-50`}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {editingItem ? 'Güncelleniyor...' : 'Kaydediliyor...'}
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
                        className="bg-gray-700 text-white p-4 rounded-xl font-bold text-xs uppercase hover:bg-gray-600 transition-colors"
                    >
                        İptal
                    </button>
                )}
            </div>
        </div>
    );
}
