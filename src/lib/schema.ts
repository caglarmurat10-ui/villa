import { z } from "zod";

export const reservationSchema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  guestName: z.string().trim().min(2, "Misafir adı gerekli").max(100),
  phone: z.string().trim().max(30).default(""),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  channel: z.enum(["Doğrudan", "Booking", "Airbnb", "Diğer"]),
  nightlyRate: z.coerce.number().nonnegative().default(0),
  paidAmount: z.coerce.number().nonnegative().default(0),
  notes: z.string().trim().max(1000).default(""),
}).refine((value) => value.checkOut > value.checkIn, {
  message: "Çıkış tarihi giriş tarihinden sonra olmalı",
  path: ["checkOut"],
});

export type ReservationInput = z.infer<typeof reservationSchema>;

export const priceRangeSchema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  nightlyRate: z.coerce.number().positive("Fiyat sıfırdan büyük olmalı"),
}).refine((value) => value.endDate >= value.startDate, { message: "Bitiş tarihi başlangıçtan önce olamaz", path: ["endDate"] });

const mediaUrlSchema = z.string().url("Geçerli bir medya bağlantısı girin");

export const socialPostSchema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  platform: z.enum(["Instagram", "Facebook", "TikTok", "WhatsApp Durum"]),
  contentType: z.enum(["Gönderi", "Hikâye", "Reels", "Durum"]),
  scheduledDate: z.iso.date(),
  caption: z.string().trim().min(1, "Paylaşım metni gerekli").max(2200, "Paylaşım metni en fazla 2200 karakter olabilir"),
  mediaUrl: z.union([z.literal(""), mediaUrlSchema]).default(""),
  mediaUrls: z.array(mediaUrlSchema).max(10, "Bir paylaşımda en fazla 10 medya kullanılabilir").default([]),
}).superRefine((value, context) => {
  const allowed = value.platform === "WhatsApp Durum"
    ? ["Durum"]
    : value.platform === "TikTok"
      ? ["Gönderi", "Reels"]
      : ["Gönderi", "Hikâye", "Reels"];
  if (!allowed.includes(value.contentType)) {
    context.addIssue({ code: "custom", path: ["contentType"], message: "Seçilen platform için paylaşım türü geçerli değil." });
  }

  const media = [...new Set([...(value.mediaUrls ?? []), ...(value.mediaUrl ? [value.mediaUrl] : [])])];
  if ((value.contentType === "Hikâye" || value.contentType === "Reels") && media.length > 1) {
    context.addIssue({ code: "custom", path: ["mediaUrls"], message: `${value.contentType} için tek medya seçilmelidir.` });
  }
  if (media.length > 1 && value.contentType !== "Gönderi") {
    context.addIssue({ code: "custom", path: ["mediaUrls"], message: "Çoklu medya yalnız Gönderi/Carousel için kullanılabilir." });
  }
});

export const socialPostMediaSchema = z.object({
  mediaUrls: z.array(mediaUrlSchema).min(1, "En az bir medya seçin").max(10, "En fazla 10 medya seçebilirsiniz"),
});

export const socialPostStatusSchema = z.object({ status: z.enum(["Planlandı", "Yayınlandı"]) });
export const socialPostApprovalSchema = z.object({ approvalStatus: z.enum(["İnsan onayı", "Onaylandı"]) });
export type SocialPostInput = z.infer<typeof socialPostSchema>;
