"use client";

import { useMemo, useState } from "react";
import { GUIDE_CATEGORIES, GUIDE_PLACES, guideMapsUrl, type GuideCategorySlug } from "@/lib/region-guide";
import styles from "./RegionGuideGrid.module.css";

export default function RegionGuideGrid() {
  const [activeCategory, setActiveCategory] = useState<GuideCategorySlug | "all">("all");

  const availableCategories = useMemo(
    () => GUIDE_CATEGORIES.filter((category) => GUIDE_PLACES.some((place) => place.category === category.slug)),
    [],
  );

  const filteredPlaces = useMemo(
    () => (activeCategory === "all" ? GUIDE_PLACES : GUIDE_PLACES.filter((place) => place.category === activeCategory)),
    [activeCategory],
  );

  return (
    <>
      <div className={styles.filterBar} role="group" aria-label="Bölge rehberi filtresi">
        <button
          type="button"
          className={`${styles.filterChip} ${activeCategory === "all" ? styles.filterChipActive : ""}`}
          onClick={() => setActiveCategory("all")}
          aria-pressed={activeCategory === "all"}
        >
          Tümü
        </button>
        {availableCategories.map((category) => (
          <button
            key={category.slug}
            type="button"
            className={`${styles.filterChip} ${activeCategory === category.slug ? styles.filterChipActive : ""}`}
            onClick={() => setActiveCategory(category.slug)}
            aria-pressed={activeCategory === category.slug}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {filteredPlaces.map((place) => {
          const categoryLabel = GUIDE_CATEGORIES.find((c) => c.slug === place.category)?.label ?? place.category;
          return (
            <article className={styles.card} key={place.id}>
              <span className={`${styles.badge} ${styles[`badge_${place.category}`]}`}>{categoryLabel}</span>
              <h2>{place.name}</h2>
              <p>{place.description}</p>
              <a href={guideMapsUrl(place.mapsQuery)} target="_blank" rel="noopener noreferrer">Haritada Aç ↗</a>
            </article>
          );
        })}
      </div>
    </>
  );
}
