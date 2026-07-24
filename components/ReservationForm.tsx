"use client";
import { useState, useEffect } from "react";
import { VillaReservation, GoogleService, PriceService } from "@/services/api";
import { Loader2 } from "lucide-react";

// MENTÖRLÜK DOKUNUŞU: TypeScript'in kızdığı 'reservations' ve 'defaultVilla' özellikleri buraya eklendi.
interface Props {
  onSave: () => void;
  config: { commission: number };
  editingItem?: VillaReservation | null;
  onCancelEdit: () => void;
  reservations?: any; 
  defaultVilla?: string; 
}

export default function ReservationForm({ onSave, config, editingItem, onCancelEdit, defaultVilla }: Props) {
  // Filtre barında hangi apart seçiliyse formda otomatik o seçili gelir
  const [apart, setApart] = useState<'Safira' | 'Destan'>(defaultVilla === 'Destan' ? 'Destan' : 'Safira');
  const [name, setName] = useState('');
  const [cin, setCin] = useState('');
  const [cout, setCout] = useState('');
  const [price, setPrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setApart(editingItem.apart);
      setName(editingItem.name);
      setCin(editingItem.cin);
      setCout(editingItem.cout);
      setPrice(editingItem.price.toString());
    } else if (defaultVilla) {
      setApart(defaultVilla === 'Destan' ? 'Destan' : 'Safira');
    }
  }, [editingItem, defaultVilla]);

  useEffect(() => {
    if (!editingItem && cin && cout) {
       const calc = PriceService.calculateTotal(apart, cin, cout);
       if (calc.avg > 0) setPrice(calc.avg.toString());
    }
  }, [apart, cin, cout, editingItem]);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); 

    if (!name) return alert("Lütfen misafir adını girin.");
    if (!cin) return alert("Lütfen giriş tarihini seçin.");
    if (!cout) return alert("Lütfen çıkış tarihini seçin.");
    if (!price || isNaN(Number(price))) return alert("Lütfen geçerli bir fiyat (rakam) girin.");
    
    const start = new Date(cin);
    const end = new Date(cout);
    if (start >= end) return alert("Çıkış tarihi, giriş tarihinden sonra olmalıdır!");

    setIsSaving(true);

    const nights = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    const numPrice = Number(price);
    const brut = nights * numPrice;
    const commAmt = brut * (config.commission / 100);
    const net = brut - commAmt;

    const reservation: VillaReservation = {
      id: editingItem ? editingItem.id : Date.now(),
      type: 'villa',
      apart,
      name,
      cin,
      cout,
      nights,
      brut,
      net,
      price: numPrice,
      commAmt,
      paidAmt: editingItem?.paidAmt || 0,
      remaining: editingItem ? editingItem.remaining : net
    };

    try {
      const success = await GoogleService.saveData(reservation);
      
      if (success) {
        setName('');
        setCin('');
        setCout('');
        setPrice('');
        if (editingItem) onCancelEdit();
        onSave(); 
      } else {
        alert("Bağlantı başarısız oldu. Lütfen internetinizi kontrol edip tekrar deneyin.");
      }
    } catch (error) {
      console.error("Save Error:", error);
      alert("Kayıt sırasında beklenmeyen bir sistem hatası oluştu.");
    } finally {
      setIsSaving(false); 
    }
  };

  return (
    <div className="glass p-5 rounded-3xl mb-6 border border-white/5 relative overflow-hidden">
      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
        ✨ {editingItem ? 'Rezervasyonu Düzenle' : 'Yeni Rezervasyon'}
      </h3>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-gray-400 uppercase font-bold ml-1">Apart Seçimi</label>
            <select 
              value={apart} 
              onChange={(e) => setApart(e.target.value as 'Safira'|'Destan')}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none transition-all"
            >
              <option value="Safira">Safira</option>
              <option value="Destan">Destan</option>
            </select>
          </div>
          <div>
             <label className="text-[10px] text-gray-400 uppercase font-bold ml-1">Misafir Adı</label>
             <input 
               type="text" 
               value={name}
               onChange={(e) => setName(e.target.value)}
               placeholder="Misafir Adı" 
               className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none transition-all"
             />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-gray-400 uppercase font-bold ml-1">Giriş Tarihi</label>
            <input 
              type="date" 
              value={cin}
              onChange={(e) => setCin(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 uppercase font-bold ml-1">Çıkış Tarihi</label>
            <input 
              type="date" 
              value={cout}
              onChange={(e) => setCout(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-indigo-400 uppercase font-bold ml-1">Gecelik Fiyat (₺)</label>
          <input 
            type="number" 
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Örn: 3500" 
            className="w-full bg-slate-800 border border-indigo-500/30 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none transition-all"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold py-4 rounded-xl shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingItem ? 'GÜNCELLE' : 'KAYDET')}
          </button>
          {editingItem && (
            <button 
              onClick={() => {
                setName(''); setCin(''); setCout(''); setPrice(''); onCancelEdit();
              }}
              className="px-6 bg-rose-500/20 text-rose-500 font-bold rounded-xl hover:bg-rose-500/30 transition-all"
            >
              İPTAL
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
