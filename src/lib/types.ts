export type Villa = "Safira" | "Destan";
export type Channel = "Doğrudan" | "Booking" | "Airbnb" | "Diğer";

export interface Reservation {
  id: string;
  villa: Villa;
  guestName: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  channel: Channel;
  nightlyRate: number;
  totalAmount: number;
  paidAmount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriceRange {
  id: string;
  villa: Villa;
  startDate: string;
  endDate: string;
  nightlyRate: number;
}
