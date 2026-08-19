# Villa Yönetim

Safira ve Destan için bağımsız rezervasyon yönetim uygulaması.

## Yerel çalıştırma

1. Node.js 24 kurulu olmalı.
2. `npm install`
3. `npm run dev`
4. Tarayıcıda `http://localhost:3000`

Veritabanı ilk açılışta `data/villa.db` olarak oluşur. JSON yedeği uygulamadaki **Yedeği indir** düğmesiyle alınabilir.

## İlk sürüm özellikleri

- İki villa için merkezî rezervasyon kaydı
- Tarih çakışmasını sunucu tarafında engelleme
- Gelir, tahsilat ve kalan bakiye özeti
- Booking, Airbnb, doğrudan ve diğer kanal ayrımı
- Silinen kayıtları veritabanında koruyan soft-delete
- İşlem denetim kaydı
- JSON yedek dışa aktarma
- Docker/self-hosting için Next.js standalone çıktı

Henüz kullanıcı girişi, düzenleme, ödeme hareketleri, otomatik yedek planı ve eski sistemden veri aktarımı eklenmedi. Bunlar ikinci aşamadır.
