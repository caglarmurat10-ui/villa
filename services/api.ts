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

export const GoogleService = {
  getLocalData(): VillaReservation[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('villa_reservations_cache');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  },

  async loadData(): Promise<VillaReservation[] | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`/api/proxy?t=${new Date().getTime()}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Network error: ${response.status}`);

      const data = await response.json();
      let parsedReservations: VillaReservation[] = [];

      if (data && data.reservations && Array.isArray(data.reservations)) {
        if (data.prices && Array.isArray(data.prices)) {
          const mappedPrices = data.prices.map((p: any, idx: number) => {
            const getPVal = (keys: string[]) => {
              const keysObj = Object.keys(p);
              for (const kw of keys) {
                const found = keysObj.find(k => k && k.toLowerCase().includes(kw.toLowerCase()));
                if (found && p[found] !== undefined && p[found] !== '') return p[found];
              }
              return '';
            };
            
            const rawStart = getPVal(['start', 'başlangıç', 'baslangic', 'giris', 'giriş']);
            const rawEnd = getPVal(['end', 'bitiş', 'bitis', 'cikis', 'çıkış']);
            
            const fmtDate = (d: any) => {
              if (!d) return '';
              if (typeof d === 'string' && d.includes('T')) {
                const date = new Date(d);
                if (!isNaN(date.getTime())) {
                    const trTime = new Date(date.getTime() + (3 * 60 * 60 * 1000));
                    return trTime.toISOString().split('T')[0];
                }
              }
              return typeof d === 'string' ? d.split('T')[0] : d;
            };

            return {
              id: parseInt(getPVal(['id']) || '0') || (Date.now() + idx),
              apart: getPVal(['apart', 'villa', 'birim']) || 'Safira',
              start: fmtDate(rawStart) || '',
              end: fmtDate(rawEnd) || '',
              price: parseFloat(getPVal(['price', 'fiyat', 'gecelik']) || '0')
            };
          }).filter((p: any) => p.start && p.end);

          if (mappedPrices.length > 0) {
            localStorage.setItem('villa_prices_v2', JSON.stringify(mappedPrices));
            window.dispatchEvent(new Event('price-update'));
          }
        }

        if (data.config && data.config.commission) {
          localStorage.setItem('villa_commission_rate', data.config.commission.toString());
          window.dispatchEvent(new Event('config-update'));
        }

        parsedReservations = data.reservations;
      } else if (Array.isArray(data)) {
        parsedReservations = data;
      }

      const formattedData = parsedReservations.map((item: any, index: number) => {
        const getVal = (targetKeywords: string[]) => {
          const keys = Object.keys(item);
          for (const kw of targetKeywords) {
            const foundKey = keys.find(k => k && k.toLowerCase().includes(kw.toLowerCase()));
            if (foundKey && item[foundKey] !== undefined && item[foundKey] !== '') {
              return item[foundKey];
            }
          }
          return undefined;
        };

        const rawCin = getVal(['checkin', 'cin', 'başlangıç', 'baslangic', 'giris', 'giriş']);
        const rawCout = getVal(['checkout', 'cout', 'bitiş', 'bitis', 'cikis', 'çıkış']);

        const fmtDate = (d: any) => {
          if (!d) return '';
          if (typeof d === 'string' && d.includes('T')) {
            const date = new Date(d);
            if (!isNaN(date.getTime())) {
                const trTime = new Date(date.getTime() + (3 * 60 * 60 * 1000));
                return trTime.toISOString().split('T')[0];
            }
          }
          return typeof d === 'string' ? d.split('T')[0] : d;
        };

        const cinVal = fmtDate(rawCin) || '';
        const coutVal = fmtDate(rawCout) || '';
        const priceVal = parseFloat(getVal(['price', 'fiyat', 'gecelik']) || '0');
        
        const start = new Date(cinVal);
        const end = new Date(coutVal);
        const nightsVal = !isNaN(start.getTime()) && !isNaN(end.getTime())
          ? Math.ceil((end.getTime() - start.getTime()) / 86400000)
          : 0;

        const brutVal = nightsVal * priceVal;
        const commVal = parseFloat(getVal(['commamt', 'komisyon']) || '0');

        return {
          ...item,
          id: parseInt(getVal(['id']) || '0') || (Date.now() + index),
          apart: getVal(['apart', 'villa', 'birim']) || 'Safira',
          name: getVal(['name', 'misafir', 'ad', 'musteri']) || 'Misafir',
          cin: cinVal,
          cout: coutVal,
          nights: parseInt(getVal(['nights', 'gece', 'nights']) || nightsVal.toString()),
          brut: parseFloat(getVal(['brut', 'brüt']) || brutVal.toString()),
          net: parseFloat(getVal(['net']) || (brutVal - commVal).toString()),
          price: priceVal,
          commAmt: commVal,
          paidAmt: parseFloat(getVal(['paidamt', 'odenen', 'ödenen']) || '0'),
          remaining: parseFloat(getVal(['remaining', 'kalan']) || '0')
        };
      });

      localStorage.setItem('villa_reservations_cache', JSON.stringify(formattedData));
      return formattedData;

    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Cloud Load Error:", error);
      return null;
    }
  },

  async saveData(reservation: VillaReservation) {
    try {
      let currentLocal = this.getLocalData();
      const existingIdx = currentLocal.findIndex(r => r.id === reservation.id);
      if (existingIdx >= 0) {
          currentLocal[existingIdx] = reservation;
      } else {
          currentLocal.push(reservation);
      }
      localStorage.setItem('villa_reservations_cache', JSON.stringify(currentLocal));
      window.dispatchEvent(new Event('villa-data-update'));

      const payload = {
        ...reservation,
        id: reservation.id.toString(),
        action: 'save',
        CheckIn: reservation.cin,
        CheckOut: reservation.cout,
        Name: reservation.name,
        Apart: reservation.apart,
        Price: reservation.price,
        Nights: reservation.nights,
        Brut: reservation.brut,
        Net: reservation.net
      };

      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) return false;

      setTimeout(() => this.backupToLocal(), 4000);
      return true;
    } catch (error) {
      console.error("Proxy Save Error:", error);
      return false;
    }
  },

  async deleteData(id: number) {
    try {
      let currentLocal = this.getLocalData();
      currentLocal = currentLocal.filter(r => r.id !== id);
      localStorage.setItem('villa_reservations_cache', JSON.stringify(currentLocal));
      window.dispatchEvent(new Event('villa-data-update'));

      await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'villa', action: 'delete', id: id })
      });

      setTimeout(() => this.backupToLocal(), 4000);
      return true;
    } catch (error) {
      console.error("Proxy Delete Error:", error);
      return false;
    }
  },

  async backupToLocal(): Promise<boolean> {
    try {
      let reservations = await this.loadData();
      if (reservations === null) reservations = this.getLocalData();
      
      const prices = PriceService.getPrices();
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservations, prices })
      });
      return res.ok;
    } catch (e) {
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
