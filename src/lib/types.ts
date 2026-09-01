export type Villa = "Safira" | "Destan";
export type Channel = "Doğrudan" | "Booking" | "Airbnb" | "Diğer";
export type VillaLocations = Record<Villa, string>;
export type SocialPlatform = "Instagram" | "Facebook" | "TikTok" | "WhatsApp Durum";
export type SocialContentType = "Gönderi" | "Hikâye" | "Reels" | "Durum";
export type SocialPostStatus = "Planlandı" | "Yayınlandı";
export type SocialPostApproval = "İnsan onayı" | "Onaylandı";

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
  // HH:MM (Europe/Istanbul), yalnız aynı gün içindeki içerikleri farklı saatlere yaymak için -
  // boşsa cron SOCIAL_AUTO_PUBLISH_TIME'a düşer (bkz. custom-worker.mjs duePosts()).
  scheduledTime?: string | null;
  caption: string;
  // Legacy sosyal kayıtlarında bu alanlar henüz bulunmayabilir.
  mediaUrl?: string;
  // Gönderi için 2-10 öğe varsa Instagram/Facebook carousel olarak işlenir.
  // İlk öğe mediaUrl ile aynı tutulur; server authoritative D1 kaydını kullanır.
  mediaUrls?: string[];
  status: SocialPostStatus;
  approvalStatus?: SocialPostApproval;
  approvedAt?: string | null;
  publishedAt: string | null;
  platformPostId?: string | null;
  publishAttemptCount?: number;
  lastPublishAttemptAt?: string | null;
  lastPublishError?: string | null;
  createdAt: string;
  updatedAt: string;
}
