"use client";

import Link from "next/link";
import { VILLAS } from "@/lib/villa-content";
import { computeVillaComparisonRows } from "@/lib/villa-comparison";
import { toVillaId, trackCompareVillasSelect } from "@/lib/analytics";
import styles from "./VillaComparison.module.css";

export default function VillaComparison() {
  const rows = computeVillaComparisonRows(Object.values(VILLAS));

  return (
    <section className={styles.section} id="karsilastir">
      <div className={styles.head}>
        <span className={styles.kicker}>KARAR VERMENİZE YARDIMCI OLALIM</span>
        <h2>Hangi villa size daha uygun?</h2>
        <p>İki villa da Patara’da, özel havuzlu ve doğrudan rezervasyona açık. Aradaki fark, kapasite ve karakterlerinde.</p>
      </div>

      <div className={styles.grid}>
        {rows.map((row) => (
          <article className={styles.card} key={row.slug}>
            <span className={styles.badge}>{row.label}</span>
            <h3>{row.name}</h3>
            <p className={styles.atmosphere}>{row.atmosphere}</p>
            <dl className={styles.specs}>
              {row.specs.map((spec) => (
                <div key={spec.label}>
                  <dt>{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
            <Link
              className={styles.cta}
              href={`/${row.slug}#rezervasyon`}
              onClick={() => trackCompareVillasSelect({ villa_id: toVillaId(row.villa), villa_name: row.name }, "homepage_comparison")}
            >
              Tarih &amp; fiyat kontrol et →
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
