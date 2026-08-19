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
