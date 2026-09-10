# Destan Instagram — bağımsız yayın aktivasyonu (2026-09-10)

## Karar

Villa Destan Instagram yayınları Facebook Page / Instagram Business Portfolio ilişki sağlığından bağımsız çalışır.

Projedeki Instagram OAuth ve yayın akışı `Instagram API with Instagram Login` kullanır:

- OAuth: Instagram hesabı üzerinden doğrudan yetkilendirme
- API host: `graph.instagram.com`
- İzinler: `instagram_business_basic`, `instagram_business_content_publish`
- Kimlik doğrulama: Instagram User access token + kayıtlı Instagram account ID

Bu akışta Facebook Page bağlantısı organik Instagram içerik yayını için önkoşul değildir. Facebook ↔ Instagram ilişki uyuşmazlığı panelde teşhis bilgisi olarak izlenmeye devam eder; bağımsız yayın kanalını durdurmaz.

## Korunan güvenlik sınırları

- Villa Destan Instagram için 2026-09-05 ve öncesindeki legacy backlog otomatik veya manuel olarak yeniden yayınlanmaz.
- Yalnız `Planlandı + Onaylandı` kayıtları yayın motoruna girebilir.
- Medya villa bazlı doğrulanmış proxy/origin kontrolünden geçmelidir.
- Instagram account ID/token canlı doğrulaması ve content publishing quota kontrolü korunur.
- Maksimum yayın denemesi / retry backoff / publish lock ve idempotency mekanizmaları korunur.
- Facebook yayınları kendi Page tokenı ile, Instagram yayınları kendi Instagram tokenı ile ayrı çalışır.

## Production hedefi

Safira Instagram, Safira Facebook, Destan Facebook ve Destan Instagram dört bağımsız organik yayın hedefi olarak çalışır. Facebook ↔ Instagram hesap ilişkilendirmesi daha sonra Meta tarafında düzeltilebilir; bu düzeltme bağımsız yayınları bekletmez.
