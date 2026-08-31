"use client";

import { type FormEvent, useState } from "react";
import styles from "./login.module.css";

function destinationAfterLogin() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Giriş yapılamadı.");
      window.location.replace(destinationAfterLogin());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Giriş yapılamadı.");
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brand}>
          <span>SAFİRA & DESTAN</span>
          <strong>Villa Yönetim</strong>
        </div>

        <div className={styles.heading}>
          <span className={styles.eyebrow}>GÜVENLİ YÖNETİM ERİŞİMİ</span>
          <h1 id="login-title">Yönetim paneline giriş</h1>
          <p>Rezervasyon, misafir, finans ve sosyal medya yönetimi için parolanızı girin.</p>
        </div>

        <form className={styles.form} onSubmit={submit}>
          <label>
            <span>Yönetim parolası</span>
            <input
              autoFocus
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={12}
              maxLength={256}
              required
              disabled={busy}
            />
          </label>

          {error ? <div className={styles.error} role="alert">{error}</div> : null}

          <button type="submit" disabled={busy || password.length < 12}>
            {busy ? "Giriş yapılıyor…" : "Giriş yap"}
          </button>
        </form>

        <div className={styles.security}>
          <span>🔒 HttpOnly oturum</span>
          <span>12 saatlik güvenli erişim</span>
        </div>
      </section>
    </main>
  );
}
