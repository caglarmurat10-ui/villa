export interface VillaReservation {
  id: number;
  type: 'villa';
  apart: 'Safira' | 'Destan';
  name: string;
  phone?: string;
  source?: 'direct' | 'agency';
  agencyName?: string;
  commissionRate?: number;
  notes?: string;
  cin: string;
  cout: string;
  nights: number;
  brut: number;
  net: number;
  price: number;
  commAmt: number;
  paidAmt?: number;
  remaining?: number;
}

const LOCAL_RESERVATIONS_KEY = 'villa_reservations_v3';

const readLocalReservations = (): VillaReservation[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_RESERVATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalReservations = (items: VillaReservation[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_RESERVATIONS_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('villa-data-update'));
};

const normalizeReservations = (payload: any): VillaReservation[] => {
  const source = Array.isArray(payload) ? payload : payload?.reservations;
  if (!Array.isArray(source)) return [];

  return source.map((item: any) => {
    const getVal = (keys: string[]) => {
      for (const key of keys) {
        if (item[key] !== undefined) return item[key];
        const found = Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase());
        if (found) return item[found];
      }
      return undefined;
    };

    const fmtDate = (value: any) => {
      if (!value) return '';
      if (typeof value === 'string') return value.split('T')[0];
      return String(value);
    };

    const cin = fmtDate(getVal(['cin', 'Başlangıç', 'Baslangic', 'Giris']));
    const cout = fmtDate(getVal(['cout', 'Bitiş', 'Bitis', 'Cikis']));
    const start = new Date(`${cin}T12:00:00`);
    const end = new Date(`${cout}T12:00:00`);
    const calculatedNights = !isNaN(start.getTime()) && !isNaN(end.getTime())
      ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000))
      : 0;
    const price = Number(getVal(['price', 'Fiyat', 'Gecelik'])) || 0;
    const nights = Number(getVal(['nights', 'Gece'])) || calculatedNights;
    const brut = Number(getVal(['brut', 'Brüt'])) || nights * price;
    const commAmt = Number(getVal(['commAmt', 'Komisyon', 'comm'])) || 0;
    const net = Number(getVal(['net', 'Net'])) || brut - commAmt;
    const paidAmt = Number(getVal(['paidAmt', 'Odenen'])) || 0;

    return {
      ...item,
      id: Number(getVal(['id', 'ID'])) || Date.now() + Math.floor(Math.random() * 1000),
      type: 'villa',
      apart: getVal(['apart', 'Apart']) === 'Destan' ? 'Destan' : 'Safira',
      name: String(getVal(['name', 'Misafir', 'Ad']) || 'Misafir'),
      phone: String(getVal(['phone', 'Telefon']) || ''),
      source: getVal(['source']) === 'agency' ? 'agency' : 'direct',
      agencyName: String(getVal(['agencyName', 'Acente']) || ''),
      commissionRate: Number(getVal(['commissionRate', 'KomisyonOrani'])) || 0,
      notes: String(getVal(['notes', 'Not']) || ''),
      cin,
      cout,
      nights,
      price,
      brut,
      commAmt,
      net,
      paidAmt,
      remaining: Number(getVal(['remaining', 'Kalan'])) || net - paidAmt,
    } as VillaReservation;
  });
};

export const GoogleService = {
  getLocalData(): VillaReservation[] {
    return readLocalReservations();
  },

  async loadData(): Promise<VillaReservation[] | null> {
    const localData = readLocalReservations();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`/api/proxy?t=${Date.now()}`, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      clearTimeout(timeoutId);
      if (!response.ok) return localData;

      const payload = await response.json();
      if (payload?.prices && Array.isArray(payload.prices)) {
        localStorage.setItem('villa_prices_v2', JSON.stringify(payload.prices));
        window.dispatchEvent(new Event('price-update'));
      }
      if (payload?.config?.commission !== undefined) {
        localStorage.setItem('villa_commission_rate', String(payload.config.commission));
        window.dispatchEvent(new Event('config-update'));
      }

      const cloudData = normalizeReservations(payload);
      if (cloudData.length > 0) {
        writeLocalReservations(cloudData);
        return cloudData;
      }
      return localData;
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn('Bulut bağlantısı kurulamadı, cihazdaki kayıtlar kullanılıyor.', error);
      return localData;
    }
  },

  async saveData(reservation: VillaReservation): Promise<boolean> {
    const current = readLocalReservations();
    const index = current.findIndex(item => item.id === reservation.id);
    const updated = index >= 0
      ? current.map(item => item.id === reservation.id ? reservation : item)
      : [...current, reservation];

    // Önce tarayıcıya kaydet: internet veya Google servisi çalışmasa da kayıt kaybolmaz.
    writeLocalReservations(updated);

    try {
      const response = await fetch(`/api/proxy?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ ...reservation, id: String(reservation.id), action: 'save' })
      });
      if (!response.ok) console.warn('Bulut kaydı başarısız; kayıt cihazda saklandı.');
    } catch (error) {
      console.warn('Bulut bağlantısı yok; kayıt cihazda saklandı.', error);
    }
    return true;
  },

  async deleteData(id: number): Promise<boolean> {
    writeLocalReservations(readLocalReservations().filter(item => item.id !== id));
    try {
      await fetch(`/api/proxy?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ type: 'villa', action: 'delete', id })
      });
    } catch (error) {
      console.warn('Buluttan silinemedi; cihazdaki kayıt silindi.', error);
    }
    return true;
  },

  async backupToLocal(): Promise<boolean> {
    return true;
  }
};

export interface PriceRange {
  id: number;
  apart: 'Safira' | 'Destan';
  start: string;
  end: string;
  price: number;
}

export const PriceService = {
  getPrices: (): PriceRange[] => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('villa_prices_v2');
      let prices: PriceRange[] = stored ? JSON.parse(stored) : [];

      if (prices.length === 0) {
        const defaults: PriceRange[] = [
          { id: 99, apart: 'Safira', start: '2026-01-01', end: '2026-05-31', price: 2500 },
          { id: 98, apart: 'Destan', start: '2026-01-01', end: '2026-05-31', price: 2000 },
          { id: 1, apart: 'Safira', start: '2026-06-01', end: '2026-06-30', price: 3500 },
          { id: 2, apart: 'Safira', start: '2026-07-01', end: '2026-08-31', price: 4500 },
          { id: 3, apart: 'Safira', start: '2026-09-01', end: '2026-09-30', price: 3500 },
          { id: 4, apart: 'Destan', start: '2026-06-01', end: '2026-06-30', price: 3000 },
          { id: 5, apart: 'Destan', start: '2026-07-01', end: '2026-08-31', price: 4000 },
          { id: 6, apart: 'Destan', start: '2026-09-01', end: '2026-09-30', price: 3000 },
        ];
        localStorage.setItem('villa_prices_v2', JSON.stringify(defaults));
        return defaults;
      }
      return prices;
    } catch (e) {
      return [];
    }
  },

  syncWithBackup: async () => {
    try {
      const res = await fetch(`/api/backup?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.prices && Array.isArray(data.prices) && data.prices.length > 0) {
          localStorage.setItem('villa_prices_v2', JSON.stringify(data.prices));
          window.dispatchEvent(new Event('price-update'));
          return data.prices;
        }
      }
    } catch (e) {
      console.error("Price sync error:", e);
    }
    return PriceService.getPrices();
  },

  calculateTotal: (apart: 'Safira' | 'Destan', cin: string, cout: string) => {
    const prices = PriceService.getPrices();
    const start = new Date(cin);
    const end = new Date(cout);
    let total = 0;
    let nights = 0;

    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const matches = prices.filter(p => p.apart === apart && dateStr >= p.start && dateStr <= p.end);

      if (matches.length > 0) {
        const validPrice = matches.sort((a, b) => b.id - a.id)[0];
        total += validPrice.price;
      }
      nights++;
    }

    return { total, avg: nights > 0 ? total / nights : 0 };
  },

  addPrice: (range: PriceRange) => {
    const prices = PriceService.getPrices();
    const newId = Date.now();
    const newPrice = { ...range, id: newId };

    prices.push(newPrice);

    localStorage.setItem('villa_prices_v2', JSON.stringify(prices));
    window.dispatchEvent(new Event('price-update'));

    GoogleService.backupToLocal();

    return prices;
  },

  deletePrice: (id: number) => {
    const prices = PriceService.getPrices().filter(p => p.id !== id);
    localStorage.setItem('villa_prices_v2', JSON.stringify(prices));
    window.dispatchEvent(new Event('price-update'));

    GoogleService.backupToLocal();

    return prices;
  }
};
