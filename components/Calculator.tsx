"use client";

import { useState, useEffect } from "react";
import { X, Calculator as CalcIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PriceService, PriceRange } from "@/services/api";

interface CalculatorProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Calculator({ isOpen, onClose }: CalculatorProps) {
    const [inputs, setInputs] = useState({
        apart: 'Safira',
        cin: '',
        cout: '',
        price: '',
        discount: ''
    });

    const [prices, setPrices] = useState<PriceRange[]>([]);

    useEffect(() => {
        const loadPrices = () => setPrices(PriceService.getPrices());

        if (isOpen) {
            loadPrices();
            window.addEventListener('price-update', loadPrices);
        }

        return () => window.removeEventListener('price-update', loadPrices);
    }, [isOpen]);

    // Auto-Calculate Price on Date/Apart Change
    useEffect(() => {
        if (inputs.apart && inputs.cin) {
            const found = prices.find(p => p.apart === inputs.apart && inputs.cin >= p.start && inputs.cin <= p.end);
            if (found) {
                setInputs(prev => ({ ...prev, price: found.price.toString() }));
            }
        }
    }, [inputs.cin, inputs.apart, prices]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setInputs({ ...inputs, [e.target.id]: e.target.value });
    };

    const calculate = () => {
        if (!inputs.cin || !inputs.cout) return null;
        const cinDate = new Date(inputs.cin);
        const coutDate = new Date(inputs.cout);
        const diffTime = Math.abs(coutDate.getTime() - cinDate.getTime());
        const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (nights <= 0) return null;

        const price = parseFloat(inputs.price) || 0;
        const discount = parseFloat(inputs.discount) || 0;

        const rawTotal = nights * price;
        const discountedTotal = rawTotal - (rawTotal * (discount / 100));

        return { nights, rawTotal, discountedTotal, discountAmount: rawTotal - discountedTotal, discount };
    };

    const result = calculate();

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="w-full max-w-md glass-panel bg-slate-900 rounded-3xl p-6 border border-amber-500/30"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                                <CalcIcon className="w-5 h-5" /> Hızlı Hesapla
                            </h2>
                            <button onClick={onClose} className="text-gray-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[9px] text-gray-400 uppercase ml-1 font-bold">Apart Seçimi</label>
                                <select
                                    id="apart"
                                    value={inputs.apart}
                                    onChange={handleChange}
                                    className="w-full bg-gray-800 text-white rounded-xl p-3 text-xs border border-gray-700 outline-none"
                                >
                                    <option value="Safira">Safira Apart</option>
                                    <option value="Destan">Destan Apart</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[9px] text-gray-400 uppercase ml-1 font-bold">Giriş</label>
                                    <input type="date" id="cin" value={inputs.cin} onChange={handleChange} className="w-full bg-gray-800 text-white rounded-xl p-3 text-xs border border-gray-700 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-400 uppercase ml-1 font-bold">Çıkış</label>
                                    <input type="date" id="cout" value={inputs.cout} onChange={handleChange} className="w-full bg-gray-800 text-white rounded-xl p-3 text-xs border border-gray-700 outline-none" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[9px] text-gray-400 uppercase ml-1 font-bold">Gecelik Fiyat (₺)</label>
                                <input type="number" id="price" value={inputs.price} onChange={handleChange} placeholder="0" className="w-full bg-gray-800 text-white rounded-xl p-3 text-xs border border-gray-700 outline-none" />
                            </div>

                            <div>
                                <label className="text-[9px] text-amber-400 font-bold uppercase ml-1">İndirim Oranı (%)</label>
                                <input type="number" id="discount" value={inputs.discount} onChange={handleChange} placeholder="0" className="w-full bg-amber-500/10 text-white rounded-xl p-3 text-xs border border-amber-500/30 outline-none focus:border-amber-500" />
                            </div>

                            <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 p-5 rounded-2xl border border-indigo-500/20 mt-4">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] text-indigo-300 font-medium">
                                            {result ? `${result.nights} Gece x ₺${inputs.price} ` : 'Lütfen tarih seçin'}
                                        </p>
                                        <div className="text-3xl font-bold text-white mt-1">
                                            {result ? `₺${result.discountedTotal.toLocaleString()} ` : '₺0'}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {result && result.discount > 0 && (
                                            <p className="text-[10px] text-emerald-400 font-bold">-%{inputs.discount} İndirim</p>
                                        )}
                                        {result && result.discountAmount > 0 && (
                                            <p className="text-[10px] text-gray-400 font-bold">Kazanç: ₺{result.discountAmount.toLocaleString()}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
