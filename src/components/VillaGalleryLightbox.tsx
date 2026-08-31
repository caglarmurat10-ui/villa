"use client";

import { useCallback, useEffect, useState } from "react";
import type { VillaGalleryImage } from "@/lib/villa-content";
import styles from "./VillaGalleryLightbox.module.css";

export default function VillaGalleryLightbox({
  images,
  villaName,
}: {
  images: VillaGalleryImage[];
  villaName: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const showPrev = useCallback(
    () => setOpenIndex((current) => (current === null ? null : (current - 1 + images.length) % images.length)),
    [images.length],
  );
  const showNext = useCallback(
    () => setOpenIndex((current) => (current === null ? null : (current + 1) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (openIndex === null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowLeft") showPrev();
      else if (event.key === "ArrowRight") showNext();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, close, showPrev, showNext]);

  if (images.length === 0) return null;

  return (
    <>
      <div className={styles.grid}>
        {images.map((image, index) => (
          <button
            type="button"
            key={image.src}
            className={styles.thumb}
            onClick={() => setOpenIndex(index)}
            aria-label={`${villaName} fotoğrafını büyüt: ${image.alt}`}
          >
            <picture>
              <source srcSet={image.webp} type="image/webp" />
              <img src={image.src} alt={image.alt} loading="lazy" width={480} height={320} />
            </picture>
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${villaName} fotoğraf galerisi`}>
          <button type="button" className={styles.close} onClick={close} aria-label="Galeriyi kapat">✕</button>
          <button type="button" className={`${styles.nav} ${styles.navPrev}`} onClick={showPrev} aria-label="Önceki fotoğraf">‹</button>
          <picture>
            <source srcSet={images[openIndex].webp} type="image/webp" />
            <img className={styles.fullImage} src={images[openIndex].src} alt={images[openIndex].alt} />
          </picture>
          <button type="button" className={`${styles.nav} ${styles.navNext}`} onClick={showNext} aria-label="Sonraki fotoğraf">›</button>
          <div className={styles.caption}>{images[openIndex].alt} · {openIndex + 1}/{images.length}</div>
        </div>
      )}
    </>
  );
}
