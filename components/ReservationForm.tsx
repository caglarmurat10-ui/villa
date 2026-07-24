"use client";

import { useEffect, useMemo, useState } from "react";
import { GoogleService, VillaReservation, PriceService } from "@/services/api";
import { Save, Loader2, User, Phone, Building2, BadgePercent, X } from "lucide-react";

interface ReservationFormProps {
  onSave: () => void;
  editingItem: VillaReservation | null;
  onCancelEdit: () => void;
  config: { commission: number };
  reservations: VillaReservation[];
  defaultVilla: 'Safira' | 'Destan';
}

const emptyForm = (villa: 'Safira'|'Destan', commission: number) => ({
  apart: villa, name: '', phone: '', cin: '', cout: '', price: '', paidAmt: '', source: 'direct' as 'direct'|'agency', agencyName: '', commissionRate: commission.toString(), notes: ''
});

export default function ReservationForm({ onSave, editingItem, onCancelEdit, config, reservations, defaultVilla }: ReservationFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(emptyForm(defaultVilla, config.commission));
  const [pricesVersion, setPricesVersion] = useState(0);

  useEffect(() => {
    const update = () => setPricesVersion(v => v + 1);
    window.addEventListener('price-update', update);
    return () => window.removeEventListener('price-update', update);
  }, []);

  useEffect(() => {
    if (!editingItem) setFormData(prev => ({ ...prev, apart: defaultVilla }));
  }, [defaultVilla, editingItem]);

  useEffect(() => {
    if (editingItem) {
      const rate = editingItem.commissionRate ?? (editingItem.brut > 0 ? editingItem.commAmt / editingItem.brut * 100 : config.commission);
      setFormData({
        apart: editingItem.apart, name: editingItem.name, phone: editingItem.phone || '', cin: editingItem.cin, cout: editingItem.cout,
        price: String(editingItem.price), paidAmt: String(editingItem.paidAmt || ''), source: editingItem.source || (editingItem.commAmt > 0 ? 'agency' : 'direct'),
        agencyName: editingItem.agencyName || '', commissionRate: String(rate || 0), notes: editingItem.notes || ''
      });
    }
  }, [editingItem, config.commission]);

  useEffect(() => {
    if (!editingItem && formData.cin && formData.cout) {
      const { avg } = PriceService.calculateTotal(formData.apart, formData.cin, formData.cout);
      if (avg > 0) setFormData(prev => ({ ...prev, price: avg.toFixed(0) }));
    }
  }, [formData.apart, formData.cin, formData.cout, pricesVersion, editingItem]);

  const calc = useMemo(() => {
    const start = new Date(`${formData.cin}T12:00:00`);
    const end = new Date(`${formData.cout}T12:00:00`);
    const nights = !isNaN(start.getTime()) && !isNaN(end.getTime()) ? Math.round((end.getTime() - start.getTime()) / 86400000) : 0;
    const price = Number(formData.price) || 0;
    const brut = Math.max(nights, 0) * price;
    const rate = formData.source === 'agency' ? Number(formData.commissionRate) || 0 : 0;
    const commAmt = brut * rate / 100;
    const net = brut - commAmt;
    const paid = Number(formData.paidAmt) || 0;
    return { nights, brut, rate, commAmt, net, remaining: net - paid };
  }, [formData]);

  const conflict = useMemo(() => {
    if (!formData.cin || !formData.cout) return null;
    return reservations.find(r => r.id !== editingItem?.id && r.apart === formData.apart && formData.cin < r.cout && formData.cout > r.cin) || null;
  }, [formData.apart, formData.cin, formData.cout, reservations, editingItem]);

  const submit = async () => {
    if (!formData.name || !formData.cin || !formData.cout || !formData.price) return alert('Lütfen zorunlu alanları doldurun.');
    if (calc.nights <= 0) return alert('Çıkış tarihi giriş tarihinden sonra olmalıdır.');
    if (conflict) return alert(`${formData.apart} villasında bu tarihler dolu: ${conflict.name} (${conflict.cin} - ${conflict.cout})`);
    setLoading(true);
    const entry: VillaReservation = {
      id: editingItem?.id || Date.now(), type: 'villa', apart: formData.apart, name: formData.name.trim(), phone: formData.phone.trim(),
      cin: formData.cin, cout: formData.cout, nights: calc.nights, price: Number(formData.price), brut: calc.brut, commAmt: calc.commAmt,
      commissionRate: calc.rate, net: calc.net, paidAmt: Number(formData.paidAmt) || 0, remaining: calc.remaining,
      source: formData.source, agencyName: formData.source === 'agency' ? formData.agencyName.trim() : '', notes: formData.notes.trim()
    };
    const success = await GoogleService.saveData(entry);
    setLoading(false);
    if (!success) return alert('Kayıt yapılamadı. İnternet veya sunucu bağlantısını kontrol edin.');
    setFormData(emptyForm(defaultVilla, config.commission));
    onSave();
  };

  const field = "w-full bg-gray-800/70 border border-gray-700 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none";
  return <section className="glass-panel p-5 rounded-3xl lg:sticky lg:top-5">
    <div className="flex items-center justify-between mb-5">
      <div><p className="text-xs text-indigo-300 font-bold uppercase">{editingItem ? 'Kayıt düzenleme' : 'Yeni kayıt'}</p><h2 className="text-xl font-black">Rezervasyon Bilgileri</h2></div>
      {editingItem && <button onClick={onCancelEdit} className="p-2 rounded-lg bg-white/5"><X className="w-4 h-4" /></button>}
    </div>

    <div className="space-y-4">
      <div><label className="label">Villa</label><div className="grid grid-cols-2 gap-2 mt-1">{(['Safira','Destan'] as const).map(v => <button key={v} onClick={() => setFormData({...formData, apart:v})} className={`p-3 rounded-xl font-bold ${formData.apart===v ? 'bg-indigo-600' : 'bg-gray-800'}`}>{v}</button>)}</div></div>
      <div><label className="label">Misafir adı *</label><div className="relative mt-1"><User className="input-icon"/><input className={`${field} pl-10`} value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})} placeholder="Ad Soyad"/></div></div>
      <div><label className="label">Telefon</label><div className="relative mt-1"><Phone className="input-icon"/><input className={`${field} pl-10`} value={formData.phone} onChange={e=>setFormData({...formData,phone:e.target.value})} placeholder="05xx xxx xx xx"/></div></div>
      <div className="grid grid-cols-2 gap-2"><div><label className="label">Giriş *</label><input type="date" className={`${field} mt-1`} value={formData.cin} onChange={e=>setFormData({...formData,cin:e.target.value})}/></div><div><label className="label">Çıkış *</label><input type="date" className={`${field} mt-1`} value={formData.cout} onChange={e=>setFormData({...formData,cout:e.target.value})}/></div></div>
      {conflict && <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300"><b>Tarih çakışması:</b> {conflict.name}, {conflict.cin} - {conflict.cout}</div>}
      <div><label className="label">Rezervasyon kaynağı</label><div className="grid grid-cols-2 gap-2 mt-1"><button onClick={()=>setFormData({...formData,source:'direct',commissionRate:'0'})} className={`p-3 rounded-xl font-bold ${formData.source==='direct'?'bg-emerald-600':'bg-gray-800'}`}>Doğrudan</button><button onClick={()=>setFormData({...formData,source:'agency',commissionRate:formData.commissionRate==='0'?String(config.commission):formData.commissionRate})} className={`p-3 rounded-xl font-bold ${formData.source==='agency'?'bg-amber-600':'bg-gray-800'}`}>Acente</button></div></div>
      {formData.source === 'agency' && <div className="grid grid-cols-[1fr_110px] gap-2"><div><label className="label">Acente adı</label><div className="relative mt-1"><Building2 className="input-icon"/><input className={`${field} pl-10`} value={formData.agencyName} onChange={e=>setFormData({...formData,agencyName:e.target.value})}/></div></div><div><label className="label">Komisyon %</label><div className="relative mt-1"><BadgePercent className="input-icon"/><input type="number" className={`${field} pl-9`} value={formData.commissionRate} onChange={e=>setFormData({...formData,commissionRate:e.target.value})}/></div></div></div>}
      <div className="grid grid-cols-2 gap-2"><div><label className="label">Gecelik fiyat *</label><input type="number" className={`${field} mt-1`} value={formData.price} onChange={e=>setFormData({...formData,price:e.target.value})}/></div><div><label className="label">Tahsil edilen</label><input type="number" className={`${field} mt-1`} value={formData.paidAmt} onChange={e=>setFormData({...formData,paidAmt:e.target.value})}/></div></div>
      <div><label className="label">Not</label><textarea className={`${field} mt-1 min-h-20 resize-none`} value={formData.notes} onChange={e=>setFormData({...formData,notes:e.target.value})} placeholder="Özel istekler, ödeme notu..."/></div>

      <div className="rounded-2xl bg-black/25 p-4 grid grid-cols-2 gap-3 text-sm">
        <div><p className="summary-label">Gece</p><b>{calc.nights}</b></div><div><p className="summary-label">Brüt</p><b>₺{calc.brut.toLocaleString('tr-TR')}</b></div>
        <div><p className="summary-label">Komisyon</p><b className="text-amber-400">₺{calc.commAmt.toLocaleString('tr-TR')}</b></div><div><p className="summary-label">Size kalan</p><b className="text-emerald-400">₺{calc.net.toLocaleString('tr-TR')}</b></div>
        <div className="col-span-2 border-t border-white/5 pt-2"><p className="summary-label">Kalan ödeme</p><b className={calc.remaining > 0 ? 'text-rose-400' : 'text-emerald-400'}>₺{calc.remaining.toLocaleString('tr-TR')}</b></div>
      </div>
      <button onClick={submit} disabled={loading || !!conflict} className="w-full p-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 font-black flex justify-center items-center gap-2">{loading?<Loader2 className="w-5 h-5 animate-spin"/>:<Save className="w-5 h-5"/>}{editingItem?'Değişiklikleri Kaydet':'Rezervasyonu Kaydet'}</button>
    </div>
  </section>;
}
