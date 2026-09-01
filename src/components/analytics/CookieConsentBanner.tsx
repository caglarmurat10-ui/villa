"use client";

import { useEffect, useState } from "react";
import { applyConsentDecision, onOpenCookiePreferences, readStoredConsent } from "@/lib/analytics";
import styles from "./CookieConsentBanner.module.css";

type View = "banner" | "preferences";

export default function CookieConsentBanner() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("banner");
  const [analyticsChoice, setAnalyticsChoice] = useState(false);

  useEffect(() => {
    const stored = readStoredConsent();
    if (!stored) {
      setOpen(true);
      setView("banner");
    } else {
      setAnalyticsChoice(stored.analytics);
    }
    return onOpenCookiePreferences(() => {
      setAnalyticsChoice(readStoredConsent()?.analytics ?? false);
      setView("preferences");
      setOpen(true);
    });
  }, []);

  if (!open) return null;

  function acceptAll() {
    applyConsentDecision(true);
    setOpen(false);
  }

  function rejectOptional() {
    applyConsentDecision(false);
    setOpen(false);
  }

  function savePreferences() {
    applyConsentDecision(analyticsChoice);
    setOpen(false);
  }

  return (
    <div className={styles.wrap} role="dialog" aria-label="Çerez Tercihleri" aria-modal="false">
      <div className={styles.panel}>
        <strong className={styles.title}>Çerez Tercihleri</strong>
        {view === "banner" ? (
          <>
            <p className={styles.text}>
              Site deneyimini iyileştirmek ve ziyaretlerin nasıl kullanıldığını anlamak için isteğe bağlı
              analitik çerezleri kullanıyoruz. Gerekli çerezler sitenin çalışması için her zaman aktiftir.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={rejectOptional}>İsteğe Bağlıları Reddet</button>
              <button type="button" className={styles.primary} onClick={acceptAll}>Tümünü Kabul Et</button>
              <button type="button" className={styles.link} onClick={() => setView("preferences")}>Tercihleri Yönet</button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.rows}>
              <div className={styles.row}>
                <div><strong>Gerekli</strong><p>Sitenin çalışması için her zaman aktiftir.</p></div>
                <input type="checkbox" checked disabled aria-label="Gerekli çerezler her zaman aktif" />
              </div>
              <div className={styles.row}>
                <div><strong>Analitik</strong><p>Ziyaretlerin nasıl kullanıldığını anlamamıza yardımcı olur.</p></div>
                <input
                  type="checkbox"
                  checked={analyticsChoice}
                  onChange={(event) => setAnalyticsChoice(event.target.checked)}
                  aria-label="Analitik çerezlere izin ver"
                />
              </div>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={savePreferences}>Tercihleri Kaydet</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
