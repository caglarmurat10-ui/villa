# Villa Yönetim

Villa Safira ve Villa Destan için Cloudflare üzerinde çalışan rezervasyon, operasyon ve sosyal medya yönetim uygulaması.

## Production

- Uygulama: `https://villa-yonetim.caglarmurat10.workers.dev`
- Runtime: Cloudflare Workers + OpenNext
- Veritabanı: Cloudflare D1 (`DB`)
- Meta özel token deposu: Workers KV (`META_PRIVATE`)
- Kaynak kodun güncel sürümü `main` ile `agent/cloudflare-migration` branch'lerinde eşittir.

## Temel modüller

- Rezervasyonlar
- Safira / Destan ayrı takvimleri
- Misafirler ve görevler
- WhatsApp giriş / çıkış mesajları
- Temizlik ve bakım operasyonu
- Finans, raporlar ve hesaplama
- Komisyon, konum ve dönemsel fiyat ayarları
- Instagram / Facebook bağlantı, içerik ve yayın yönetimi
- Sosyal medya marka ve medya merkezi
- JSON yedek ve CSV dışa aktarma

## Cloudflare geliştirme

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
npm run deploy
```

`npm run deploy`, OpenNext build'ini oluşturup Cloudflare Workers'a dağıtır.

## Cloudflare bindings

`wrangler.jsonc` production yapılandırmasının kaynağıdır.

- `DB`: D1 veritabanı
- `META_PRIVATE`: hassas Meta tokenları için private KV
- `APP_BASE_URL`: production URL
- `META_APP_ID`: Instagram uygulama kimliği
- `FACEBOOK_APP_ID`: Facebook uygulama kimliği
- `FACEBOOK_CONFIG_ID`: Facebook Login for Business yapılandırma kimliği

Secret değerler repoya yazılmaz:

- `META_APP_SECRET`
- `FACEBOOK_APP_SECRET`

## Meta güvenliği

- Facebook Sayfası villa adına göre tahmin edilmez; açık ve doğrulanmış seçim kullanılır.
- Facebook tokenları D1'e plaintext yazılmaz; private KV içinde şifreli saklanır.
- Instagram/Facebook authorization code, token ve app secret loglanmaz.
- Safira ve Destan hesap/medya sahipliği server-side doğrulanır.
- Sosyal medya gönderileri insan onayı olmadan gerçek hesaba yayınlanmaz.
- Ücretli reklam harcaması açık kullanıcı onayı olmadan başlatılmaz.

## D1 migrations

`migrations/` klasörü production şemasının geçmişini içerir ve silinmemelidir.

## Not

Vercel production hedefi değildir. Uygulamanın gerçek production ortamı Cloudflare Workers'tır.
