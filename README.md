# Villa Yönetim

Safira ve Destan için bağımsız rezervasyon yönetim uygulaması.

## Yerel çalıştırma

1. Node.js 24 kurulu olmalı.
2. `npm install`
3. `npm run dev`
4. Tarayıcıda `http://localhost:3000`

Veritabanı ilk açılışta `data/villa.db` olarak oluşur. JSON yedeği uygulamadaki **Yedeği indir** düğmesiyle alınabilir.

## Facebook / Meta güvenlik mimarisi

- Facebook Sayfası villa adına göre otomatik eşleştirilmez. OAuth sonrasında kullanıcı, Meta hesabındaki yönetilebilir Sayfalar arasından doğru Sayfayı açıkça seçer.
- Facebook Page tokenları D1'e yazılmaz. Kalıcı token ve 10 dakikalık seçim oturumları `META_PRIVATE` Workers KV binding'inde AES-GCM ile şifreli tutulur.
- D1 yalnızca Facebook Page metadata bilgisini tutar: villa, Page ID, ad/kullanıcı adı, profil URL'si ve zaman damgaları.
- `migrations/0003_facebook_security.sql` eski `facebook_accounts` tablosunu siler; bu tabloda daha önce token saklanmış olabileceği için eski Facebook bağlantıları yeniden yetkilendirilmelidir.
- `META_PRIVATE` binding'i `wrangler.jsonc` içinde kaynak ID'si verilmeden tanımlıdır. Güncel Wrangler automatic provisioning ile Cloudflare deploy sırasında oluşturulabilir.
- Eski `agent/facebook-meta-integration-20260828` branch'i güvenlik mimarisi için kaynak olarak kullanılmamalıdır.

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
