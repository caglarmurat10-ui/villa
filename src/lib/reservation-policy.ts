// Tek canonical kaynak: Rezervasyon ve Konaklama Koşulları.
// İşletme sahibi tarafından 2026-09-01'de birebir doğrulandı (31/30 gün iptal sınırı dahil).
// Başka hiçbir dosyada bu metni kopyalama/hard-code ETME; buradan import et.

export interface PolicySection {
  id: string;
  title: string;
  paragraphs: string[];
}

export const POLICY_SUMMARY = {
  entry: "16:00–21:00",
  checkout: "En geç 10:00",
  deposit: "%20",
  damageDeposit: "10.000 TL",
  pets: "Kabul edilmez*",
  smoking: "Kapalı alanlarda yasak",
  petsFootnote: "* Aksi açıkça belirtilmedikçe.",
};

export const POLICY_SECTIONS: PolicySection[] = [
  {
    id: "rezervasyon-on-odeme",
    title: "1. Rezervasyon ve Ön Ödeme",
    paragraphs: [
      "Rezervasyonun kesinleşmesi için toplam konaklama bedelinin %20'si ön ödeme (kapora) olarak alınır. Ödenen ön ödeme hiçbir durumda iade edilmez.",
    ],
  },
  {
    id: "iptal-iade",
    title: "2. İptal ve İade",
    paragraphs: [
      "Rezervasyon, giriş tarihine 31 gün veya daha fazla kala iptal edilirse: yalnızca %20 ön ödeme yapılmışsa bu tutar iade edilmez, başka bir ücret talep edilmez. Toplam bedel önceden ödenmişse, %20'ye karşılık gelen kısım kesilir ve kalan tutar iade edilir.",
      "Rezervasyon, giriş tarihine 30 gün veya daha az kala iptal edilirse ya da misafir tesise hiç gelmezse (no-show): toplam rezervasyon bedelinin tamamı geçerli olur. Yalnızca ön ödeme yapılmışsa kalan tutar misafirden tahsil edilir; toplam bedel önceden ödenmişse iade yapılmaz.",
    ],
  },
  {
    id: "hasar-guvence",
    title: "3. Hasar Güvence Bedeli",
    paragraphs: [
      "Villa girişinde 10.000 TL hasar güvence bedeli alınır.",
      "Villa kontrolünün misafir ayrılmadan önce yapılamadığı durumlarda, bu bedel kontrol tamamlandıktan sonra misafirin bildireceği banka hesabına iade edilir; iade işleminden doğan banka/havale masrafları iade tutarından düşülebilir.",
    ],
  },
  {
    id: "giris-cikis",
    title: "4. Giriş ve Çıkış",
    paragraphs: [
      "Giriş işlemleri, rezervasyon başlangıç günü saat 16:00–21:00 arasında yapılır.",
      "Çıkış işlemlerinin, rezervasyonun son günü en geç saat 10:00'a kadar tamamlanması gerekir. Çıkış saatinin aşılması nedeniyle sonraki rezervasyonun hazırlanmasında, temizlikte veya operasyon sürecinde doğrudan bir ek maliyet oluşması halinde, bu maliyet misafire yansıtılabilir.",
    ],
  },
  {
    id: "erken-ayrilis",
    title: "5. Erken Ayrılış",
    paragraphs: [
      "Konaklamanın planlanan tarihten önce sonlandırılmak istenmesi halinde, mümkünse en az 24 saat önceden işletmeye bilgi verilmelidir. Misafirin kendi isteğiyle erken ayrılması durumunda, kullanılmayan konaklama süresi için ücret iadesi yapılmaz.",
    ],
  },
  {
    id: "evcil-hayvan",
    title: "6. Evcil Hayvan",
    paragraphs: [
      "Villa Safira ve Villa Destan'a, aksi açıkça belirtilmedikçe evcil hayvan kabul edilmemektedir.",
    ],
  },
  {
    id: "sigara",
    title: "7. Sigara Kullanımı",
    paragraphs: [
      "Villalarımızın tüm kapalı alanlarında sigara içilmesi yasaktır.",
    ],
  },
  {
    id: "isletme-iptal",
    title: "8. İşletme Tarafından İptal",
    paragraphs: [
      "İşletmenin herhangi bir nedenle rezervasyonu tek taraflı iptal etmesi halinde, misafire mümkün olan en kısa sürede bilgi verilir. Aynı tarihlerde uygun ve eşdeğer başka bir villa mevcutsa alternatif olarak önerilebilir. Misafir alternatifi kabul etmez ve durum mücbir sebep kapsamına girmiyorsa, işletmenin aldığı rezervasyon ödemesi misafire iade edilir.",
      "İşletme; misafirin ulaşım (uçak/otobüs bileti), araç/tekne kiralama, transfer, başka konaklama ve benzeri üçüncü kişilerle yaptığı harcamalardan sorumlu değildir.",
    ],
  },
  {
    id: "iade-masraflari",
    title: "9. İade İşlem Masrafları",
    paragraphs: [
      "Rezervasyon iptali nedeniyle EFT, havale veya kredi kartı üzerinden yapılacak iadelerde; banka, ödeme kuruluşu veya ilgili üçüncü taraflarca uygulanan komisyon ve işlem ücretleri, misafire iade edilecek tutardan düşülebilir.",
    ],
  },
];
