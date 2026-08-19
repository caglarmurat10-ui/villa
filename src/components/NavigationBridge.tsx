"use client";

import { useEffect } from "react";

export default function NavigationBridge() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const button = target.closest("button");
      if (!button) return;

      const text = (button.textContent ?? "").trim();
      const isMainMessages = Boolean(button.closest(".main-menu")) && text.includes("Mesajlar");
      const isMessagePanel = Boolean(button.closest(".movement-head")) && text.includes("Mesaj paneli");
      const isMovementMessage = Boolean(button.closest(".movement-actions")) && (text.includes("Giriş") || text.includes("Çıkış"));

      if (isMainMessages || isMessagePanel || isMovementMessage) {
        event.preventDefault();
        event.stopPropagation();
        window.location.href = "/mesajlar";
      }
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
