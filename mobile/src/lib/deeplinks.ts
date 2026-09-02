import { Browser } from "@capacitor/browser";

// Native uygulama şemaları önce denenir; WebView bunları açamazsa (uygulama kurulu değilse)
// tarayıcı fallback'i devreye girer. Hiçbir PII (telefon numarası, mesaj içeriği) burada
// analytics'e gönderilmez - bu yalnız navigasyon.
async function openExternal(url: string) {
  await Browser.open({ url });
}

export async function openWhatsApp(whatsappUrl: string) {
  await openExternal(whatsappUrl);
}

export async function openPhone(phoneIntl: string) {
  window.location.href = `tel:+${phoneIntl}`;
}

export async function openMaps(mapsUrl: string) {
  await openExternal(mapsUrl);
}

export async function openInstagram(url: string, username?: string) {
  if (username) {
    try {
      window.location.href = `instagram://user?username=${encodeURIComponent(username)}`;
      return;
    } catch {
      // yoksay, web fallback'e düş
    }
  }
  await openExternal(url);
}

export async function openFacebook(url: string) {
  await openExternal(url);
}

export async function openOtaListing(url: string) {
  await openExternal(url);
}
