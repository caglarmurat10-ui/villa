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
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwFecxccz6SP5tyPW0Mz2BB8h2xVaIu7iaTwZM1eIr8yKcs8ZIf22eoCjfVGUADdwOn-A/exec";

export const GoogleService = {
  async loadData(): Promise<VillaReservation[] | null> {
    try {
      // Use the local proxy to avoid CORS issues
      const response = await fetch('/api/proxy');
      if (!response.ok) throw new Error('Network response was not ok');

      const data = await response.json();
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          ...item,
          id: parseInt(item.id),
          nights: parseInt(item.nights),
          brut: parseFloat(item.brut),
          net: parseFloat(item.net),
          price: parseFloat(item.price),
          commAmt: parseFloat(item.commAmt)
        }));
      }
      return []; // Return empty array only if valid JSON frame but empty list
    } catch (error) {
      console.error("Google Cloud Load Error:", error);
      return null;
    }
  },

  async saveData(reservation: VillaReservation) {
    try {
      // Google Apps Script usually requires no-cors for POST from client-side
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...reservation,
          id: reservation.id.toString()
        })
      });

      // Trigger Backup (Fire and forget, but ideally we want latest data)
      // Since Google Script is slow to update read consistency, we might just fetch what we can
      // Or simply trigger a reload and backup.
      // For now, let's fetch the latest data from Google to be sure, then backup.
      this.backupToLocal();

      return true;
    } catch (error) {
      console.error("Google Cloud Save Error:", error);
      return false;
    }
  },

  async deleteData(id: number) {
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'villa',
          action: 'delete',
          id: id
        })
      });

      this.backupToLocal();

      return true;
    } catch (error) {
      console.error("Google Cloud Delete Error:", error);
      return false;
    }
  },

  async backupToLocal(): Promise<boolean> {
    try {
      // Fetch latest data from Google to ensure consistency
      // Note: There might be a slight delay in Google Sheets updating, so we might need a small delay?
      // But let's try direct fetch first.
      const data = await this.loadData();
      if (!data) return false;

      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      console.log('Backup sync initiated.');
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
  start: string; // YYYY-MM-DD
  end: string;
  price: number;
}

export const PriceService = {
  getPrices: (): PriceRange[] => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('villa_prices_v2');
    if (stored) return JSON.parse(stored);

    // Default Seed Data if empty
    const defaults: PriceRange[] = [
      // Kış/İlkbahar 2026 (Şu anki testler için)
      { id: 99, apart: 'Safira', start: '2026-01-01', end: '2026-05-31', price: 2500 },
      { id: 98, apart: 'Destan', start: '2026-01-01', end: '2026-05-31', price: 2000 },
      // Yaz Sezonu 2026
      { id: 1, apart: 'Safira', start: '2026-06-01', end: '2026-06-30', price: 3500 },
      { id: 2, apart: 'Safira', start: '2026-07-01', end: '2026-08-31', price: 4500 },
      { id: 3, apart: 'Safira', start: '2026-09-01', end: '2026-09-30', price: 3500 },
      { id: 4, apart: 'Destan', start: '2026-06-01', end: '2026-06-30', price: 3000 },
      { id: 5, apart: 'Destan', start: '2026-07-01', end: '2026-08-31', price: 4000 },
      { id: 6, apart: 'Destan', start: '2026-09-01', end: '2026-09-30', price: 3000 },
    ];
    localStorage.setItem('villa_prices_v2', JSON.stringify(defaults));
    return defaults;
  },

  calculateTotal: (apart: 'Safira' | 'Destan', cin: string, cout: string) => {
    const prices = PriceService.getPrices();
    const start = new Date(cin);
    const end = new Date(cout);
    let total = 0;
    let nights = 0;

    // Iterate through each night
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      // Find price for this specific night
      const p = prices.find(p => p.apart === apart && dateStr >= p.start && dateStr <= p.end);
      if (p) {
        total += p.price;
      }
      nights++;
    }

    return { total, avg: nights > 0 ? total / nights : 0 };
  },

  addPrice: (range: PriceRange) => {
    const prices = PriceService.getPrices();
    prices.push(range);
    localStorage.setItem('villa_prices_v2', JSON.stringify(prices));
    window.dispatchEvent(new Event('price-update'));
    return prices;
  },

  deletePrice: (id: number) => {
    const prices = PriceService.getPrices().filter(p => p.id !== id);
    localStorage.setItem('villa_prices_v2', JSON.stringify(prices));
    window.dispatchEvent(new Event('price-update'));
    return prices;
  }
};
