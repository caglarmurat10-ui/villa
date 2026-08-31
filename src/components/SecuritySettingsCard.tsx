"use client";

import { FormEvent, useMemo, useState } from "react";

type FieldState = { current: string; next: string; confirm: string };
type SubmitState = { kind: "idle" | "sending" | "success" | "error"; message: string };

function passwordStrengthLabel(value: string): string {
  if (!value) return "";
  if (value.length < 14) return `En az 14 karakter gerekli (${value.length}/14)`;
  const varietyCount = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((pattern) => pattern.test(value)).length;
  if (value.length >= 20 && varietyCount >= 3) return "Güçlü";
  if (value.length >= 16 && varietyCount >= 2) return "İyi";
  return "Yeterli · daha uzun ve karışık karakterli olması önerilir";
}

export default function SecuritySettingsCard() {
  const [fields, setFields] = useState<FieldState>({ current: "", next: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle", message: "" });

  const strengthLabel = useMemo(() => passwordStrengthLabel(fields.next), [fields.next]);
  const fieldType = showPasswords ? "text" : "password";

  function updateField(key: keyof FieldState, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    if (state.kind !== "idle") setState({ kind: "idle", message: "" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (fields.next !== fields.confirm) {
      setState({ kind: "error", message: "Yeni parola tekrarı eşleşmiyor." });
      return;
    }
    if (fields.next.length < 14) {
      setState({ kind: "error", message: "Yeni parola en az 14 karakter olmalı." });
      return;
    }

    setState({ kind: "sending", message: "" });
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: fields.current, newPassword: fields.next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Parola değiştirilemedi.");

      setState({ kind: "success", message: "Parolanız güncellendi." });
      setFields({ current: "", next: "", confirm: "" });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Parola değiştirilemedi." });
    }
  }

  return (
    <form className="settings-box" onSubmit={submit} autoComplete="off">
      <span className="ops-eyebrow">GÜVENLİK</span>
      <h2>Parola değiştir</h2>
      <p>Yönetim paneli girişinde kullanılan parolayı güncelleyin. Değişiklikten sonra bu oturum açık kalır, diğer tüm oturumlar otomatik kapanır.</p>

      <label>
        Mevcut parola
        <input
          type={fieldType}
          name="currentPassword"
          autoComplete="current-password"
          value={fields.current}
          onChange={(event) => updateField("current", event.target.value)}
          required
          minLength={1}
          maxLength={256}
        />
      </label>

      <label>
        Yeni parola
        <input
          type={fieldType}
          name="newPassword"
          autoComplete="new-password"
          value={fields.next}
          onChange={(event) => updateField("next", event.target.value)}
          required
          minLength={14}
          maxLength={256}
        />
      </label>
      {fields.next && <div className="settings-password-hint">{strengthLabel}</div>}

      <label>
        Yeni parola (tekrar)
        <input
          type={fieldType}
          name="confirmPassword"
          autoComplete="new-password"
          value={fields.confirm}
          onChange={(event) => updateField("confirm", event.target.value)}
          required
          minLength={14}
          maxLength={256}
        />
      </label>

      <label className="settings-password-toggle">
        <input type="checkbox" checked={showPasswords} onChange={(event) => setShowPasswords(event.target.checked)} />
        <span>Parolaları göster</span>
      </label>

      <button className="settings-save" disabled={state.kind === "sending"}>
        {state.kind === "sending" ? "Değiştiriliyor…" : "Parolayı değiştir"}
      </button>

      {state.kind !== "idle" && state.message && (
        <div className={`settings-notice ${state.kind === "success" ? "success" : state.kind === "error" ? "error" : ""}`} style={{ marginTop: 12 }}>
          {state.message}
        </div>
      )}
    </form>
  );
}
