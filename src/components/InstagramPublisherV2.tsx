"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./InstagramPublisherV2.module.css";
import InstagramScheduledPostsPanel from "./InstagramScheduledPostsPanel";

type Villa = "Destan" | "Safira";
type PublishType = "IMAGE" | "CAROUSEL" | "REELS";
type PublishMode = "now" | "scheduled";
type SelectedMedia = { id: string; file: File; previewUrl: string };

type HistoryItem = {
  id: string;
  villa: string;
  username?: string | null;
  imageUrl: string;
  caption: string;
  publishType?: PublishType;
  itemCount?: number;
  instagramMediaId?: string | null;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
  source?: "manual" | "scheduled";
};

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const REELS_MAX_BYTES = 24 * 1024 * 1024;
const publishTypes: Array<{
  value: PublishType;
  label: string;
  description: string;
}> = [
  { value: "IMAGE", label: "Tek Fotoğraf", description: "Bir JPG/JPEG fotoğraf" },
  { value: "CAROUSEL", label: "Carousel", description: "2-10 sıralı fotoğraf" },
  { value: "REELS", label: "Reels", description: "Bir MP4 video" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function responseData(response: Response) {
  const value: unknown = await response.json().catch(() => ({}));
  return isRecord(value) ? value : {};
}
function dataString(data: Record<string, unknown>, key: string) {
  return typeof data[key] === "string" ? data[key] : "";
}
function typeLabel(type: PublishType | undefined) {
  return type === "CAROUSEL" ? "Carousel" : type === "REELS" ? "Reels" : "Fotoğraf";
}
function formattedDate(value: string) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function defaultScheduleParts() {
  const future = new Date(Date.now() + 10 * 60 * 1000);
  const parts = new Map(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(future)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`,
    time: `${parts.get("hour")}:${parts.get("minute")}`,
  };
}

export default function InstagramPublisher() {
  const [villa, setVilla] = useState<Villa>("Destan");
  const [publishType, setPublishType] = useState<PublishType>("IMAGE");
  const [publishMode, setPublishMode] = useState<PublishMode>("now");
  const [media, setMedia] = useState<SelectedMedia[]>([]);
  const [caption, setCaption] = useState("");
  const [shareToFeed, setShareToFeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [scheduledDate, setScheduledDate] = useState(
    () => defaultScheduleParts().date,
  );
  const [scheduledTime, setScheduledTime] = useState(
    () => defaultScheduleParts().time,
  );
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);
  const previewUrls = useRef(new Set<string>());

  const canPublish = useMemo(() => {
    const ready =
      (publishType === "IMAGE" && media.length === 1) ||
      (publishType === "CAROUSEL" && media.length >= 2 && media.length <= 10) ||
      (publishType === "REELS" && media.length === 1);
    const captionReady = publishMode === "scheduled" || Boolean(caption.trim());
    const timeReady =
      publishMode === "now" || Boolean(scheduledDate && scheduledTime);
    return ready && captionReady && timeReady && !busy;
  }, [
    busy,
    caption,
    media.length,
    publishMode,
    publishType,
    scheduledDate,
    scheduledTime,
  ]);

  useEffect(() => {
    void refreshHistory();
  }, []);
  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  async function refreshHistory() {
    try {
      const response = await fetch("/api/meta/instagram/publish", {
        cache: "no-store",
      });
      const data = await responseData(response);
      if (response.ok) {
        setHistory(Array.isArray(data.items) ? (data.items as HistoryItem[]) : []);
      }
    } catch {
      // Geçmiş yüklenemese bile yayın ekranı kullanılabilir.
    }
  }

  function releaseMedia(items: SelectedMedia[]) {
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
      previewUrls.current.delete(item.previewUrl);
    }
  }
  function clearMedia() {
    releaseMedia(media);
    setMedia([]);
  }
  function selectType(nextType: PublishType) {
    if (nextType === publishType || busy) return;
    clearMedia();
    setPublishType(nextType);
    setError("");
    setNotice("");
  }
  function addFiles(files: File[]) {
    if (!files.length || busy) return;
    const video = publishType === "REELS";
    if (files.some((file) => video ? file.type !== "video/mp4" : file.type !== "image/jpeg")) {
      setError(video ? "Reels için yalnızca MP4 video seçin." : "Yalnızca JPG/JPEG fotoğraf seçin.");
      return;
    }
    const maxBytes = video ? REELS_MAX_BYTES : IMAGE_MAX_BYTES;
    if (files.some((file) => file.size <= 0 || file.size > maxBytes)) {
      setError(video ? "Reels dosyası 24 MiB veya daha küçük olmalı." : "Her JPEG 8 MiB veya daha küçük olmalı.");
      return;
    }
    if (publishType === "CAROUSEL" && media.length + files.length > 10) {
      setError("Carousel en fazla 10 fotoğraf içerebilir.");
      return;
    }
    const incoming = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      return { id: crypto.randomUUID(), file, previewUrl };
    });
    if (publishType === "CAROUSEL") {
      setMedia((items) => [...items, ...incoming]);
    } else {
      releaseMedia(media);
      setMedia([incoming[0]]);
      releaseMedia(incoming.slice(1));
    }
    setError("");
    setNotice("");
  }
  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }
  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  }
  function removeMedia(id: string) {
    const removed = media.find((item) => item.id === id);
    if (removed) releaseMedia([removed]);
    setMedia((items) => items.filter((item) => item.id !== id));
  }
  function moveMedia(index: number, direction: -1 | 1) {
    setMedia((items) => {
      const target = index + direction;
      if (target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function upload(item: SelectedMedia, index: number) {
    const body = new FormData();
    body.set("villa", villa);
    body.set("file", item.file);
    if (publishMode === "scheduled") {
      body.set("scheduledAt", `${scheduledDate}T${scheduledTime}`);
      body.set("timezone", "Europe/Istanbul");
    }
    const response = await fetch("/api/meta/instagram/media", {
      method: "POST",
      body,
    });
    const data = await responseData(response);
    const publicUrl = dataString(data, "publicUrl");
    if (!response.ok || !publicUrl) {
      throw new Error(
        dataString(data, "error") ||
          (publishType === "CAROUSEL"
            ? `Carousel ${index + 1}. öğesi yüklenemedi.`
            : "Medya yüklenemedi."),
      );
    }
    return publicUrl;
  }

  async function publish() {
    if (!canPublish) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const mediaUrls: string[] = [];
      for (let index = 0; index < media.length; index += 1) {
        mediaUrls.push(await upload(media[index], index));
      }
      const response = await fetch(
        publishMode === "scheduled"
          ? "/api/meta/instagram/schedule"
          : "/api/meta/instagram/publish",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          villa,
          type: publishType,
          mediaUrls,
          caption: caption.trim(),
          ...(publishType === "REELS" ? { shareToFeed } : {}),
          ...(publishMode === "scheduled"
            ? {
                scheduledAt: `${scheduledDate}T${scheduledTime}`,
                timezone: "Europe/Istanbul",
              }
            : {}),
        }),
        },
      );
      const data = await responseData(response);
      if (!response.ok) {
        throw new Error(dataString(data, "error") || "Instagram gönderisi yayınlanamadı.");
      }
      if (publishMode === "scheduled") {
        const item = isRecord(data.item) ? data.item : {};
        const scheduledAt = dataString(item, "scheduledAt");
        setNotice(
          `Villa ${villa} gönderisi ${formattedDate(scheduledAt)} için planlandı.`,
        );
        setScheduleRefreshKey((value) => value + 1);
      } else {
        const username = dataString(data, "username");
        setNotice(
          username
            ? `@${username} hesabında ${typeLabel(publishType)} yayınlandı.`
            : dataString(data, "message") || "Instagram gönderisi yayınlandı.",
        );
      }
      setCaption("");
      clearMedia();
      if (publishMode === "now") await refreshHistory();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Instagram yayını tamamlanamadı.");
      if (publishMode === "now") await refreshHistory();
    } finally {
      setBusy(false);
    }
  }

  const currentType = publishTypes.find((item) => item.value === publishType);

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>INSTAGRAM YAYIN MERKEZİ</span>
          <h1>İçeriğini hazırla ve güvenle yayınla</h1>
          <p>
            Medya Cloudflare Workers KV üzerinden güvenli şekilde hazırlanır ve
            bağlı profesyonel Instagram hesabına Meta API ile yayınlanır.
          </p>
        </div>
        <a className={styles.back} href="/sosyal">← Sosyal merkeze dön</a>
      </section>

      <nav className={styles.modeTabs} aria-label="Yayın zamanı">
        <button
          type="button"
          className={publishMode === "now" ? styles.activeMode : ""}
          onClick={() => setPublishMode("now")}
          disabled={busy}
        >
          Şimdi Yayınla
        </button>
        <button
          type="button"
          className={publishMode === "scheduled" ? styles.activeMode : ""}
          onClick={() => setPublishMode("scheduled")}
          disabled={busy}
        >
          Planla
        </button>
      </nav>

      <nav className={styles.typeTabs} aria-label="Yayın türü">
        {publishTypes.map((item) => (
          <button
            type="button"
            key={item.value}
            className={publishType === item.value ? styles.activeType : ""}
            onClick={() => selectType(item.value)}
            disabled={busy}
          >
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </nav>

      {notice ? <div className={styles.success} role="status">{notice}</div> : null}
      {error ? <div className={styles.error} role="alert">{error}</div> : null}

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <span className={styles.step}>1</span>
              <div><h2>{currentType?.label} hazırla</h2><p>{currentType?.description}</p></div>
            </div>
            <strong>{caption.length}/2200</strong>
          </div>

          <label className={styles.label}>
            Villa
            <select value={villa} onChange={(event) => setVilla(event.target.value as Villa)} disabled={busy}>
              <option value="Destan">Villa Destan</option>
              <option value="Safira">Villa Safira</option>
            </select>
          </label>

          <label className={styles.uploadBox} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            <input
              type="file"
              accept={publishType === "REELS" ? "video/mp4,.mp4" : "image/jpeg,.jpg,.jpeg"}
              multiple={publishType === "CAROUSEL"}
              onChange={onFileInput}
              disabled={busy}
            />
            <span className={styles.uploadIcon}>＋</span>
            <strong>
              {publishType === "REELS"
                ? "MP4 video seç veya buraya bırak"
                : publishType === "CAROUSEL"
                  ? "2-10 JPEG seç veya buraya bırak"
                  : "JPEG fotoğraf seç veya buraya bırak"}
            </strong>
            <small>{publishType === "REELS" ? "En fazla 24 MiB" : "Her fotoğraf en fazla 8 MiB"}</small>
          </label>

          {publishType === "IMAGE" && media[0] ? (
            <div className={styles.singlePreview}>
              <Image src={media[0].previewUrl} alt="Gönderi önizlemesi" width={900} height={700} unoptimized />
              <button type="button" onClick={() => removeMedia(media[0].id)}>Fotoğrafı kaldır</button>
            </div>
          ) : null}

          {publishType === "CAROUSEL" && media.length ? (
            <div className={styles.carouselGrid}>
              {media.map((item, index) => (
                <article className={styles.carouselItem} key={item.id}>
                  <span className={styles.order}>{index + 1}</span>
                  <Image src={item.previewUrl} alt={`Carousel ${index + 1}. fotoğraf`} width={360} height={360} unoptimized />
                  <div>
                    <button type="button" onClick={() => moveMedia(index, -1)} disabled={index === 0 || busy}>↑</button>
                    <button type="button" onClick={() => moveMedia(index, 1)} disabled={index === media.length - 1 || busy}>↓</button>
                    <button type="button" className={styles.remove} onClick={() => removeMedia(item.id)} disabled={busy}>Sil</button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {publishType === "REELS" && media[0] ? (
            <div className={styles.videoPreview}>
              <video src={media[0].previewUrl} controls playsInline preload="metadata" />
              <button type="button" onClick={() => removeMedia(media[0].id)}>Videoyu kaldır</button>
            </div>
          ) : null}

          {publishType === "REELS" ? (
            <>
              <p className={styles.limitNote}>
                Ücretsiz Workers KV altyapısı nedeniyle Reels dosyası en fazla 24 MiB olabilir.
              </p>
              <label className={styles.toggle}>
                <input type="checkbox" checked={shareToFeed} onChange={(event) => setShareToFeed(event.target.checked)} disabled={busy} />
                <span><strong>Akışta da göster</strong><small>Reels profil akışında da görünür.</small></span>
              </label>
            </>
          ) : null}

          <label className={styles.label}>
            Paylaşım metni
            <textarea rows={8} maxLength={2200} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder={`Villa ${villa} için paylaşım açıklamasını yazın…`} disabled={busy} />
          </label>

          {publishMode === "scheduled" ? (
            <div className={styles.scheduleFields}>
              <label>
                Tarih
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                Saat
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(event) => setScheduledTime(event.target.value)}
                  disabled={busy}
                />
              </label>
              <small>Türkiye saati (Europe/Istanbul)</small>
            </div>
          ) : null}

          <button type="button" className={styles.publish} disabled={!canPublish} onClick={() => void publish()}>
            {busy
              ? publishMode === "scheduled"
                ? "Medya yükleniyor ve plan kaydediliyor…"
                : publishType === "REELS" ? "Video hazırlanıyor ve yayınlanıyor…" : "Medya hazırlanıyor ve yayınlanıyor…"
              : publishMode === "scheduled"
                ? "Yayını planla"
                : `${currentType?.label ?? "İçerik"} Instagram'da yayınla`}
          </button>
          <p className={styles.note}>
            {publishMode === "scheduled"
              ? "Kayıt bu düğmeye bastığınızda oluşturulur; seçtiğiniz zamanda otomatik yayınlanır."
              : "İçerik yalnızca bu düğmeye bastığınızda bağlı Instagram hesabına gönderilir."}
          </p>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div><span className={styles.step}>2</span><div><h2>Son yayınlar</h2><p>Başarılı ve hatalı API işlemleri</p></div></div>
            <button type="button" className={styles.refresh} onClick={() => void refreshHistory()}>Yenile</button>
          </div>
          <div className={styles.history}>
            {history.length === 0 ? (
              <div className={styles.empty}>Henüz API üzerinden yayın kaydı yok.</div>
            ) : history.map((item) => (
              <article className={styles.historyItem} key={item.id}>
                <div className={styles.historyMedia}>
                  {item.publishType === "REELS" ? <span>▶</span> : (
                    <Image src={item.imageUrl} alt="" width={180} height={180} unoptimized />
                  )}
                  {(item.itemCount ?? 1) > 1 ? <b>{item.itemCount} fotoğraf</b> : null}
                </div>
                <div className={styles.historyBody}>
                  <div className={styles.historyTop}>
                    <div><strong>{item.villa}</strong><span>{typeLabel(item.publishType)}</span></div>
                    <span className={item.status === "Yayınlandı" ? styles.done : styles.failed}>{item.status}</span>
                  </div>
                  <p>{item.caption}</p>
                  <div className={styles.historyMeta}>
                    {item.username ? <small>@{item.username}</small> : null}
                    <small>{item.source === "scheduled" ? "Planlı" : "Manuel"}</small>
                    <small>{formattedDate(item.createdAt)}</small>
                    {item.instagramMediaId ? <small>Medya ID: {item.instagramMediaId}</small> : null}
                  </div>
                  {item.errorMessage ? <small className={styles.historyError}>{item.errorMessage}</small> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <InstagramScheduledPostsPanel refreshKey={scheduleRefreshKey} />
    </main>
  );
}
