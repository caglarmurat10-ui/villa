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

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwtXRJCAZB5UOxX9SIDxS9pwR9QXAcdJdT1xXhsDPMw2KlAKpvNfyYrKrh3o9IiEaXong/exec";

export const GoogleService = {
  async loadData(): Promise<VillaReservation[]> {
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?type=villa`);
      if (!response.ok) throw new Error('Network response was not ok');

      const text = await response.text();
      // Handle empty or error responses gracefully
      if (!text || text.includes("Error")) {
        return [];
      }

      const data = JSON.parse(text);
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
      return [];
    } catch (error) {
      console.error("Google Cloud Load Error:", error);
      return [];
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
      return true;
    } catch (error) {
      console.error("Google Cloud Delete Error:", error);
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
    localStorage.setItem('villa_prices', JSON.stringify(defaults));
    return defaults;
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
