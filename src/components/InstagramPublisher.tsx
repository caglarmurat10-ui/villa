"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./InstagramPublisher.module.css";

type Villa = "Destan" | "Safira";

type HistoryItem = {
  id: string;
  villa: string;
  username?: string | null;
  imageUrl: string;
  caption: string;
  instagramMediaId?: string | null;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
  publishedAt?: string | null;
};

export default function InstagramPublisher() {
  const [villa, setVilla] = useState<Villa>("Destan");
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const canPublish = useMemo(
    () => Boolean(file && caption.trim() && !busy),
    [file, caption, busy],
  );

  useEffect(() => {
    void refreshHistory();
  }, []);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function refreshHistory() {
    try {
      const response = await fetch("/api/meta/instagram/publish", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setHistory(Array.isArray(data.items) ? data.items : []);
    } catch {
      // Geçmiş yüklenemese bile yayın ekranı kullanılabilir.
    }
  }

  async function publish() {
    if (!file || !caption.trim()) return;

    setBusy(true);
    setNotice("");
    setError("");

    try {
      const uploadBody = new FormData();
      uploadBody.set("villa", villa);
      uploadBody.set("file", file);

      const uploadResponse = await fetch("/api/meta/instagram/media", {
        method: "POST",
        body: uploadBody,
      });
      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok || !uploadData.publicUrl) {
        throw new Error(uploadData.error || "Fotoğraf yüklenemedi.");
      }

      const publishResponse = await fetch("/api/meta/instagram/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          villa,
          imageUrl: uploadData.publicUrl,
          caption: caption.trim(),
        }),
      });
      const publishData = await publishResponse.json();

      if (!publishResponse.ok) {
        throw new Error(publishData.error || "Instagram gönderisi yayınlanamadı.");
      }

      setNotice(
        publishData.username
          ? `@${publishData.username} hesabında yayınlandı.`
          : "Instagram gönderisi başarıyla yayınlandı.",
      );
      setCaption("");
      setFile(null);
      await refreshHistory();
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Instagram yayını tamamlanamadı.",
      );
      await refreshHistory();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>INSTAGRAM YAYIN MERKEZİ</span>
          <h1>Fotoğrafı seç, metni yaz, yayınla</h1>
          <p>
            Fotoğraf Cloudflare R2&apos;ye yüklenir ve bağlı profesyonel Instagram
            hesabına Meta API üzerinden yayınlanır.
          </p>
        </div>
        <a className={styles.back} href="/sosyal">← Sosyal merkeze dön</a>
      </section>

      {notice ? <div className={styles.success}>{notice}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <span className={styles.step}>1</span>
              <h2>Yeni Instagram gönderisi</h2>
            </div>
            <strong>{caption.length}/2200</strong>
          </div>

          <label className={styles.label}>
            Villa
            <select value={villa} onChange={(event) => setVilla(event.target.value as Villa)}>
              <option value="Destan">Villa Destan</option>
              <option value="Safira">Villa Safira</option>
            </select>
          </label>

          <label className={styles.uploadBox}>
            <input
              type="file"
              accept="image/jpeg,.jpg,.jpeg"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            {preview ? (
              <img src={preview} alt="Gönderi önizlemesi" />
            ) : (
              <div>
                <strong>JPEG fotoğraf seç</strong>
                <span>En fazla 8 MB</span>
              </div>
            )}
          </label>

          <label className={styles.label}>
            Paylaşım metni
            <textarea
              rows={9}
              maxLength={2200}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Villa Destan için paylaşım açıklamasını yazın…"
            />
          </label>

          <button className={styles.publish} disabled={!canPublish} onClick={publish}>
            {busy ? "Yükleniyor ve yayınlanıyor…" : "Instagram'da yayınla"}
          </button>

          <p className={styles.note}>
            İlk güvenli sürüm tek JPEG fotoğraf gönderisi yayınlar. Reels, carousel
            ve otomatik zamanlama bundan sonra aynı altyapıya eklenecek.
          </p>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <span className={styles.step}>2</span>
              <h2>Son yayınlar</h2>
            </div>
            <button className={styles.refresh} onClick={() => void refreshHistory()}>
              Yenile
            </button>
          </div>

          <div className={styles.history}>
            {history.length === 0 ? (
              <div className={styles.empty}>Henüz API üzerinden yayın kaydı yok.</div>
            ) : (
              history.map((item) => (
                <article className={styles.historyItem} key={item.id}>
                  <img src={item.imageUrl} alt="" />
                  <div>
                    <div className={styles.historyTop}>
                      <strong>{item.villa}</strong>
                      <span className={item.status === "Yayınlandı" ? styles.done : styles.failed}>
                        {item.status}
                      </span>
                    </div>
                    <p>{item.caption}</p>
                    {item.username ? <small>@{item.username}</small> : null}
                    {item.errorMessage ? (
                      <small className={styles.historyError}>{item.errorMessage}</small>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
