export type Villa = "Safira" | "Destan";
export type Channel = "Doğrudan" | "Booking" | "Airbnb" | "Diğer";
export type VillaLocations = Record<Villa, string>;
export type SocialPlatform = "Instagram" | "Facebook" | "TikTok" | "WhatsApp Durum";
export type SocialContentType = "Gönderi" | "Hikâye" | "Reels" | "Durum";
export type SocialPostStatus = "Planlandı" | "Yayınlandı";

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

export interface SocialPost {
  id: string;
  villa: Villa;
  platform: SocialPlatform;
  contentType: SocialContentType;
  scheduledDate: string;
  caption: string;
  mediaUrl: string;
  status: SocialPostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
