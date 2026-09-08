"use client";

import { useEffect } from "react";
import { captureAttributionFromUrl, beaconConversionEvent } from "@/lib/conversion-events-client";

// Her public sayfa yüklemesinde bir kez çalışır: URL'deki UTM parametrelerini (varsa) session içi
// ilk temas olarak sessionStorage'a yazar ve bir page_view dönüşüm event'i gönderir (bkz.
// migrations/0025_conversion_events.sql). GTM/GA4'ün otomatik page_view'ının YERİNE değil - ayrı,
// sahip olunan bir D1 kaydı.
export default function AttributionCapture() {
  useEffect(() => {
    captureAttributionFromUrl();
    beaconConversionEvent("page_view");
    // Yalnız ilk mount'ta - route değişimlerini izlemek App Router'da ayrı bir mekanizma gerektirir
    // (kapsam dışı, bu bileşenin amacı yalnız ilk giriş sayfasının kaynağını yakalamak).
  }, []);

  return null;
}
