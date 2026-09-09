"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    FB?: {
      init(options: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }): void;
      login(
        callback: (response: { authResponse?: { code?: string }; status?: string }) => void,
        options: {
          config_id: string;
          response_type: "code";
          override_default_response_type: true;
          extras?: { featureType?: string; sessionInfoVersion?: string };
        },
      ): void;
    };
    fbAsyncInit?: () => void;
  }
}

type SignupEventPayload = {
  type?: string;
  event?: string;
  data?: { waba_id?: string; phone_number_id?: string; business_id?: string; error_message?: string };
};

const FB_SDK_SRC = "https://connect.facebook.net/tr_TR/sdk.js";
const FB_SDK_VERSION = "v21.0";

function loadFacebookSdk(appId: string): Promise<void> {
  return new Promise((resolve) => {
    if (window.FB) {
      resolve();
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: FB_SDK_VERSION });
      resolve();
    };
    if (document.getElementById("facebook-jssdk")) return;
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = FB_SDK_SRC;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  });
}

export default function WhatsappEmbeddedSignupPanel({ config }: { config: { appId: string; configId: string } | null }) {
  const [status, setStatus] = useState<"idle" | "loading" | "waiting-code" | "exchanging" | "done" | "error">("idle");
  const [notice, setNotice] = useState("");
  const [wabaId, setWabaId] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      let payload: SignupEventPayload;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (payload.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" || payload.event === "FINISH") {
        setWabaId(payload.data?.waba_id ?? null);
        setPhoneNumberId(payload.data?.phone_number_id ?? null);
      } else if (payload.event === "CANCEL") {
        setStatus("idle");
        setNotice("Bağlantı iptal edildi.");
      } else if (payload.event === "ERROR") {
        setStatus("error");
        setNotice(payload.data?.error_message ?? "Embedded Signup sırasında hata bildirildi.");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function connect() {
    if (!config) return;
    setStatus("loading");
    setNotice("");
    try {
      await loadFacebookSdk(config.appId);
    } catch {
      setStatus("error");
      setNotice("Facebook SDK yüklenemedi.");
      return;
    }

    setStatus("waiting-code");
    window.FB?.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setStatus("idle");
          setNotice("Bağlantı tamamlanmadı - kod alınamadı.");
          return;
        }
        void exchangeCode(code);
      },
      {
        config_id: config.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
      },
    );
  }

  async function exchangeCode(code: string) {
    setStatus("exchanging");
    try {
      const response = await fetch("/api/admin/whatsapp/embedded-signup/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Token değişimi başarısız.");
      setAccessToken(data.accessToken);
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setNotice(error instanceof Error ? error.message : "Token değişimi başarısız.");
    }
  }

  function copyToken() {
    if (!accessToken) return;
    navigator.clipboard?.writeText(accessToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }).catch(() => {});
  }

  if (!config) {
    return (
      <section style={{ maxWidth: 1250, margin: "0 auto 18px", padding: "0 20px" }}>
        <div style={{ border: "1px solid #334b69", borderRadius: 16, background: "#081522", padding: 16, color: "#eef6ff" }}>
          <small style={{ display: "block", fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: "#93c5fd" }}>WHATSAPP BUSINESS</small>
          <h2 style={{ margin: "5px 0 4px", fontSize: 18 }}>Coexistence bağlantısı (Embedded Signup)</h2>
          <p style={{ margin: 0, color: "#9fb0c5", fontSize: 11, lineHeight: 1.55 }}>
            Henüz yapılandırılmadı. Meta Geliştirici panelinde WhatsApp → Embedded Signup bölümünden Coexistence için yeni bir Facebook Login for Business config&apos;i oluşturup
            <code style={{ margin: "0 4px", padding: "1px 6px", borderRadius: 5, background: "#0f172a", color: "#93c5fd" }}>WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID</code>
            olarak eklendiğinde bu panel aktif olur. Mevcut WhatsApp Business uygulamanızdaki numara bu adımdan etkilenmez.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={{ maxWidth: 1250, margin: "0 auto 18px", padding: "0 20px" }}>
      <div style={{ border: "1px solid #334b69", borderRadius: 16, background: "#081522", padding: 16, color: "#eef6ff" }}>
        <small style={{ display: "block", fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: "#93c5fd" }}>WHATSAPP BUSINESS</small>
        <h2 style={{ margin: "5px 0 4px", fontSize: 18 }}>Coexistence bağlantısı (Embedded Signup)</h2>
        <p style={{ margin: 0, color: "#9fb0c5", fontSize: 11, lineHeight: 1.55 }}>
          Telefonunuzdaki mevcut WhatsApp Business uygulaması ve numarası bu akıştan etkilenmez - yalnız otomasyonun paralel bağlanması için WABA ID, Phone Number ID ve erişim tokenı alınır.
        </p>

        {status !== "done" ? (
          <button
            type="button"
            onClick={() => void connect()}
            disabled={status === "loading" || status === "waiting-code" || status === "exchanging"}
            style={{ marginTop: 12, border: "1px solid #1877f2", borderRadius: 9, padding: "10px 14px", background: "#1877f2", color: "#fff", fontSize: 11, fontWeight: 900, cursor: "pointer" }}
          >
            {status === "loading" ? "Yükleniyor…" : status === "waiting-code" ? "Meta penceresi açık…" : status === "exchanging" ? "Token alınıyor…" : "WhatsApp Business'ı bağla (Coexistence)"}
          </button>
        ) : null}

        {notice ? <p style={{ marginTop: 10, fontSize: 10, color: "#fca5a5" }}>{notice}</p> : null}

        {(wabaId || phoneNumberId) && (
          <div style={{ marginTop: 12, padding: "9px 11px", border: "1px solid #223a57", borderRadius: 10, background: "#0b1728", fontSize: 10, color: "#b8c6d8" }}>
            <div>WABA ID: <b style={{ color: "#dbeafe" }}>{wabaId ?? "—"}</b></div>
            <div>Phone Number ID: <b style={{ color: "#dbeafe" }}>{phoneNumberId ?? "—"}</b></div>
          </div>
        )}

        {status === "done" && accessToken ? (
          <div style={{ marginTop: 12, padding: "10px 12px", border: "1px solid #1f5f3b", borderRadius: 10, background: "#071b16" }}>
            <strong style={{ fontSize: 10, color: "#86efac" }}>✓ Erişim tokenı alındı - bu değer bir daha gösterilmeyecek.</strong>
            <p style={{ margin: "6px 0 0", fontSize: 9, color: "#bbf7d0", lineHeight: 1.5 }}>
              Şimdi bu değeri kopyalayıp terminalde <code>wrangler secret put WHATSAPP_ACCESS_TOKEN</code> ile ekleyin (yukarıdaki WABA ID / Phone Number ID&apos;yi de sırasıyla
              <code style={{ margin: "0 4px" }}>WHATSAPP_BUSINESS_ACCOUNT_ID</code> / <code>WHATSAPP_PHONE_NUMBER_ID</code> olarak). Sayfa yenilendiğinde bu token tekrar gösterilmez.
            </p>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button type="button" onClick={copyToken} style={{ border: "1px solid #47617f", borderRadius: 8, padding: "6px 10px", background: "#102238", color: "#dbeafe", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>
                {copied ? "Kopyalandı" : "Tokenı kopyala"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
