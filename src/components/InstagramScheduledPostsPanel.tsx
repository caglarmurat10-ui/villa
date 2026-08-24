"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import styles from "./InstagramPublisherV2.module.css";

type ScheduledStatus =
  | "scheduled"
  | "processing"
  | "published"
  | "failed"
  | "cancelled";

type ScheduledItem = {
  id: string;
  villa: "Destan" | "Safira";
  username?: string | null;
  type: "IMAGE" | "CAROUSEL" | "REELS";
  caption: string;
  mediaUrls: string[];
  mediaCount: number;
  scheduledAt: string;
  status: ScheduledStatus;
  attemptCount: number;
  lastError?: string | null;
};

const statusLabels: Record<ScheduledStatus, string> = {
  scheduled: "Planlandı",
  processing: "İşleniyor",
  published: "Yayınlandı",
  failed: "Başarısız",
  cancelled: "İptal edildi",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function responseData(response: Response) {
  const value: unknown = await response.json().catch(() => ({}));
  return isRecord(value) ? value : {};
}

async function loadScheduledItems() {
  const response = await fetch("/api/meta/instagram/schedule", {
    cache: "no-store",
  });
  const data = await responseData(response);
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Planlanan yayınlar yüklenemedi.",
    );
  }
  return Array.isArray(data.items) ? (data.items as ScheduledItem[]) : [];
}

function formattedDate(value: string) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function localInputParts(value: string) {
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
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`,
    time: `${parts.get("hour")}:${parts.get("minute")}`,
  };
}

function typeLabel(type: ScheduledItem["type"]) {
  return type === "CAROUSEL" ? "Carousel" : type === "REELS" ? "Reels" : "Fotoğraf";
}

export default function InstagramScheduledPostsPanel({
  refreshKey,
}: {
  refreshKey: number;
}) {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setItems(await loadScheduledItems());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Planlanan yayınlar yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loadScheduledItems()
      .then((nextItems) => {
        if (active) setItems(nextItems);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Planlanan yayınlar yüklenemedi.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  function startEdit(item: ScheduledItem) {
    const local = localInputParts(item.scheduledAt);
    setEditingId(item.id);
    setEditCaption(item.caption);
    setEditDate(local.date);
    setEditTime(local.time);
    setError("");
    setNotice("");
  }

  async function saveEdit(item: ScheduledItem) {
    if (!editDate || !editTime) return;
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/meta/instagram/schedule/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caption: editCaption,
            scheduledAt: `${editDate}T${editTime}`,
            timezone: "Europe/Istanbul",
          }),
        },
      );
      const data = await responseData(response);
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Planlı yayın güncellenemedi.",
        );
      }
      setEditingId("");
      setNotice("Planlı yayın güncellendi.");
      await refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Planlı yayın güncellenemedi.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function cancel(item: ScheduledItem) {
    if (!window.confirm("Bu planlı yayını iptal etmek istiyor musunuz?")) return;
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/meta/instagram/schedule/${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      const data = await responseData(response);
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Planlı yayın iptal edilemedi.",
        );
      }
      setEditingId("");
      setNotice("Planlı yayın iptal edildi.");
      await refresh();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Planlı yayın iptal edilemedi.",
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className={`${styles.card} ${styles.scheduledPanel}`}>
      <div className={styles.cardHead}>
        <div>
          <span className={styles.step}>3</span>
          <div>
            <h2>Planlanan yayınlar</h2>
            <p>Türkiye saatine göre otomatik Instagram yayın kuyruğu</p>
          </div>
        </div>
        <button
          type="button"
          className={styles.refresh}
          onClick={() => void refresh()}
          disabled={loading}
        >
          Yenile
        </button>
      </div>

      {notice ? <div className={styles.success}>{notice}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.scheduleList}>
        {loading ? (
          <div className={styles.empty}>Planlanan yayınlar yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>Henüz planlanmış Instagram yayını yok.</div>
        ) : (
          items.map((item) => {
            const editable = item.status === "scheduled" || item.status === "failed";
            return (
              <article className={styles.scheduleItem} key={item.id}>
                <div className={styles.scheduleThumb}>
                  {item.type === "REELS" ? (
                    <span>▶</span>
                  ) : item.mediaUrls[0] ? (
                    <Image
                      src={item.mediaUrls[0]}
                      alt=""
                      width={200}
                      height={200}
                      unoptimized
                    />
                  ) : (
                    <span>◎</span>
                  )}
                  <b>{item.mediaCount} medya</b>
                </div>
                <div className={styles.scheduleBody}>
                  <div className={styles.scheduleTop}>
                    <div>
                      <strong>Villa {item.villa}</strong>
                      {item.username ? <small>@{item.username}</small> : null}
                      <small>{typeLabel(item.type)}</small>
                    </div>
                    <span className={`${styles.scheduleStatus} ${styles[item.status]}`}>
                      {statusLabels[item.status]}
                    </span>
                  </div>

                  {editingId === item.id ? (
                    <div className={styles.editForm}>
                      <label>
                        Tarih
                        <input
                          type="date"
                          value={editDate}
                          onChange={(event) => setEditDate(event.target.value)}
                          disabled={busyId === item.id}
                        />
                      </label>
                      <label>
                        Saat
                        <input
                          type="time"
                          value={editTime}
                          onChange={(event) => setEditTime(event.target.value)}
                          disabled={busyId === item.id}
                        />
                      </label>
                      <label className={styles.editCaption}>
                        Paylaşım metni
                        <textarea
                          rows={4}
                          maxLength={2200}
                          value={editCaption}
                          onChange={(event) => setEditCaption(event.target.value)}
                          disabled={busyId === item.id}
                        />
                      </label>
                      <small className={styles.timezone}>Türkiye saati (Europe/Istanbul)</small>
                    </div>
                  ) : (
                    <>
                      <time>{formattedDate(item.scheduledAt)}</time>
                      <p>{item.caption || "Paylaşım metni yok."}</p>
                    </>
                  )}

                  {item.lastError ? (
                    <small className={styles.historyError}>{item.lastError}</small>
                  ) : null}
                  {editable ? (
                    <div className={styles.scheduleActions}>
                      {editingId === item.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void saveEdit(item)}
                            disabled={busyId === item.id || !editDate || !editTime}
                          >
                            Kaydet
                          </button>
                          <button type="button" onClick={() => setEditingId("")}>
                            Vazgeç
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => startEdit(item)}>
                          Düzenle
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.cancelButton}
                        onClick={() => void cancel(item)}
                        disabled={busyId === item.id}
                      >
                        İptal
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
