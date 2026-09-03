const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Google Vacation Rentals/GBP booking link gibi dış kaynaklardan gelen ?checkin=&checkout=&guests=
// query param'larını doğrular - saf fonksiyon. Geçersiz/eksik/mantıksız (checkout <= checkin,
// aralık dışı misafir sayısı) değerler sessizce reddedilir, PublicBookingWidget'ın formuna hiç
// yansımaz - dış kaynaktan gelen veri asla doğrudan güvenilmez.
export function validateBookingPrefill(params: { checkIn?: string; checkOut?: string; guestCount?: string }) {
  const checkIn = params.checkIn && ISO_DATE.test(params.checkIn) ? params.checkIn : "";
  const checkOut = params.checkOut && ISO_DATE.test(params.checkOut) && (!checkIn || params.checkOut > checkIn) ? params.checkOut : "";
  const guestCountNumber = Number(params.guestCount);
  const guestCount = Number.isInteger(guestCountNumber) && guestCountNumber >= 1 && guestCountNumber <= 12 ? String(guestCountNumber) : "2";
  return { checkIn, checkOut, guestCount };
}
