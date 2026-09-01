"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GALLERY_CATEGORIES, type GalleryCategorySlug, type VillaGalleryImage } from "@/lib/villa-content";
import styles from "./VillaGalleryLightbox.module.css";

const SWIPE_THRESHOLD = 40;

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
  const touchStartX = useRef<number | null>(null);

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

  function onTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta > 0) showPrev();
    else showNext();
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

  const current = openIndex !== null ? filteredImages[openIndex] : null;

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
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
            onClick={(event) => openAt(index, event.currentTarget)}
            aria-label={`${villaName} fotoğrafını büyüt: ${image.alt}`}
          >
            <picture>
              <source srcSet={image.webp.replace(/\.webp$/, "-thumb.webp")} type="image/webp" />
              <img
                src={image.src.replace(/\.jpg$/, "-thumb.jpg")}
                alt={image.alt}
                loading="lazy"
                width={image.width}
                height={image.height}
              />
            </picture>
          </button>
        ))}
      </div>

      {current && (
        <div
          ref={dialogRef}
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label={`${villaName} fotoğraf galerisi`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button ref={closeButtonRef} type="button" className={styles.close} onClick={close} aria-label="Galeriyi kapat">✕</button>
          <button type="button" className={`${styles.nav} ${styles.navPrev}`} onClick={showPrev} aria-label="Önceki fotoğraf">‹</button>
          <picture>
            <source srcSet={current.webp} type="image/webp" />
            <img className={styles.fullImage} src={current.src} alt={current.alt} width={current.width} height={current.height} />
          </picture>
          <button type="button" className={`${styles.nav} ${styles.navNext}`} onClick={showNext} aria-label="Sonraki fotoğraf">›</button>
          <div className={styles.caption}>
            <span>{current.alt}</span>
            <span className={styles.counter}>{openIndex! + 1} / {filteredImages.length}</span>
          </div>
        </div>
      )}
    </>
  );
}
