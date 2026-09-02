// Mevcut web admin şablonlarının (src/components/MessageCenter.tsx, BookingInquiryCenter.tsx)
// BİREBİR aynısı - burada yeniden icat edilmedi, kopyalandı. Giriş 16:00/çıkış 10:00 gerçek,
// doğrulanmış saatler.
const MAP_LINKS: Record<"Safira" | "Destan", string> = {
  Destan: "https://maps.app.goo.gl/8zCrgoegzri52ro79",
  Safira: "https://maps.app.goo.gl/fKBpCQhn5Qneuo5H6",
};

export function normalizeWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 10) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `90${digits.slice(1)}`;
  return digits;
}

interface ReservationLike { villa: "Safira" | "Destan"; }

export function whatsappTemplateFor(
  kind: "confirmation" | "location" | "checkout" | "review",
  reservation: ReservationLike,
): string {
  const villaName = `${reservation.villa} Villa`;
  switch (kind) {
    case "confirmation":
      return `Merhaba, ${villaName} için rezervasyon talebiniz bize ulaştı. Size yardımcı olmaktan memnuniyet duyarız.`;
    case "location": {
      const mapLink = MAP_LINKS[reservation.villa];
      return `Merhaba 👋\n\n${villaName} rezervasyonunuz için sizi ağırlamaktan mutluluk duyacağız.\n\n📍 ${villaName} konumu:\n${mapLink}\n\n🕓 Giriş saatimiz 16.00’dır.\n\nVillaya sorunsuz şekilde giriş yapabilmeniz için konuma yaklaşık 15 dakika kala bize haber vermenizi rica ederiz.\n\nŞimdiden iyi yolculuklar dileriz.`;
    }
    case "checkout":
      return `Merhaba 👋\n\nBizi tercih ettiğiniz için teşekkür ederiz.\n\n🧳 Çıkış saatimiz 10.00’dır.\n\nÇıkış saatinizde villada olacağız ve çıkış işlemlerini birlikte tamamlayacağız.\n\nGüzel anılarla ayrılmanızı diler, sizi yeniden ağırlamaktan memnuniyet duyarız.`;
    case "review":
      return `${villaName}'da geçirdiğiniz zaman için teşekkür ederiz! Deneyiminizi bizimle paylaşmak isterseniz çok memnun oluruz.`;
  }
}
