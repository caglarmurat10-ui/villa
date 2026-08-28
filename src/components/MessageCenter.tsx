"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Reservation, Villa, VillaLocations } from "@/lib/types";
import {
  buildVillaCheckoutMessage,
  buildVillaLocationMessage,
  normalizeWhatsAppNumber,
  whatsappUrl,
} from "@/lib/villaLocationMessages";
import {
  canShareVillaImage,
  fetchVillaImageFile,
  shareVillaLocation,
  type VillaLocationShareResult,
} from "@/lib/villaLocationShare";
import { VILLA_PROFILES, villaProfile } from "@/lib/villaProfiles";

type MessageType = "Giriş" | "Çıkış";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function triggerImageDownload(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function MessageCenter({ reservations, locations }: { reservations: Reservation[]; locations: VillaLocations }) {
  const [phones, setPhones] = useState<Record<string, string>>(() => Object.fromEntries(reservations.map((reservation) => [reservation.id, reservation.phone ?? ""])));
  const [savedPhones, setSavedPhones] = useState<Record<string, string>>(() => Object.fromEntries(reservations.map((reservation) => [reservation.id, reservation.phone ?? ""])));
  const [saving, setSaving] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [notice, setNotice] = useState<Record<string, string>>({});
  const [imageFiles, setImageFiles] = useState<Partial<Record<Villa, File>>>({});
  const [fileShareSupport, setFileShareSupport] = useState<Partial<Record<Villa, boolean>>>({});

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void Promise.all((Object.keys(VILLA_PROFILES) as Villa[]).map(async (villa) => {
      try {
        const file = await fetchVillaImageFile(villaProfile(villa), controller.signal);
        if (!active) return;
        setImageFiles((current) => ({ ...current, [villa]: file }));
        setFileShareSupport((current) => ({ ...current, [villa]: canShareVillaImage(navigator, file) }));
      } catch {
        if (active && !controller.signal.aborted) {
          setFileShareSupport((current) => ({ ...current, [villa]: false }));
        }
      }
    }));

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  async function savePhone(reservation: Reservation) {
    const phone = (phones[reservation.id] ?? "").trim();
    if (normalizeWhatsAppNumber(phone).length < 10) {
      setNotice((current) => ({ ...current, [reservation.id]: "Geçerli WhatsApp numarası girin." }));
      return false;
    }
    setSaving(reservation.id);
    try {
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
        keepalive: true,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice((current) => ({ ...current, [reservation.id]: data.error ?? "Numara kaydedilemedi." }));
        return false;
      }
      const stored = data.reservation?.phone ?? phone;
      setPhones((current) => ({ ...current, [reservation.id]: stored }));
      setSavedPhones((current) => ({ ...current, [reservation.id]: stored }));
      setNotice((current) => ({ ...current, [reservation.id]: "Numara kaydedildi." }));
      return true;
    } catch {
      setNotice((current) => ({ ...current, [reservation.id]: "Bağlantı hatası. Tekrar deneyin." }));
      return false;
    } finally {
      setSaving(null);
    }
  }

  function shareNotice(result: VillaLocationShareResult) {
    if (result === "shared") return "Fotoğraf ve konum mesajı paylaşım menüsüne hazırlandı.";
    if (result === "cancelled") return "Paylaşım iptal edildi.";
    return "Villa fotoğrafı indirme işlemi başlatıldı ve WhatsApp mesajı açıldı. Fotoğrafı mesaja ekleyebilirsiniz.";
  }

  async function send(reservation: Reservation, type: MessageType) {
    const phone = (phones[reservation.id] ?? "").trim();
    const normalizedPhone = normalizeWhatsAppNumber(phone);
    const locationUrl = locations[reservation.villa].trim();
    if (type === "Giriş" && !locationUrl) {
      setNotice((current) => ({ ...current, [reservation.id]: `${villaProfile(reservation.villa).name} konum bağlantısı tanımlı değil.` }));
      return;
    }
    if (normalizedPhone.length < 10) {
      setNotice((current) => ({ ...current, [reservation.id]: "Önce WhatsApp numarasını girin." }));
      return;
    }

    const savePromise = phone !== savedPhones[reservation.id] ? savePhone(reservation) : Promise.resolve(true);
    if (type === "Çıkış") {
      window.open(whatsappUrl(phone, buildVillaCheckoutMessage()), "_blank", "noopener,noreferrer");
      await savePromise;
      return;
    }

    const profile = villaProfile(reservation.villa);
    const text = buildVillaLocationMessage(reservation.villa, locationUrl);
    setSharing(reservation.id);
    try {
      const result = await shareVillaLocation({
        file: imageFiles[reservation.villa],
        text,
        title: profile.name,
        whatsappUrl: whatsappUrl(phone, text),
        publicImageUrl: profile.publicImageUrl,
        imageFileBase: profile.imageFileBase,
      }, {
        navigator,
        downloadImage: triggerImageDownload,
        openWhatsApp: (url) => window.location.assign(url),
      });
      const phoneSaved = await savePromise;
      if (phoneSaved) {
        setNotice((current) => ({ ...current, [reservation.id]: shareNotice(result) }));
      }
    } finally {
      setSharing(null);
    }
  }

  return <main className="message-page">
    <div className="message-top"><Link href="/">← Ana panele dön</Link><span>Villa Yönetim</span></div>
    <section className="message-panel">
      <div className="message-hero"><div><span className="eyebrow">WHATSAPP MESAJLARI</span><h1>Fotoğraf ve konumu birlikte paylaş</h1><p>Telefon destekliyorsa gerçek villa fotoğrafı ve mesaj birlikte açılır. Diğer cihazlarda fotoğraf indirilir ve WhatsApp metni hazırlanır.</p></div></div>
      <div className="message-list">{reservations.length === 0 ? <div className="message-empty">Aktif rezervasyon yok.</div> : reservations.map((reservation) => {
        const profile = villaProfile(reservation.villa);
        const locationUrl = locations[reservation.villa].trim();
        const previewText = locationUrl
          ? buildVillaLocationMessage(reservation.villa, locationUrl)
          : `${profile.name} için konum bağlantısı Ayarlar bölümünde tanımlanmalı.`;
        return <article className="message-card" key={reservation.id}>
          <div className="message-photo">
            <Image unoptimized src={profile.publicImageUrl} width={360} height={240} sizes="(max-width: 760px) 100vw, 180px" alt={`${profile.name} gerçek dış cephe fotoğrafı`} />
            <strong>{profile.name}</strong>
          </div>
          <div className="message-info">
            <strong>{reservation.guestName}</strong>
            <span>{profile.name} · {formatDate(reservation.checkIn)} — {formatDate(reservation.checkOut)}</span>
            <label>WhatsApp numarası<input type="tel" inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" value={phones[reservation.id] ?? ""} onChange={(event) => setPhones((current) => ({ ...current, [reservation.id]: event.target.value }))} /></label>
            <div className="message-copy-preview"><b>Mesaj önizleme</b><p>{previewText}</p></div>
            {notice[reservation.id] ? <small>{notice[reservation.id]}</small> : null}
          </div>
          <div className="message-actions">
            <button className="phone-save" disabled={saving === reservation.id} onClick={() => savePhone(reservation)}>{saving === reservation.id ? "Kaydediliyor…" : "Numarayı kaydet"}</button>
            <button className="checkin" disabled={sharing === reservation.id} onClick={() => send(reservation, "Giriş")}>{sharing === reservation.id ? "Hazırlanıyor…" : "WhatsApp'ta paylaş"}</button>
            <button className="checkout" onClick={() => send(reservation, "Çıkış")}>Çıkış</button>
            {fileShareSupport[reservation.villa] === false ? <button className="image-download" onClick={() => triggerImageDownload(profile.publicImageUrl, profile.imageFileBase)}>Villa fotoğrafını indir</button> : null}
          </div>
        </article>;
      })}</div>
    </section>
  </main>;
}
