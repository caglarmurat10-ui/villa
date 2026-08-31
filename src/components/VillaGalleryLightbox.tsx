"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const showPrev = useCallback(
    () => setOpenIndex((current) => (current === null ? null : (current - 1 + images.length) % images.length)),
    [images.length],
  );
  const showNext = useCallback(
    () => setOpenIndex((current) => (current === null ? null : (current + 1) % images.length)),
    [images.length],
  );

  function openAt(index: number, trigger: HTMLButtonElement) {
    lastTriggerRef.current = trigger;
    setOpenIndex(index);
  }

  useEffect(() => {
    if (openIndex === null) return;
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key === "ArrowLeft") showPrev();
      else if (event.key === "ArrowRight") showNext();
      else if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button");
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      lastTriggerRef.current?.focus();
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
            onClick={(event) => openAt(index, event.currentTarget)}
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
        <div ref={dialogRef} className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${villaName} fotoğraf galerisi`}>
          <button ref={closeButtonRef} type="button" className={styles.close} onClick={close} aria-label="Galeriyi kapat">✕</button>
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
