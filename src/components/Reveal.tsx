"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Reveal.module.css";

function shouldSkipAnimation(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof IntersectionObserver === "undefined") return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// Hafif scroll-reveal: section viewport'a girince fade + 16px translateY. JS kütüphanesi YOK,
// yalnız IntersectionObserver. prefers-reduced-motion aktifse (veya IntersectionObserver
// desteklenmiyorsa) hiç gizlenmeden doğrudan görünür render edilir - bu karar render sırasında
// (useState lazy initializer) verilir, effect içinde senkron setState çağrılmaz. Yalnız
// below-the-fold, LCP'siz bölümlerde kullanılmalı (bkz. site/page.tsx kullanım yerleri).
export default function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(shouldSkipAnimation);

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={[styles.reveal, visible ? styles.visible : "", className ?? ""].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
