# Villa Yönetim

Villa Safira ve Villa Destan için Cloudflare Workers üzerinde çalışan rezervasyon, operasyon ve sosyal medya yönetim uygulaması.

## Üretim mimarisi

- Next.js + OpenNext for Cloudflare
- Cloudflare Workers
- Cloudflare D1 (`DB`)
- Meta özel token saklama için Workers KV (`META_PRIVATE`)
- Production branch: `agent/cloudflare-migration`
- Yönetim: `https://admin.safiradestan.com`
- Public site: `https://safiradestan.com` ve `https://www.safiradestan.com`
- Workers adresi: `https://villa-yonetim.caglarmurat10.workers.dev`
- Canlı Worker sürüm bilgisi: `/api/system/version`

## Operasyon modülleri

- Rezervasyonlar
- Safira / Destan ayrı takvimleri
- Misafirler ve görevler
- WhatsApp giriş / çıkış mesajları
- Temizlik ve bakım
- Finans ve hesaplama
- Raporlar
- Fiyat dönemleri, komisyon ve villa konum ayarları

## Instagram / Facebook

- Instagram Business OAuth ve uzun ömürlü token
- Instagram token bitiş takibi ve güvenli yenileme
- Facebook Login for Business (`FACEBOOK_CONFIG_ID`)
- Facebook gerekli izin ve Page task doğrulaması
- Facebook Page tokenları yalnız private KV içinde tutulur
- Safira / Destan hesap ve medya sahipliği sunucu tarafında doğrulanır
- Gerçek yayında insan onayı zorunludur
- Feed, Carousel, Reels ve Instagram Story medya akışları doğrulanmış villa medyasıyla çalışır
- Yayın deneme sayısı, atomik yayın kilidi, son güvenli hata ve Meta post ID D1 üzerinde takip edilir
- Cloudflare cron her 15 dakikada yayına hazır/onaylı içerikleri kontrol eder
- Ücretli reklam harcaması otomatik başlatılmaz

## Gerekli ortam değişkenleri

Normal vars:
- `APP_BASE_URL`
- `META_APP_ID`
- `FACEBOOK_APP_ID`
- `FACEBOOK_CONFIG_ID`
- `SOCIAL_AUTO_PUBLISH_ENABLED`
- `SOCIAL_AUTO_PUBLISH_TIME`
- `SOCIAL_AUTO_PUBLISH_LIMIT`

Secrets:
- `META_APP_SECRET`
- `FACEBOOK_APP_SECRET`

Bindings:
- D1: `DB`
- KV: `META_PRIVATE`
- Worker version metadata: `CF_VERSION_METADATA`

Secret değerleri repoya yazılmamalıdır.

## Canlı sürüm doğrulama

Cloudflare deploy sonrasında `/api/system/version` endpointi aktif Worker sürümünün version ID, version tag ve oluşturulma zamanını döndürür. Bu değer Cloudflare deploymentının gerçekten hangi Worker sürümünü çalıştırdığını doğrulamak için kullanılır.

## Yerel geliştirme

```bash
npm install
npm run dev
```

Cloudflare build/deploy:

```bash
npm run deploy
```
