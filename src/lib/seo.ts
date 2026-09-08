// Site tek dilli (yalnız TR) — İngilizce sürüm YOK. Bu yüzden hreflang="en" gibi sahte bir alternate
// asla eklenmez (var olmayan bir sayfaya işaret eder). Bunun yerine self-referencing "tr-TR" + "x-default"
// eklenir: Google'a "bu URL'nin dil hedefi TR ve tek sürüm bu" bilgisini açıkça verir, hiçbir şey uydurmaz.
// TR ve x-default AYNI URL'ye işaret eder — bu "TR ve EN aynı Türkçe URL'ye işaret ediyor" hatasından
// farklıdır (o hata iki farklı dil kodunun aynı sayfaya yanlışlıkla işaret etmesiydi; burada tek dil var).
export const SITE_ORIGIN = "https://safiradestan.com";

export function hreflangAlternates(canonical: string): { canonical: string; languages: Record<string, string> } {
  return {
    canonical,
    languages: {
      "tr-TR": canonical,
      "x-default": canonical,
    },
  };
}
