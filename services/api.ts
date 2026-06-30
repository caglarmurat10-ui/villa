export interface VillaReservation {
  id: number;
  type: 'villa';
  apart: 'Safira' | 'Destan';
  name: string;
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

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwFecxccz6SP5tyPW0Mz2BB8h2xVaIu7iaTwZM1eIr8yKcs8ZIf22eoCjfVGUADdwOn-A/exec";

export const GoogleService = {
  async loadData(): Promise<VillaReservation[] | null> {
    // YENİ: 10 saniyelik zaman aşımı kontrolcüsü
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // YENİ: Vercel önbelleğini kırmak için dinamik zaman damgası (t) ve cache ayarları
      const response = await fetch(`/api/proxy?t=${Date.now()}`, {
        signal: controller.signal,
        cache: 'no-store', // Next.js'e bu isteği asla önbelleğe almamasını söyler
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);

      const data = await response.json();

      if (data && data.reservations && Array.isArray(data.reservations)) {
        if (data.prices && Array.isArray(data.prices)) {
          localStorage.setItem('villa_prices_v2', JSON.stringify(data.prices));
          window.dispatchEvent(new Event('price-update'));
        }
        if (data.config && data.config.commission) {
          localStorage.setItem('villa_commission_rate', data.config.commission);
          window.dispatchEvent(new Event('config-update'));
        }

        return data.reservations.map((item: any) => {
          const getVal = (keys: string[]) => {
            for (const k of keys) {
              if (item[k] !== undefined) return item[k];
              const lowerK = k.toLowerCase();
              const found = Object.keys(item).find(key => key.toLowerCase() === lowerK);
              if (found) return item[found];
            }
            return undefined;
          };

          const rawCin = getVal(['cin', 'Başlangıç', 'Baslangic', 'Giris']);
          const rawCout = getVal(['cout', 'Bitiş', 'Bitis', 'Cikis']);

          const fmtDate = (d: any) => {
            if (!d) return '';
            if (typeof d === 'string' && d.includes('T')) {
              const date = new Date(d);
              const trTime = new Date(date.getTime() + (3 * 60 * 60 * 1000));
              const year = trTime.getUTCFullYear();
              const month = String(trTime.getUTCMonth() + 1).padStart(2, '0');
              const day = String(trTime.getUTCDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            }
            return typeof d === 'string' ? d.split('T')[0] : d;
          };

          const idVal = parseInt(getVal(['id', 'ID']) || '0');
          const priceVal = parseFloat(getVal(['price', 'Fiyat', 'Gecelik']) || '0');
          const cinVal = fmtDate(rawCin) || '';
          const coutVal = fmtDate(rawCout) || '';

          const start = new Date(cinVal);
          const end = new Date(coutVal);
          const nightsVal = !isNaN(start.getTime()) && !isNaN(end.getTime())
            ? Math.ceil((end.getTime() - start.getTime()) / 86400000)
            : 0;

          const brutVal = nightsVal * priceVal;
          const commVal = parseFloat(getVal(['commAmt', 'Komisyon', 'comm']) || '0');

          return {
            ...item,
            id: idVal || Date.now(),
            apart: getVal(['apart', 'Apart']) || 'Safira',
            name: getVal(['name', 'Misafir', 'Ad']) || 'Misafir',
            cin: cinVal,
            cout: coutVal,
            nights: parseInt(getVal(['nights', 'Gece']) || nightsVal.toString()),
            brut: parseFloat(getVal(['brut', 'Brüt']) || brutVal.toString()),
            net: parseFloat(getVal(['net', 'Net']) || (brutVal - commVal).toString()),
            price: priceVal,
            commAmt: commVal,
            paidAmt: parseFloat(getVal(['paidAmt', 'Odenen']) || '0'),
            remaining: parseFloat(getVal(['remaining', 'Kalan']) || '0')
          };
        });
      }

      if (Array.isArray(data)) {
        return data.map((item: any) => {
          const getVal = (keys: string[]) => {
            for (const k of keys) {
              if (item[k] !== undefined) return item[k];
              const lowerK = k.toLowerCase();
              const found = Object.keys(item).find(key => key.toLowerCase() === lowerK);
              if (found) return item[found];
            }
            return undefined;
          };

          const rawCin = getVal(['cin', 'Başlangıç', 'Baslangic', 'Giris']);
          const rawCout = getVal(['cout', 'Bitiş', 'Bitis', 'Cikis']);

          const fmtDate = (d: any) => {
            if (!d) return '';
            if (typeof d === 'string' && d.includes('T')) {
              const date = new Date(d);
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            }
            return typeof d === 'string' ? d.split('T')[0] : d;
          };

          const idVal = parseInt(getVal(['id', 'ID']) || '0');
          const priceVal = parseFloat(getVal(['price', 'Fiyat', 'Gecelik']) || '0');
          const cinVal = fmtDate(rawCin) || '';
          const coutVal = fmtDate(rawCout) || '';

          const start = new Date(cinVal);
          const end = new Date(coutVal);
          const nightsVal = !isNaN(start.getTime()) && !isNaN(end.getTime())
            ? Math.ceil((end.getTime() - start.getTime()) / 86400000)
            : 0;

          const brutVal = nightsVal * priceVal;
          const commVal = parseFloat(getVal(['commAmt', 'Komisyon', 'comm']) || '0');

          return {
            ...item,
            id: idVal || Date.now(),
            apart: getVal(['apart', 'Apart']) || 'Safira',
            name: getVal(['name', 'Misafir', 'Ad']) || 'Misafir',
            cin: cinVal,
            cout: coutVal,
            nights: parseInt(getVal(['nights', 'Gece']) || nightsVal.toString()),
            brut: parseFloat(getVal(['brut', 'Brüt']) || brutVal.toString()),
            net: parseFloat(getVal(['net', 'Net']) || (brutVal - commVal).toString()),
            price: priceVal,
            commAmt: commVal,
            paidAmt: parseFloat(getVal(['paidAmt', 'Odenen']) || '0'),
            remaining: parseFloat(getVal(['remaining', 'Kalan']) || '0')
          };
        });
      }
      return [];
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Google Cloud Load Error:", error);
      return null;
    }
  },

  async saveData(reservation: VillaReservation) {
    try {
      const response = await fetch(`/api/proxy?t=${Date.now()}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          ...reservation,
          id: reservation.id.toString(),
          action: 'save'
        })
      });

      if (!response.ok) {
        console.error("Save Failed:", await response.json());
        return false;
      }

      this.backupToLocal();
      return true;
    } catch (error) {
      console.error("Google Cloud Save Error:", error);
      return false;
    }
  },

  async deleteData(id: number) {
    try {
      const response = await fetch(`/api/proxy?t=${Date.now()}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          type: 'villa',
          action: 'delete',
          id: id
        })
      });

      if (!response.ok) return false;

      this.backupToLocal();
      return true;
    } catch (error) {
      console.error("Google Cloud Delete Error:", error);
      return false;
    }
  },

  async backupToLocal(): Promise<boolean> {
    try {
      let reservations = await this.loadData();

      if (reservations === null) {
        console.warn("Cloud load failed, attempting to read existing backup to preserve reservations...");
        try {
          const existingRes = await fetch(`/api/backup?t=${Date.now()}`);
          if (existingRes.ok) {
            const existingData = await existingRes.json();
            if (existingData.reservations) {
              reservations = existingData.reservations;
            }
          }
        } catch (e) {
          console.error("Failed to read existing backup:", e);
        }
      }

      if (reservations === null) reservations = [];

      const prices = PriceService.getPrices();
      const payload = { reservations, prices };

      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return res.ok;
    } catch (e) {
      console.error('Backup Sync Error:', e);
      return false;
    }
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
