"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GALLERY_CATEGORIES, type GalleryCategorySlug, type VillaGalleryImage } from "@/lib/villa-content";
import styles from "./VillaGalleryLightbox.module.css";

export default function VillaGalleryLightbox({
  images,
  villaName,
}: {
  images: VillaGalleryImage[];
  villaName: string;
}) {
  const [activeCategory, setActiveCategory] = useState<GalleryCategorySlug | "all">("all");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const availableCategories = useMemo(
    () => GALLERY_CATEGORIES.filter((category) => images.some((image) => image.categories.includes(category.slug))),
    [images],
  );

  const filteredImages = useMemo(
    () => (activeCategory === "all" ? images : images.filter((image) => image.categories.includes(activeCategory))),
    [images, activeCategory],
  );

  const close = useCallback(() => setOpenIndex(null), []);
  const showPrev = useCallback(
    () => setOpenIndex((current) => (current === null ? null : (current - 1 + filteredImages.length) % filteredImages.length)),
    [filteredImages.length],
  );
  const showNext = useCallback(
    () => setOpenIndex((current) => (current === null ? null : (current + 1) % filteredImages.length)),
    [filteredImages.length],
  );

  function openAt(index: number, trigger: HTMLButtonElement) {
    lastTriggerRef.current = trigger;
    setOpenIndex(index);
  }

  function selectCategory(category: GalleryCategorySlug | "all") {
    setActiveCategory(category);
    setOpenIndex(null);
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
      {availableCategories.length > 1 && (
        <div className={styles.filterBar} role="group" aria-label={`${villaName} galeri filtresi`}>
          <button
            type="button"
            className={`${styles.filterChip} ${activeCategory === "all" ? styles.filterChipActive : ""}`}
            onClick={() => selectCategory("all")}
            aria-pressed={activeCategory === "all"}
          >
            Tümü
          </button>
          {availableCategories.map((category) => (
            <button
              key={category.slug}
              type="button"
              className={`${styles.filterChip} ${activeCategory === category.slug ? styles.filterChipActive : ""}`}
              onClick={() => selectCategory(category.slug)}
              aria-pressed={activeCategory === category.slug}
            >
              {category.label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.grid}>
        {filteredImages.map((image, index) => (
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

      {openIndex !== null && filteredImages[openIndex] && (
        <div ref={dialogRef} className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${villaName} fotoğraf galerisi`}>
          <button ref={closeButtonRef} type="button" className={styles.close} onClick={close} aria-label="Galeriyi kapat">✕</button>
          <button type="button" className={`${styles.nav} ${styles.navPrev}`} onClick={showPrev} aria-label="Önceki fotoğraf">‹</button>
          <picture>
            <source srcSet={filteredImages[openIndex].webp} type="image/webp" />
            <img className={styles.fullImage} src={filteredImages[openIndex].src} alt={filteredImages[openIndex].alt} />
          </picture>
          <button type="button" className={`${styles.nav} ${styles.navNext}`} onClick={showNext} aria-label="Sonraki fotoğraf">›</button>
          <div className={styles.caption}>{filteredImages[openIndex].alt} · {openIndex + 1}/{filteredImages.length}</div>
        </div>
      )}
    </>
  );
}
