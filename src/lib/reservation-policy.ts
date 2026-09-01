// Tek canonical kaynak: Rezervasyon ve Konaklama Koşulları.
// İşletme sahibi tarafından 2026-09-01'de FINAL olarak birebir doğrulandı
// (31 gün+/30 gün- iptal sınırı dahil — tam 30. gün "geç iptal" grubundadır).
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
  pets: "Aksi belirtilmedikçe kabul edilmez",
  smoking: "Kapalı alanlarda içilmez",
};

export const POLICY_SECTIONS: PolicySection[] = [
  {
    id: "rezervasyon-on-odeme",
    title: "1. Rezervasyon ve Ön Ödeme",
    paragraphs: [
      "Rezervasyonun kesinleşmesi için toplam konaklama bedelinin %20'si ön ödeme (kapora) olarak alınır.",
      "Misafir tarafından gerçekleştirilen iptallerde ödenmiş olan %20 ön ödeme iade edilmez.",
      "İşletme tarafından gerçekleştirilen iptaller için aşağıdaki \"İşletme Tarafından İptal\" hükümleri uygulanır.",
    ],
  },
  {
    id: "iptal-iade",
    title: "2. İptal ve İade",
    paragraphs: [
      "Giriş tarihine 31 gün veya daha fazla kala yapılan iptallerde:",
      "Yalnızca %20 ön ödeme yapılmışsa, ön ödeme iade edilmez ve misafirden kalan konaklama bedeli talep edilmez.",
      "Toplam konaklama bedeli önceden ödenmişse, toplam bedelin %20'sine karşılık gelen ön ödeme tutarı kesilir ve kalan tutar, uygulanabilecek iade işlem masrafları düşüldükten sonra misafire iade edilir.",
      "Giriş tarihine 30 gün veya daha az kala yapılan iptallerde veya misafirin rezervasyona hiç gelmemesi (no-show) halinde toplam rezervasyon bedeli geçerli olur.",
      "Bu durumda yalnızca ön ödeme yapılmışsa kalan rezervasyon bedeli misafirden tahsil edilir. Toplam bedel önceden ödenmişse konaklama bedeli için iade yapılmaz.",
      "Yürürlükteki zorunlu mevzuattan doğan tüketici hakları saklıdır.",
    ],
  },
  {
    id: "hasar-guvence",
    title: "3. Hasar Güvence Bedeli",
    paragraphs: [
      "Villa girişinde 10.000 TL hasar güvence bedeli alınır.",
      "Villa kontrolünün misafir ayrılmadan önce gerçekleştirilemediği durumlarda güvence bedeli, kontrol tamamlandıktan sonra misafirin bildireceği banka hesabına gönderilir.",
      "Kontrol sırasında misafirin kullanımından kaynaklanan doğrudan bir hasar veya eksik tespit edilmesi halinde ilgili tutar güvence bedelinden mahsup edilebilir ve durum misafire bildirilir.",
      "Banka/havale yoluyla yapılacak iadelerde doğrudan iade işleminden kaynaklanan banka masrafları iade tutarından düşülebilir.",
    ],
  },
  {
    id: "giris-cikis",
    title: "4. Giriş ve Çıkış",
    paragraphs: [
      "Giriş işlemleri rezervasyon başlangıç günü saat 16:00 ile 21:00 arasında yapılır.",
      "Çıkış işlemlerinin rezervasyonun son günü en geç saat 10:00'a kadar tamamlanması gerekir.",
      "Misafirlerin seyahat planlarını bu giriş ve çıkış saatlerine göre düzenlemeleri rica edilir.",
      "Çıkış saatinin aşılması nedeniyle sonraki rezervasyonun hazırlanması, temizlik veya operasyon sürecinde doğrudan bir ek maliyet oluşması halinde bu maliyet misafire yansıtılabilir.",
    ],
  },
  {
    id: "erken-ayrilis",
    title: "5. Erken Ayrılış",
    paragraphs: [
      "Konaklamanın planlanan tarihten önce sonlandırılmak istenmesi halinde işletmeye mümkünse en az 24 saat önceden bilgi verilmelidir.",
      "Misafirin kendi isteğiyle villadan erken ayrılması halinde, kullanılmayan konaklama süresi için ücret iadesi yapılmaz.",
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
      "Villa Safira ve Villa Destan'ın tüm kapalı alanlarında sigara içilmesi yasaktır.",
    ],
  },
  {
    id: "isletme-iptal",
    title: "8. İşletme Tarafından İptal",
    paragraphs: [
      "İşletmenin rezervasyonu gerçekleştiremeyeceğinin ortaya çıkması halinde misafire mümkün olan en kısa sürede bilgi verilir.",
      "Aynı tarihlerde uygun ve eşdeğer başka bir villa mevcutsa misafire alternatif olarak önerilebilir.",
      "Misafirin önerilen alternatifi kabul etmemesi halinde, işletmenin söz konusu rezervasyon için tahsil etmiş olduğu bedel misafire iade edilir.",
      "Uçak veya otobüs bileti, araç/tekne kiralama, transfer, başka konaklama rezervasyonları ve misafirin üçüncü kişilerle yaptığı benzeri harcamalar işletmenin kontrolü dışındadır.",
      "Yürürlükteki zorunlu mevzuattan doğan hak ve sorumluluklar saklıdır.",
    ],
  },
  {
    id: "iade-masraflari",
    title: "9. İade İşlem Masrafları",
    paragraphs: [
      "Rezervasyon iptali nedeniyle EFT, havale veya kredi kartı üzerinden yapılacak iadelerde banka, ödeme kuruluşu veya ilgili üçüncü taraflar tarafından doğrudan iade işlemine uygulanan komisyon ve işlem ücretleri, misafire iade edilecek tutardan düşülebilir.",
    ],
  },
];
